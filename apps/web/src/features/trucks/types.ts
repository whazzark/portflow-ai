import type { Route } from '@tuyau/core/types'

export type TruckDto = Route.Response<'trucks.index'>['data'][number]
export type AvailableTruckDto = Route.Response<'trucks.available'>['data'][number]
/** Narrower than `TruckDto`: the suspended collection withholds the lifecycle actors. */
export type SuspendedTruckDto = Route.Response<'trucks.suspended'>['data'][number]
export type TruckLifecycle = 'available' | 'suspended' | 'archived'
export type BulkTruckLifecycleResult = Route.Response<'trucks.archive_many'>['data']
export type BulkTruckLifecycleBlocker = BulkTruckLifecycleResult['blockedTrucks'][number]
