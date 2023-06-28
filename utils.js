import archy from 'archy'
import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import sass from 'sass'
import tildify from 'tildify'

export const __dirname = path.dirname(new URL(import.meta.url).pathname)

const format = {
    selected: (options, selected) => {
        let styledOptions = options.map((option) => {
            if (option === selected) return chalk.blue.underline(option)
            else return chalk.grey(option)
        })
        return `${chalk.grey('[')}${styledOptions.join(chalk.grey('|'))}${chalk.grey(']')}`
    },
}

export const buildConfig = async function(cli, argv) {
    const tree = {
        label: 'Config:',
        nodes: [
            {
                label: chalk.bold.blue('Directories'),
                nodes: Object.entries(cli.settings.dir).map(([k, dir]) => {
                    return {label: `${k.padEnd(10, ' ')} ${tildify(dir)}`}
                }),
            },
            {
                label: chalk.bold.blue('Build Flags'),
                nodes: [
                    {label: `${'buildId'.padEnd(10, ' ')} ${cli.settings.buildId}`},
                    {label: `${'minify'.padEnd(10, ' ')} ${cli.settings.minify}`},
                    {label: `${'sourceMap'.padEnd(10, ' ')} ${cli.settings.sourceMap}`},
                    {label: `${'package'.padEnd(10, ' ')} ${format.selected(['backend', 'client'], cli.settings.package)}`},
                    {label: `${'version'.padEnd(10, ' ')} ${cli.settings.version}`},
                ],
            },
        ],
    }

    if (argv._.includes('dev')) {
        cli.log(`\nDevserver: ${chalk.grey(`${cli.settings.dev.host}:${cli.settings.dev.port}`)}`)
    }
    cli.log('\r')
    archy(tree).split('\r').forEach((line) => cli.log(line))
}

export function flattenEnv(obj, parent, res = {}) {
    for (const key of Object.keys(obj)) {
        const propName = (parent ? parent + '_' + key : key).toUpperCase()
        if (typeof obj[key] === 'object') {
            flattenEnv(obj[key], propName, res)
        } else {
            res[`PYR_${propName}`] = obj[key]
        }
    }
    return res
}

export function Scss(settings) {
    return async function(options) {
        const result = sass.renderSync({
            data: options.data,
            file: options.file,
            includePaths: [
                settings.dir.code,
                settings.dir.components,
            ],
            outFile: options.outFile,
            outputStyle: options.minify ? 'compressed' : 'expanded',
            sourceMap: options.sourceMap,
            sourceMapContents: true,
        })

        let styles = result.css.toString()

        if (result.map) {
            await fs.writeFile(`${options.outFile}.map`, result.map, 'utf8')
        }
        await fs.writeFile(options.outFile, styles, 'utf8')
        return styles
    }
}
