import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'health.show': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'customers.store': { paramsTuple?: []; params?: {} }
    'customers.index': { paramsTuple?: []; params?: {} }
    'customers.available': { paramsTuple?: []; params?: {} }
    'customers.archive_many': { paramsTuple?: []; params?: {} }
    'customers.reactivate_many': { paramsTuple?: []; params?: {} }
    'customers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customers.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customers.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transport_companies.store': { paramsTuple?: []; params?: {} }
    'transport_companies.index': { paramsTuple?: []; params?: {} }
    'transport_companies.available': { paramsTuple?: []; params?: {} }
    'transport_companies.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transport_companies.archive_many': { paramsTuple?: []; params?: {} }
    'transport_companies.reactivate_many': { paramsTuple?: []; params?: {} }
    'transport_companies.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transport_companies.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'trucks.index': { paramsTuple?: []; params?: {} }
    'trucks.available': { paramsTuple?: []; params?: {} }
    'trucks.suspended': { paramsTuple?: []; params?: {} }
    'trucks.store': { paramsTuple?: []; params?: {} }
    'trucks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'trucks.archive_many': { paramsTuple?: []; params?: {} }
    'trucks.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'trucks.reactivate_many': { paramsTuple?: []; params?: {} }
    'trucks.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'trucks.suspend': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'docks.index': { paramsTuple?: []; params?: {} }
    'docks.store': { paramsTuple?: []; params?: {} }
    'docks.available': { paramsTuple?: []; params?: {} }
    'docks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'docks.archive_many': { paramsTuple?: []; params?: {} }
    'docks.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'docks.reactivate_many': { paramsTuple?: []; params?: {} }
    'docks.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'weighing_areas.index': { paramsTuple?: []; params?: {} }
    'weighing_areas.store': { paramsTuple?: []; params?: {} }
    'weighing_areas.available': { paramsTuple?: []; params?: {} }
    'weighing_areas.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'weighing_areas.archive_many': { paramsTuple?: []; params?: {} }
    'weighing_areas.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'weighing_areas.reactivate_many': { paramsTuple?: []; params?: {} }
    'weighing_areas.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'warehouse_doors.available': { paramsTuple?: []; params?: {} }
    'warehouses.index': { paramsTuple?: []; params?: {} }
    'warehouses.store': { paramsTuple?: []; params?: {} }
    'warehouses.archive_many': { paramsTuple?: []; params?: {} }
    'warehouses.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'warehouses.reactivate_many': { paramsTuple?: []; params?: {} }
    'warehouses.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'health.show': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'customers.index': { paramsTuple?: []; params?: {} }
    'customers.available': { paramsTuple?: []; params?: {} }
    'transport_companies.index': { paramsTuple?: []; params?: {} }
    'transport_companies.available': { paramsTuple?: []; params?: {} }
    'trucks.index': { paramsTuple?: []; params?: {} }
    'trucks.available': { paramsTuple?: []; params?: {} }
    'trucks.suspended': { paramsTuple?: []; params?: {} }
    'docks.index': { paramsTuple?: []; params?: {} }
    'docks.available': { paramsTuple?: []; params?: {} }
    'weighing_areas.index': { paramsTuple?: []; params?: {} }
    'weighing_areas.available': { paramsTuple?: []; params?: {} }
    'warehouse_doors.available': { paramsTuple?: []; params?: {} }
    'warehouses.index': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'health.show': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'customers.index': { paramsTuple?: []; params?: {} }
    'customers.available': { paramsTuple?: []; params?: {} }
    'transport_companies.index': { paramsTuple?: []; params?: {} }
    'transport_companies.available': { paramsTuple?: []; params?: {} }
    'trucks.index': { paramsTuple?: []; params?: {} }
    'trucks.available': { paramsTuple?: []; params?: {} }
    'trucks.suspended': { paramsTuple?: []; params?: {} }
    'docks.index': { paramsTuple?: []; params?: {} }
    'docks.available': { paramsTuple?: []; params?: {} }
    'weighing_areas.index': { paramsTuple?: []; params?: {} }
    'weighing_areas.available': { paramsTuple?: []; params?: {} }
    'warehouse_doors.available': { paramsTuple?: []; params?: {} }
    'warehouses.index': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'customers.store': { paramsTuple?: []; params?: {} }
    'customers.archive_many': { paramsTuple?: []; params?: {} }
    'customers.reactivate_many': { paramsTuple?: []; params?: {} }
    'customers.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customers.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transport_companies.store': { paramsTuple?: []; params?: {} }
    'transport_companies.archive_many': { paramsTuple?: []; params?: {} }
    'transport_companies.reactivate_many': { paramsTuple?: []; params?: {} }
    'transport_companies.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transport_companies.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'trucks.store': { paramsTuple?: []; params?: {} }
    'trucks.archive_many': { paramsTuple?: []; params?: {} }
    'trucks.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'trucks.reactivate_many': { paramsTuple?: []; params?: {} }
    'trucks.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'trucks.suspend': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'docks.store': { paramsTuple?: []; params?: {} }
    'docks.archive_many': { paramsTuple?: []; params?: {} }
    'docks.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'docks.reactivate_many': { paramsTuple?: []; params?: {} }
    'docks.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'weighing_areas.store': { paramsTuple?: []; params?: {} }
    'weighing_areas.archive_many': { paramsTuple?: []; params?: {} }
    'weighing_areas.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'weighing_areas.reactivate_many': { paramsTuple?: []; params?: {} }
    'weighing_areas.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'warehouses.store': { paramsTuple?: []; params?: {} }
    'warehouses.archive_many': { paramsTuple?: []; params?: {} }
    'warehouses.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'warehouses.reactivate_many': { paramsTuple?: []; params?: {} }
    'warehouses.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'customers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transport_companies.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'trucks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'docks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'weighing_areas.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}