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
  transportCompanies: {
    store: typeof routes['transport_companies.store']
    index: typeof routes['transport_companies.index']
    available: typeof routes['transport_companies.available']
    update: typeof routes['transport_companies.update']
  }
  trucks: {
    index: typeof routes['trucks.index']
    available: typeof routes['trucks.available']
    store: typeof routes['trucks.store']
    update: typeof routes['trucks.update']
  }
  docks: {
    index: typeof routes['docks.index']
    store: typeof routes['docks.store']
    available: typeof routes['docks.available']
    update: typeof routes['docks.update']
    archive: typeof routes['docks.archive']
    reactivate: typeof routes['docks.reactivate']
  }
  weighingAreas: {
    index: typeof routes['weighing_areas.index']
    store: typeof routes['weighing_areas.store']
    available: typeof routes['weighing_areas.available']
    update: typeof routes['weighing_areas.update']
    archive: typeof routes['weighing_areas.archive']
    reactivate: typeof routes['weighing_areas.reactivate']
  }
  warehouseDoors: {
    available: typeof routes['warehouse_doors.available']
  }
  warehouses: {
    index: typeof routes['warehouses.index']
  }
}
