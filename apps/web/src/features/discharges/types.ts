import type { Route } from '@tuyau/core/types'

export type DischargeDto = Route.Response<'discharges.index'>['data'][number]
export type DischargeProductLotDto = DischargeDto['productLots'][number]

export type DischargeDetailDto = Route.Response<'discharges.show'>['data']
export type DischargeOtherHoldingDto =
  DischargeDetailDto['truckPool'][number]['otherHoldings'][number]

/** A truck a planned discharge may reserve, with the other discharges already holding it. */
export type TruckCandidateDto = Route.Response<'discharges.truck_pool.candidates'>['data'][number]

/** The three tabs, lower-cased for the address; the API's own vocabulary is uppercase. */
export const DISCHARGE_STATUS_FILTERS = ['planned', 'active', 'closed'] as const
export type DischargeStatusFilter = (typeof DISCHARGE_STATUS_FILTERS)[number]

/** The sections of a discharge's page, in preparation order: the truck pool feeds the shifts. */
export const DISCHARGE_DETAIL_TABS = ['overview', 'product-lots', 'truck-pool', 'shifts'] as const
export type DischargeDetailTab = (typeof DISCHARGE_DETAIL_TABS)[number]

export const DISCHARGE_STATUS_BY_FILTER = {
  active: 'ACTIVE',
  closed: 'CLOSED',
  planned: 'PLANNED',
} as const satisfies Record<DischargeStatusFilter, DischargeDto['status']>
