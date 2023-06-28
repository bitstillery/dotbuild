// Source: https://github.com/yyx990803/vue-lit/blob/master/index.js
import {app} from '@/lib/main.js'
import {customElement, property} from 'lit/decorators.js'
import {html, LitElement} from 'lit'
import {render} from 'lit-html'
import {effect, shallowReactive} from '@vue/reactivity'

let currentInstance

export function defineComponent(name, propDefs, factory) {
    if (typeof propDefs === 'function') {
        factory = propDefs
        propDefs = []
    }

    console.log("NAME", name)

    customElements.define(
        name,
        class extends HTMLElement {
            constructor() {
                super()
                const props = (this._props = shallowReactive({}))
                currentInstance = this
                const template = factory.call(this, props)
                currentInstance = null
                this._bm && this._bm.forEach((cb) => cb())
                const root = this.attachShadow({mode: 'closed'})
                let isMounted = false
                effect(() => {
                    if (isMounted) {
                        this._bu && this._bu.forEach((cb) => cb())
                    }
                    render(template(), root)
                    if (isMounted) {
                        this._u && this._u.forEach((cb) => cb())
                    } else {
                        isMounted = true
                    }
                })
            }

            static get observedAttributes() {
                return propDefs
            }

            attributeChangedCallback(name, oldValue, newValue) {
                this._props[name] = newValue
            }

            connectedCallback() {
                this._m && this._m.forEach((cb) => cb())
            }

            disconnectedCallback() {
                this._um && this._um.forEach((cb) => cb())
            }
            
        },
    )
}

function createLifecycleMethod(name) {
    return (cb) => {
        if (currentInstance) {
            (currentInstance[name] || (currentInstance[name] = [])).push(cb)
        }
    }
}

export const onBeforeMount = createLifecycleMethod('_bm')
export const onMounted = createLifecycleMethod('_m')
export const onBeforeUpdate = createLifecycleMethod('_bu')
export const onUpdated = createLifecycleMethod('_u')
export const onUnmounted = createLifecycleMethod('_um')

export * from 'lit-html'
export * from '@vue/reactivity'
