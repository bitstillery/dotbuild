import chalk from 'chalk'
import notifier from 'node-notifier'
import path from 'path'
import {performance} from 'perf_hooks'

export default function getTask(settings) {

    return class Task {

        constructor(title, execute) {
            this.title = title

            this.execute = execute
            this.prefix = {
                error: chalk.bold.red(`[${this.title}]`.padEnd(20, ' ')),
                ok: chalk.bold.green(`[${this.title}]`.padEnd(20, ' ')),
            }
        }

        log(...args) {
            // eslint-disable-next-line no-console
            console.log(...args)
        }

        async start(...args) {
            this.startTime = performance.now()
            let logStart = `${this.prefix.ok}${chalk.gray('task started')}`
            this.log(logStart)
            let result

            try {
                result = await this.execute(...args)
                if (result && result.size) {
                    if (result.size < 1024) {
                        this.size = `${result.size}B`
                    } else if (result.size < Math.pow(1024, 2)) {
                        this.size = `${Number(result.size / 1024).toFixed(2)}KiB`
                    } else {
                        this.size = `${Number(result.size / Math.pow(1024, 2)).toFixed(2)}MiB`
                    }
                }
            } catch (err) {
                // Throwing an error allows the CI to fail the build task.
                if (!settings.dev.enabled) {
                    throw new Error(`${this.prefix.error}task failed\n${err}`)
                } else {
                    this.log(`${this.prefix.error}task failed\n${err}`)
                    notifier.notify({
                        icon: path.join(settings.dir.theme, 'img', 'logo-simple.png'),
                        message: `${err}`,
                        title: `Task ${this.title} failed!`,
                    })
                }

            }

            this.endTime = performance.now()
            this.spendTime = `${Number(this.endTime - this.startTime).toFixed(1)}ms`

            let logComplete = `${this.prefix.ok}task completed`

            logComplete += ` (${chalk.bold(this.spendTime)}`
            if (this.size) logComplete += `, ${chalk.bold(this.size)}`
            logComplete += ')'

            this.log(logComplete)

            if (result && result.size) return result.size
        }
    }
}

