import {Routes, Route, Router, A} from '@solidjs/router'
import {classes} from '@/lib/utils'

import {Home} from '@/components/pages'
import {Users} from '@/components/pages'
import {$s} from '@/app'

export const App = () => <div class="c-app">
    <div 
        class={classes('panel', {
            collapsed: $s.panel.collapsed,
        })}
        onClick={() => {
            $s.panel.collapsed = !$s.panel.collapsed
        }}
    >
    </div>
    <div class="view-layout">
        <nav class="bar-main">
          <A href="/">Home</A>
          <A href="/about">About</A>
          <A href="/users">Users</A>
        </nav>
        <div class="view">
            <Routes>
              <Route path="/" element={<Home/>} />
              <Route path="/about" element={<div>This site was made with SolidJS</div>} />
              <Route path="/users" element={<Users/>} />
            </Routes>
        </div>
    </div>
</div>

export const AppWrapper = () => <Router><App/></Router>