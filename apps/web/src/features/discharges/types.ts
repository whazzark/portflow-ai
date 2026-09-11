import type { Route } from '@tuyau/core/types'

export type DischargeDto = Route.Response<'discharges.index'>['data'][number]
export type DischargeProductLotDto = DischargeDto['productLots'][number]

export type DischargeDetailDto = Route.Response<'discharges.show'>['data']

/** The three tabs, lower-cased for the address; the API's own vocabulary is uppercase. */
export const DISCHARGE_STATUS_FILTERS = ['planned', 'active', 'closed'] as const
export type DischargeStatusFilter = (typeof DISCHARGE_STATUS_FILTERS)[number]

export const DISCHARGE_STATUS_BY_FILTER = {
  active: 'ACTIVE',
  closed: 'CLOSED',
  planned: 'PLANNED',
} as const satisfies Record<DischargeStatusFilter, DischargeDto['status']>
