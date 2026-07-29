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
    archiveMany: typeof routes['customers.archive_many']
    reactivateMany: typeof routes['customers.reactivate_many']
    update: typeof routes['customers.update']
    archive: typeof routes['customers.archive']
    reactivate: typeof routes['customers.reactivate']
  }
  docks: {
    index: typeof routes['docks.index']
    store: typeof routes['docks.store']
    available: typeof routes['docks.available']
    show: typeof routes['docks.show']
    update: typeof routes['docks.update']
    archive: typeof routes['docks.archive']
    reactivate: typeof routes['docks.reactivate']
  }
  weighingAreas: {
    index: typeof routes['weighingAreas.index']
    store: typeof routes['weighingAreas.store']
    available: typeof routes['weighingAreas.available']
    show: typeof routes['weighingAreas.show']
    update: typeof routes['weighingAreas.update']
    archive: typeof routes['weighingAreas.archive']
    reactivate: typeof routes['weighingAreas.reactivate']
  }
}
