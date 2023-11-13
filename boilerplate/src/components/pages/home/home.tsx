import {createMutable} from 'solid-js/store'
import {$s, $t} from '@/app'


export const Home = (): JSX.Element => {
    const state = createMutable({
        value: 0
    })

    const increment = () => {
      state.value += 1
    }
    const decrement = () => state.value -= 1
  
    return <div>
      <h1>{$t('home.title')}</h1>
      <p>{state.value}</p>
      <p>Collapsed: {$s.panel.collapsed.toString()}</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
}