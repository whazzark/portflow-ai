import type { Route } from '@tuyau/core/types'

export type TruckDto = Route.Response<'trucks.index'>['data'][number]
export type AvailableTruckDto = Route.Response<'trucks.available'>['data'][number]
export type TruckLifecycle = 'available' | 'archived'
