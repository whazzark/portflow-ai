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
    'customers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customers.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customers.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'docks.index': { paramsTuple?: []; params?: {} }
    'docks.store': { paramsTuple?: []; params?: {} }
    'docks.available': { paramsTuple?: []; params?: {} }
    'docks.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'docks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'docks.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'docks.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'weighingAreas.index': { paramsTuple?: []; params?: {} }
    'weighingAreas.store': { paramsTuple?: []; params?: {} }
    'weighingAreas.available': { paramsTuple?: []; params?: {} }
    'weighingAreas.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'weighingAreas.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'weighingAreas.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'weighingAreas.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'health.show': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'customers.index': { paramsTuple?: []; params?: {} }
    'customers.available': { paramsTuple?: []; params?: {} }
    'customers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'docks.index': { paramsTuple?: []; params?: {} }
    'docks.available': { paramsTuple?: []; params?: {} }
    'docks.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'weighingAreas.index': { paramsTuple?: []; params?: {} }
    'weighingAreas.available': { paramsTuple?: []; params?: {} }
    'weighingAreas.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  HEAD: {
    'health.show': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'customers.index': { paramsTuple?: []; params?: {} }
    'customers.available': { paramsTuple?: []; params?: {} }
    'customers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'docks.index': { paramsTuple?: []; params?: {} }
    'docks.available': { paramsTuple?: []; params?: {} }
    'docks.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'weighingAreas.index': { paramsTuple?: []; params?: {} }
    'weighingAreas.available': { paramsTuple?: []; params?: {} }
    'weighingAreas.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  POST: {
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'customers.store': { paramsTuple?: []; params?: {} }
    'customers.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customers.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'docks.store': { paramsTuple?: []; params?: {} }
    'docks.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'docks.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'weighingAreas.store': { paramsTuple?: []; params?: {} }
    'weighingAreas.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'weighingAreas.reactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'customers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'docks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'weighingAreas.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}