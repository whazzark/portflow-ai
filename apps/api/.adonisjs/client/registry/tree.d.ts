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
    archiveMany: typeof routes['transport_companies.archive_many']
    reactivateMany: typeof routes['transport_companies.reactivate_many']
    archive: typeof routes['transport_companies.archive']
    reactivate: typeof routes['transport_companies.reactivate']
  }
  trucks: {
    index: typeof routes['trucks.index']
    available: typeof routes['trucks.available']
    suspended: typeof routes['trucks.suspended']
    store: typeof routes['trucks.store']
    update: typeof routes['trucks.update']
    archiveMany: typeof routes['trucks.archive_many']
    archive: typeof routes['trucks.archive']
    reactivateMany: typeof routes['trucks.reactivate_many']
    reactivate: typeof routes['trucks.reactivate']
    suspend: typeof routes['trucks.suspend']
    returnToService: typeof routes['trucks.return_to_service']
  }
  docks: {
    index: typeof routes['docks.index']
    store: typeof routes['docks.store']
    available: typeof routes['docks.available']
    update: typeof routes['docks.update']
    archiveMany: typeof routes['docks.archive_many']
    archive: typeof routes['docks.archive']
    reactivateMany: typeof routes['docks.reactivate_many']
    reactivate: typeof routes['docks.reactivate']
  }
  weighingAreas: {
    index: typeof routes['weighing_areas.index']
    store: typeof routes['weighing_areas.store']
    available: typeof routes['weighing_areas.available']
    update: typeof routes['weighing_areas.update']
    archiveMany: typeof routes['weighing_areas.archive_many']
    archive: typeof routes['weighing_areas.archive']
    reactivateMany: typeof routes['weighing_areas.reactivate_many']
    reactivate: typeof routes['weighing_areas.reactivate']
  }
  warehouseDoors: {
    available: typeof routes['warehouse_doors.available']
  }
  warehouses: {
    index: typeof routes['warehouses.index']
    store: typeof routes['warehouses.store']
  }
}
