import archy from 'archy'
import chalk from 'chalk'
import {decode} from 'html-entities'
import fs from 'fs-extra'
import * as deepl from 'deepl-node'
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


const log_prefixes = {
    error: chalk.bold.red('[dotbuild]'.padEnd(16, ' ')),
    ok: chalk.bold.green('[dotbuild]'.padEnd(16, ' ')),
    warning: chalk.bold.yellow('[dotbuild]'.padEnd(16, ' ')),
}


const log = function(level, message) {
    // eslint-disable-next-line no-console
    console.log(`${log_prefixes[level]}${message}`)
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

export function keyMod(reference, apply, refPath) {
    if (!refPath) {
        refPath = []
    }
    for (const key of Object.keys(reference)) {
        if (typeof reference[key] === 'object') {
            refPath.push(key)
            keyMod(reference[key], apply, refPath)
        } else {
            apply(reference, key, refPath)
        }
    }
    refPath.pop()
}

export function keyPath(obj, refPath, create = false) {
    if (!Array.isArray(refPath)) throw new Error('refPath must be an array')
    if (!refPath.length) return obj

    const _refPath = [...refPath]
    let _obj = obj
    while (_refPath.length) {
        const key = _refPath.shift()
        if (typeof _obj === 'object' && key in _obj) {
            _obj = _obj[key]
        } else if (create) {
            _obj[key] = {}
            _obj = _obj[key]
        }
    }

    return _obj
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

export function sortNestedObjectKeys(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj
    }

    const sortedKeys = Object.keys(obj).sort()

    const sortedObj = {}
    sortedKeys.forEach((key) => {
        const value = obj[key]
        sortedObj[key] = sortNestedObjectKeys(value)
    })

    return sortedObj
}

export class Translator {

    constructor(settings) {
        this.settings = settings
        this.deeplKeyException = new Error('Deepl translator key required for auto-translate (process.env.DOTBUILD_TRANSLATOR_KEY)')
    }

    collectStats(task, stats) {
        const _stats = {costs: {chars: 0, keys: 0}, total: {chars: 0, keys: 0}}
        for (const stat of stats) {
            _stats.costs.chars += stat.costs.chars
            _stats.costs.chars += stat.costs.keys
            _stats.total.chars += stat.total.chars
            _stats.total.keys += stat.total.keys
        }

        const costs = `(update: ${_stats.costs.keys}/${_stats.costs.chars})`
        const total = `(total: ${_stats.total.keys} keys/${_stats.total.chars} chars)`
        task.log(`${task.prefix.ok}translate i18n entries: ${costs} ${total}`)
    }

    async initDeepl() {
        log('ok', 'Initializing Deepl...')
        const authKey = process.env.DOTBUILD_TRANSLATOR_KEY
        if (!authKey) throw new Error('Deepl translator key required for auto-translate (process.env.DOTBUILD_TRANSLATOR_KEY)')
        this.deepl = new deepl.Translator(authKey)
        this.glossaries = await this.deepl.listGlossaries()
        const usage = await this.deepl.getUsage()

        if (usage.anyLimitReached()) {
            log('error', 'Deepl translation limit exceeded')
        }
        if (usage.character) {
            const percentage = (usage.character.count / usage.character.limit) * 100
            log('ok', `Deepl usage: ${usage.character.count} of ${usage.character.limit} characters (${percentage.toFixed(2)}%)`)
        }
        if (usage.document) {
            log('ok', `Deepl usage: ${usage.document.count} of ${usage.document.limit} documents`)
        }
    }

    async translate(task, targetLanguage, overwrite = false) {
        let sourcePath, targetPath, targetI18n
        const actions = {remove: [], update: []}

        sourcePath = path.join(this.settings.dir.i18n, 'src.json')
        targetPath = path.join(this.settings.dir.i18n, `${targetLanguage}.json`)

        const sourceI18n = JSON.parse(await fs.readFile(sourcePath, 'utf8'))
        const targetExists = await fs.pathExists(targetPath)
        if (targetExists && !overwrite) {
            targetI18n = JSON.parse(await fs.readFile(targetPath, 'utf8'))
            keyMod(targetI18n, (targetRef, key, refPath) => {
                const sourceRef = keyPath(sourceI18n, refPath)
                // The key in the target i18n does not exist in the source (e.g. obsolete)
                if (!sourceRef[key]) {                    
                    actions.remove.push([[...refPath], key])
                } else if (typeof sourceRef[key] !== typeof targetRef[key]) {
                    // The value in the target i18n may be a string, where the source is an object
                    // or viceversa. Mark for deletion, so it can be retranslated.
                    actions.remove.push([[...refPath], key])
                }
            })
        } else {
            // Use a copy of the en i18n scheme as blueprint for the new scheme.
            targetI18n = JSON.parse(JSON.stringify(sourceI18n))
        }

        const placeholderRegex = /{{[\w]*}}/g
        // Show a rough estimate of deepl translation costs...
        const stats = {total: {chars: 0, keys: 0}, costs: {chars: 0, keys: 0}}
        keyMod(sourceI18n, (sourceRef, key, refPath) => {
            const targetRef = keyPath(targetI18n, refPath)
            const cacheRef = keyPath(this.cacheI18n, refPath)

            stats.total.keys += 1
            // Use xml tags to indicate placeholders for deepl.
            const preppedSource = sourceRef[key].replaceAll(placeholderRegex, (res) => {
                return res.replace('{{', '<x>').replace('}}', '</x>')
            })
            stats.total.chars += preppedSource.length
            if (overwrite || !targetRef || !targetRef[key] || cacheRef[key] !== sourceRef[key]) {
                stats.costs.chars += preppedSource.length
                stats.costs.keys += 1
                actions.update.push([[...refPath], key, preppedSource])
            }
        })

        for (const removeAction of actions.remove) {
            task.log(`${task.prefix.warning} [${targetLanguage}] remove obsolete key: ${removeAction[0].join('.')}.${removeAction[1]}`)
            const targetRef = keyPath(targetI18n, removeAction[0])
            delete targetRef[removeAction[1]]
        }

        if (actions.update.length) {
            // Keys that need translation; from here on we require Deepl.
            if (!this.deepl) throw this.deeplKeyException

            const glossary = this.glossaries.find((i) => i.name === `bitstillery_${targetLanguage}`)
            const deeplOptions = {
                formality: 'prefer_less',
                // The <x> tag is used to to label {{placeholders}} as untranslatable for Deepl. They
                // are replaced back with the correct i18n format after translation. The <i> tag
                // is just used ignored and stripped.
                ignoreTags: ['i', 'x'],
                tagHandling: 'xml',
            }

            if (glossary) {
                deeplOptions.glossary = glossary
            }

            let res = await this.deepl.translateText(actions.update.map((i) => i[2]), 'en', targetLanguage, deeplOptions)
            const ignoreXTagRegex = /<x>[\w]*<\/x>/g
            const ignoreITagRegex = /<i>[\w]*<\/i>/g
            for (const [i, translated] of res.entries()) {
                // The results come back in the same order as they were submitted.
                // Restore the xml placeholders to the i18n format being use.
                const transformedText = translated.text
                    .replaceAll(ignoreXTagRegex, (res) => res.replace('<x>', '{{').replace('</x>', '}}'))
                    .replaceAll(ignoreITagRegex, (res) => res.replace('<i>', '').replace('</i>', ''))
                const targetRef = keyPath(targetI18n, actions.update[i][0], true)
                // Deepl escapes html tags; e.g. < &lt; > &gt; We don't want to ignore
                // those, because its content must be translated as well. Instead,
                // decode these special html escape characters.
                const decodedText = decode(transformedText)
                task.log(`${task.prefix.ok}${actions.update[i][0].join('.')} => ${decodedText} (${targetLanguage})`)
                targetRef[actions.update[i][1]] = decodedText
            }
        }

        if (actions.update.length || actions.remove.length) {
            await fs.writeFile(targetPath, JSON.stringify(sortNestedObjectKeys(targetI18n), null, 4))
        }

        return stats
    }

    async updateCache() {
        // Track individual changes during development mode.
        this.cacheI18n = JSON.parse(await fs.readFile(path.join(this.settings.dir.code, 'i18n', 'src.json'), 'utf8'))
    }

    async updateGlossaries(task) {
        if (!this.deepl) throw this.deeplKeyException
        for (const glossary of this.glossaries) {
            task.log(`${task.prefix.ok}remove stale glossary: ${glossary.glossaryId}`)
            await this.deepl.deleteGlossary(glossary)
        }
        const globPattern = `${path.join(this.settings.dir.code, 'i18n', 'glossaries', '*.json')}`
        const files = await glob(globPattern)

        for (const filename of files) {
            const language = path.basename(filename).replace('.json', '')
            const entries = JSON.parse((await fs.readFile(filename)).toString('utf8'))
            // Empty glossaries are not allowed in Deepl.
            if (Object.keys(entries).length === 0) continue
            const glossaryEntries = new deepl.GlossaryEntries({entries})
            const glossaryName = `bitstillery_${language}`
            task.log(`${task.prefix.ok}create glossary ${glossaryName}`)
            await this.deepl.createGlossary(glossaryName, 'en', language, glossaryEntries)
        }

        this.glossaries = await this.deepl.listGlossaries()
        task.log(`${task.prefix.ok}reloaded glossaries: ${this.glossaries.length}`)
    }
}
