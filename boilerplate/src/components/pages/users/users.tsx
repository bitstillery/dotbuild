import * as React from 'voby'
import {$s} from '@/app'

export const Users = (): JSX.Element => {  
    return <div>
      <h1>Users</h1>
      <div>
        Some table...
        {$s.users.map((i) => {
            return <div>{i.name}</div>          
        })}
      </div>
    </div>
}