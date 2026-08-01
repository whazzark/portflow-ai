import type { Route } from '@tuyau/core/types'

export type DockDto = Route.Response<'docks.index'>['data'][number]
