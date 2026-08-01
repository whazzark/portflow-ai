import type { Route } from '@tuyau/core/types'

export type WeighingAreaDto = Route.Response<'weighing_areas.index'>['data'][number]
