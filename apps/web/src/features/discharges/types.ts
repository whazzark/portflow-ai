import type { Route } from '@tuyau/core/types'

export type DischargeDto = Route.Response<'discharges.index'>['data'][number]
export type DischargeProductLotDto = DischargeDto['productLots'][number]

export type DischargeDetailDto = Route.Response<'discharges.show'>['data']
export type DischargeOtherHoldingDto =
  DischargeDetailDto['truckPool'][number]['otherHoldings'][number]

/** A truck a planned discharge may reserve, with the other discharges already holding it. */
export type TruckCandidateDto = Route.Response<'discharges.truck_pool.candidates'>['data'][number]

/** What a preparer may choose when planning doors and checkpoints. */
export type DischargePlanningOptionsDto = Route.Response<'discharges.planning_options'>['data']
export type PlanningDoorDto = DischargePlanningOptionsDto['warehouseDoors'][number]

/** What a start would answer now: the shift that would start and every reason it cannot. */
export type StartCheckDto = Route.Response<'discharges.start_check'>['data']
export type StartProblemDto = StartCheckDto['problems'][number]

/** The `meta` of a refused start, which error responses do not type. */
export type StartRefusedMeta = Pick<StartCheckDto, 'shiftId' | 'problems'>

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
