/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'health.show': {
    methods: ["GET","HEAD"],
    pattern: '/health',
    tokens: [{"old":"/health","type":0,"val":"health","end":""}],
    types: placeholder as Registry['health.show']['types'],
  },
  'auth.login': {
    methods: ["POST"],
    pattern: '/api/v1/auth/login',
    tokens: [{"old":"/api/v1/auth/login","type":0,"val":"api","end":""},{"old":"/api/v1/auth/login","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/login","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['auth.login']['types'],
  },
  'auth.me': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/auth/me',
    tokens: [{"old":"/api/v1/auth/me","type":0,"val":"api","end":""},{"old":"/api/v1/auth/me","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/me","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/me","type":0,"val":"me","end":""}],
    types: placeholder as Registry['auth.me']['types'],
  },
  'auth.logout': {
    methods: ["POST"],
    pattern: '/api/v1/auth/logout',
    tokens: [{"old":"/api/v1/auth/logout","type":0,"val":"api","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['auth.logout']['types'],
  },
  'customers.store': {
    methods: ["POST"],
    pattern: '/api/v1/customers',
    tokens: [{"old":"/api/v1/customers","type":0,"val":"api","end":""},{"old":"/api/v1/customers","type":0,"val":"v1","end":""},{"old":"/api/v1/customers","type":0,"val":"customers","end":""}],
    types: placeholder as Registry['customers.store']['types'],
  },
  'customers.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/customers',
    tokens: [{"old":"/api/v1/customers","type":0,"val":"api","end":""},{"old":"/api/v1/customers","type":0,"val":"v1","end":""},{"old":"/api/v1/customers","type":0,"val":"customers","end":""}],
    types: placeholder as Registry['customers.index']['types'],
  },
  'customers.available': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/customers/available',
    tokens: [{"old":"/api/v1/customers/available","type":0,"val":"api","end":""},{"old":"/api/v1/customers/available","type":0,"val":"v1","end":""},{"old":"/api/v1/customers/available","type":0,"val":"customers","end":""},{"old":"/api/v1/customers/available","type":0,"val":"available","end":""}],
    types: placeholder as Registry['customers.available']['types'],
  },
  'customers.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/customers/:id',
    tokens: [{"old":"/api/v1/customers/:id","type":0,"val":"api","end":""},{"old":"/api/v1/customers/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/customers/:id","type":0,"val":"customers","end":""},{"old":"/api/v1/customers/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['customers.show']['types'],
  },
  'customers.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/customers/:id',
    tokens: [{"old":"/api/v1/customers/:id","type":0,"val":"api","end":""},{"old":"/api/v1/customers/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/customers/:id","type":0,"val":"customers","end":""},{"old":"/api/v1/customers/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['customers.update']['types'],
  },
  'customers.archive': {
    methods: ["POST"],
    pattern: '/api/v1/customers/:id/archive',
    tokens: [{"old":"/api/v1/customers/:id/archive","type":0,"val":"api","end":""},{"old":"/api/v1/customers/:id/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/customers/:id/archive","type":0,"val":"customers","end":""},{"old":"/api/v1/customers/:id/archive","type":1,"val":"id","end":""},{"old":"/api/v1/customers/:id/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['customers.archive']['types'],
  },
  'customers.reactivate': {
    methods: ["POST"],
    pattern: '/api/v1/customers/:id/reactivate',
    tokens: [{"old":"/api/v1/customers/:id/reactivate","type":0,"val":"api","end":""},{"old":"/api/v1/customers/:id/reactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/customers/:id/reactivate","type":0,"val":"customers","end":""},{"old":"/api/v1/customers/:id/reactivate","type":1,"val":"id","end":""},{"old":"/api/v1/customers/:id/reactivate","type":0,"val":"reactivate","end":""}],
    types: placeholder as Registry['customers.reactivate']['types'],
  },
  'docks.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/docks',
    tokens: [{"old":"/api/v1/docks","type":0,"val":"api","end":""},{"old":"/api/v1/docks","type":0,"val":"v1","end":""},{"old":"/api/v1/docks","type":0,"val":"docks","end":""}],
    types: placeholder as Registry['docks.index']['types'],
  },
  'docks.store': {
    methods: ["POST"],
    pattern: '/api/v1/docks',
    tokens: [{"old":"/api/v1/docks","type":0,"val":"api","end":""},{"old":"/api/v1/docks","type":0,"val":"v1","end":""},{"old":"/api/v1/docks","type":0,"val":"docks","end":""}],
    types: placeholder as Registry['docks.store']['types'],
  },
  'docks.available': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/docks/available',
    tokens: [{"old":"/api/v1/docks/available","type":0,"val":"api","end":""},{"old":"/api/v1/docks/available","type":0,"val":"v1","end":""},{"old":"/api/v1/docks/available","type":0,"val":"docks","end":""},{"old":"/api/v1/docks/available","type":0,"val":"available","end":""}],
    types: placeholder as Registry['docks.available']['types'],
  },
  'docks.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/docks/:id',
    tokens: [{"old":"/api/v1/docks/:id","type":0,"val":"api","end":""},{"old":"/api/v1/docks/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/docks/:id","type":0,"val":"docks","end":""},{"old":"/api/v1/docks/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['docks.show']['types'],
  },
  'docks.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/docks/:id',
    tokens: [{"old":"/api/v1/docks/:id","type":0,"val":"api","end":""},{"old":"/api/v1/docks/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/docks/:id","type":0,"val":"docks","end":""},{"old":"/api/v1/docks/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['docks.update']['types'],
  },
  'docks.archive': {
    methods: ["POST"],
    pattern: '/api/v1/docks/:id/archive',
    tokens: [{"old":"/api/v1/docks/:id/archive","type":0,"val":"api","end":""},{"old":"/api/v1/docks/:id/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/docks/:id/archive","type":0,"val":"docks","end":""},{"old":"/api/v1/docks/:id/archive","type":1,"val":"id","end":""},{"old":"/api/v1/docks/:id/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['docks.archive']['types'],
  },
  'docks.reactivate': {
    methods: ["POST"],
    pattern: '/api/v1/docks/:id/reactivate',
    tokens: [{"old":"/api/v1/docks/:id/reactivate","type":0,"val":"api","end":""},{"old":"/api/v1/docks/:id/reactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/docks/:id/reactivate","type":0,"val":"docks","end":""},{"old":"/api/v1/docks/:id/reactivate","type":1,"val":"id","end":""},{"old":"/api/v1/docks/:id/reactivate","type":0,"val":"reactivate","end":""}],
    types: placeholder as Registry['docks.reactivate']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
