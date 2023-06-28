import path from 'path'
import {esbuild, devServer, fs, glob, watch, Scss, template} from '@bitstillery/dotbuild'

export function loadTasks({settings, Task}) {    
    const tasks = {}
    const scss = Scss(settings)
    let esbuildInstance

    tasks.assets = new Task('assets', async function() {
        await fs.ensureDir(path.join(settings.dir.build, 'fonts'))

        let actions = [
            fs.copy(path.join(settings.dir.assets, 'fonts'), path.join(settings.dir.build, 'fonts')),
            fs.copy(path.join(settings.dir.assets, 'img'), path.join(settings.dir.build, 'img')),
        ]

        await Promise.all(actions)
    })

    tasks.build = new Task('build', async function({incremental = false, minify = false, metafile = false, sourceMap = false} = {}) {
        await tasks.clean.start()
        await Promise.all([
            tasks.assets.start(),
            tasks.html.start({minify}),
            tasks.code.start({incremental, metafile, minify, sourceMap}),
            tasks.styles.start({minify, sourceMap}),
        ])
    })

    tasks.clean = new Task('clean', async function() {
        await fs.rm(settings.dir.build, {force: true, recursive: true})
    })

    tasks.dev = new Task('dev', async function({minify = false, metafile = false, port = 9001, sourceMap = true} = {}) {
        await tasks.build.start({incremental: true, metafile, minify, sourceMap})

        const {app, proxy, runner} = devServer(settings, tasks)
        app.all('/api/*', function(req, res) { 
            proxy.web(req, res, {
                changeOrigin: true,
                target: 'http://127.0.0.1:3030'
            })
        })

        watch([
            path.join(settings.dir.assets, 'manifest.json'),
            path.join(settings.dir.assets, 'img', '**'),
            path.join(settings.dir.assets, 'fonts', '**'),
        ]).on('change', runner.assets)

        watch([path.join(settings.dir.base, 'index.html')]).on('change', runner.html)

        watch([
            path.join(settings.dir.code, '**', '*.js'),
            path.join(settings.dir.code, '**', '*.jsx'),
        ]).on('change', runner.code)

        watch([path.join(settings.dir.theme, '**', '*.scss')]).on('change', runner.stylesApp)
        watch([path.join(settings.dir.components, '**', '*.scss')]).on('change', runner.stylesComponents)
    })

    tasks.html = new Task('html', async function() {
        const indexFile = await fs.readFile(path.join(settings.dir.code, 'index.html'))
        const html = template(indexFile)({settings})
        await fs.writeFile(path.join(settings.dir.build, 'index.html'), html)
        return {size: html.length}
    })

    tasks.code = new Task('code', async function({incremental = false, minify = false, metafile = false, sourceMap = false} = {}) {
        if (!esbuildInstance) {
            esbuildInstance = await esbuild.context({
                bundle: true,
                define: {
                    'process.env': JSON.stringify({
                        NODE_ENV: process.env.NODE_ENV ? process.env.NODE_ENV : 'development',
                    }),                    
                },
                entryPoints: [path.join(settings.dir.code, 'app.js')],
                external: ['*.jpg', '*.png', '*.woff2'],
                format: 'iife',
                jsxFactory: 'h',
                metafile,
                minify,
                outfile: path.join(settings.dir.build, `app.${settings.buildId}.js`),
                resolveExtensions: ['.ts', '.tsx', '.js'],
                sourcemap: sourceMap,
                splitting: false,
                target: 'es2020',
            })            
        }
        
        const build = await esbuildInstance.rebuild()
        if (build.metafile) {
            await fs.writeFile(path.join(settings.dir.build, 'meta.json'), JSON.stringify(build.metafile), 'utf8')
        }

        if (!incremental) esbuildInstance.dispose()
        return {size: (await fs.readFile(path.join(settings.dir.build, `app.${settings.buildId}.js`))).length}
    })

    tasks.styles = new Task('styles', async function({minify = false, sourceMap = false} = {}) {
        const actions = [
            stylesApp.start({minify, sourceMap}),
            stylesComponents.start({minify, sourceMap}),
        ]

        const res = await Promise.all(actions)
        return {size: res.reduce((total, num) => total + num)}
    })

    const stylesApp = new Task('styles:app', async function({minify, sourceMap}) {
        let data = `@use "sass:color";@use "sass:math";`
        data += await fs.readFile(path.join(settings.dir.code, 'scss', 'app.scss'), 'utf8')
        const styles = await scss({
            data,
            file: 'scss/app.scss',
            minify,
            outFile:  path.join(settings.dir.build, `app.${settings.buildId}.css`),
            sourceMap,
        })

        return {size: styles.length}
    })

    const stylesComponents = new Task('styles:components', async function({minify, sourceMap}) {
        let data = `@use "sass:color";@use "sass:math";`
        data += '@import "variables";'
        const componentFiles = await glob(`${path.join(settings.dir.components, '**', '*.scss')}`)

        const componentImports = componentFiles.map((f) => {
            let scssImport = f.replace(`${settings.dir.components}${path.sep}`, '').replace('.scss', '')
            return `@import "${scssImport}";`
        })

        data += componentImports.join('\n')
        const styles = await scss({
            data,
            file: 'src/scss/components.scss',
            minify,
            outFile:  path.join(settings.dir.build, `components.${settings.buildId}.css`),
            sourceMap,
        })

        return {size: styles.length}
    })

    return tasks
}
