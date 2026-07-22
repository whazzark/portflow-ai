/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  health: {
    show: typeof routes['health.show']
  }
  auth: {
    login: typeof routes['auth.login']
    me: typeof routes['auth.me']
    logout: typeof routes['auth.logout']
  }
  customers: {
    store: typeof routes['customers.store']
    index: typeof routes['customers.index']
    available: typeof routes['customers.available']
    show: typeof routes['customers.show']
    update: typeof routes['customers.update']
    archive: typeof routes['customers.archive']
    reactivate: typeof routes['customers.reactivate']
  }
}
