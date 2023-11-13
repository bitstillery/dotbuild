import _ from 'lodash'
import _glob from 'glob'
import bodyParser from 'body-parser'
import chokidar from 'chokidar'
import esbuild from 'esbuild'
import {solidPlugin} from 'esbuild-plugin-solid'
import express from 'express'
import fs from 'fs-extra'
import httpProxy from 'http-proxy'
import path from 'path'
import tinylr from 'tiny-lr'
import util from 'util'
const glob = util.promisify(_glob)

export {Scss, Translator} from './utils.js'
export {glob}
export const watch = chokidar.watch
export const template = _.template
export {esbuild}
export {solidPlugin}
export {fs}

export const devServer = function(settings, tasks) {
    process.on('SIGINT', () => { process.exit(0) })
    const app = express()
    const proxy = httpProxy.createProxyServer()
    
    app.use('/', express.static(settings.dir.build))
    app.use(bodyParser.json())
    app.use(tinylr.middleware({app}))
    app.get('*', function(req, res) {
        res.sendFile(path.join(settings.dir.build, 'index.html'))
    })
    app.listen({
        host: settings.dev.host, 
        port: settings.dev.port
    })

    const debounce = {options: {trailing: true}, wait: 1000}

    const runner = {
        assets: _.throttle(async() => {
            await tasks.assets.start()
            tinylr.changed('index.html')
        }, debounce.wait, debounce.options),
        code: _.throttle(async() => {
            await tasks.code.start({incremental: true, metafile: false, minify: false, sourceMap: true})
            tinylr.changed(`app.${settings.buildId}.js`)
        }, debounce.wait, debounce.options),
        html: _.throttle(async() => {
            await tasks.html.start({minify: false})
            tinylr.changed('index.html')
        }, debounce.wait, debounce.options),
        i18n: _.throttle(async() => {
            await tasks.i18n.start({overwrite: false})
            await tasks.code.start({incremental: true, metafile: false, minify: false, sourceMap: true})
            tinylr.changed('index.html')
        }, debounce.wait, debounce.options),
        styles: {
            app: _.throttle(async() => {
                await Promise.all([
                    tasks.stylesApp.start({minify: false, sourceMap: true}),
                    tasks.stylesComponents.start({minify: false, sourceMap: true}),
                ])
                tinylr.changed(`app.${settings.buildId}.css`)
                tinylr.changed(`components.${settings.buildId}.css`)
            }, debounce.wait, debounce.options),
            components: _.throttle(async() => {
                await tasks.stylesComponents.start({minify: false, sourceMap: true})
                tinylr.changed(`components.${settings.buildId}.css`)
            }, debounce.wait, debounce.options)
        }
    }

    return {app, proxy, runner}
}