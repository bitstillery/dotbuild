import { render } from 'solid-js/web'
import {AppWrapper} from '@/components'
import i18next from 'i18next'
import Logger from './lib/logger.js'
import EventEmitter from 'eventemitter3'
import Store from './lib/store'
import localeDe from './i18n/de.json'
import localeEn from './i18n/en-GB.json'

const store = new Store()
export const $s = store.load()
export const $t = i18next.t

class Project extends EventEmitter {
    logger = new Logger(this)
    store = store
    $s= $s
    
    constructor() {
        super()
        this.init()
    }

    init() {
        i18next.init({
            debug: process.env.NODE_ENV !== 'production',
            fallbackLng: 'en',
            lng: $s.language.selection,
            resources: {
                de: {translation: localeDe},
                en: {translation: localeEn},
            },
        })
        render(AppWrapper, document.body)        
    }
}

export const app = new Project()


globalThis.app = app
