import type { Route } from '@tuyau/core/types'

export type DockDto = Route.Response<'docks.index'>['data'][number]
export type BulkDockLifecycleResult = Route.Response<'docks.archive_many'>['data']
export type BulkDockLifecycleBlocker = BulkDockLifecycleResult['blockedDocks'][number]
