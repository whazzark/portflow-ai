import type { Route } from '@tuyau/core/types'

export type WeighingAreaDto = Route.Response<'weighing_areas.index'>['data'][number]
export type BulkWeighingAreaLifecycleResult = Route.Response<'weighing_areas.archive_many'>['data']
export type BulkWeighingAreaLifecycleBlocker =
  BulkWeighingAreaLifecycleResult['blockedWeighingAreas'][number]
