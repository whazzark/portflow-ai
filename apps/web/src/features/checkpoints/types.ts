import type { Route } from '@tuyau/core/types'

export type DockDto = Route.Response<'docks.index'>['data'][number]
export type WeighingAreaDto = Route.Response<'weighingAreas.index'>['data'][number]
