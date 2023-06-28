#!/usr/bin/env node
import {buildConfig} from './utils.js'
import fs from 'fs-extra'
import path from 'path'
import {hideBin} from 'yargs/helpers'
import loadSettings from './settings.js'
import getTask from './task.js'
import yargs from 'yargs'
import {visualizer} from "esbuild-visualizer/dist/plugin/index.js";
import opn from 'open'
let settings

(async() => {   

    const cli = {
        // eslint-disable-next-line no-console
        log(...args) {console.log(...args)},
    }

    yargs(hideBin(process.argv))
        .usage('Usage: $0 [task]')
        .detectLocale(false)
        .option('builddir', {
            default: '',
            describe: 'The directory to build to',
            type: 'string',
        })
        .option('minify', {
            default: false,
            description: 'Minify output',
            type: 'boolean',
        })
        .option('package', {
            default: '.',
            describe: 'The target package',
            type: 'string',
        })
        .option('port', {
            alias: 'p',
            default: 3000,
            describe: 'port to bind the devserver on',
            type: 'number',
        })
        .option('sourceMap', {
            default: true,
            description: 'Include source mapping',
            type: 'boolean',
        })
        .middleware(async(argv) => {
            settings = await loadSettings(argv)
            const tasksFile = path.join(settings.dir.workspace, 'tasks.js')
            const exists = await fs.pathExists(tasksFile)
            if (!exists) {
                const task = argv._[0]
                if (!argv._.includes('boilerplate')) {
                    throw new Error('No tasks file found; initialize boilerplate first')
                }
                return
            }

            const tasks = await import(path.join(settings.dir.workspace, 'tasks.js'))
            const Task = getTask(settings)
            cli.tasks = tasks.loadTasks({settings, Task})

            // Make sure that the cache & build directories exist,
            // before executing any task.
            await Promise.all([
                fs.mkdirp(settings.dir.build),
                fs.mkdirp(settings.dir.cache),
            ])
            
            if (argv._.includes('dev')) {
                settings.dev.enabled = true
            }
            cli.settings = settings
            buildConfig(cli, argv)
        })
        .command('analyze', 'Analyze bundle contents', () => {}, async(argv) => {
            await cli.tasks.build.start({incremental: false, minify: true, metafile: true, sourceMap: false})
            const metadata = await fs.readFile(path.join(settings.dir.build, 'meta.json'), 'utf-8')
            const fileContent = await visualizer(JSON.parse(metadata), {
                title: 'stats.html',
                template: 'treemap',
            })
            const htmlFile = path.join(settings.dir.build, 'stats.html')
            await fs.writeFile(htmlFile, fileContent)
            await opn(htmlFile)            
        })
        .command('assets', 'copy assets', () => {}, (argv) => {
            cli.tasks.assets.start(argv)
        })
        .command('boilerplate', 'create default project structure', () => {}, async(argv) => {
            await fs.copy(path.join(settings.dir.dotbuild, 'boilerplate'), settings.dir.base)
            // cli.tasks.styles.start(argv)
        })
        .command('build', 'build application', () => {}, (argv) => {
            cli.tasks.build.start(argv)
        })
        .command('code', 'bundle javascript', () => {}, (argv) => {
            cli.tasks.code.start(argv)
        })
        .command('config', 'list build config', () => {}, (argv) => {
            cli.tasks.config.start(argv)
        })
        .command('dev', 'run a development server', () => {}, (argv) => {
            cli.tasks.dev.start(argv)
        })
        .command('html', 'build html file', () => {}, (argv) => {
            cli.tasks.html.start(argv)
        })
        .command('styles', 'bundle styles', () => {}, (argv) => {
            cli.tasks.styles.start(argv)
        })
        .demandCommand()
        .help('help')
        .showHelpOnFail(true)
        .argv
})()
