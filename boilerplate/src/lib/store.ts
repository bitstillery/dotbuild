import {mergeDeep} from './utils'
import {createMutable} from 'solid-js/store'
import {persistantState, volatileState} from './state'

class Store {
    load() {
        let restoredState
        try {
            restoredState = JSON.parse(localStorage.getItem('store'))
        } catch (err) {
            restoredState = {}
        }

        return createMutable(mergeDeep(mergeDeep(persistantState, restoredState), volatileState))
    }

    save() {
        localStorage.setItem('store', JSON.stringify(persistantState))
    }
}

export default Store