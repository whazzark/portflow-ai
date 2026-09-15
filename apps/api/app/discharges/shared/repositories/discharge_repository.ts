import type {
  DischargeDetailRead,
  TruckCandidatesRead,
} from '#discharges/shared/discharge_detail_read'
import type Discharge from '#models/discharge'

export default abstract class DischargeRepository {
  /**
   * Every discharge, in every status, in one collection, each with its dock and its product lots
   * with their customers. The number of shifts travels in `$extras.shifts_count`, because
   * `withCount` is what avoids loading shift rows nobody in this slice reads.
   *
   * There is no status filter: the browsing screen splits this into its Planned, Active, and
   * Closed tabs and counts each of them, so filtering here would only make the caller ask three
   * times for what one read already answers.
   */
  abstract list(): Promise<Discharge[]>

  /**
   * One discharge with its whole preparation graph, or `null` when no discharge has this
   * identity. A malformed identity is simply one no discharge has: the caller gets the same
   * `null`, never a database error.
   *
   * Beside the graph come the other planned or active discharges holding each truck this one
   * holds, so every role reading the pool sees which trucks another plan competes for.
   */
  abstract findDetail(id: string): Promise<DischargeDetailRead | null>

  /**
   * The trucks a planned discharge may reserve: every available truck of the site it does not hold,
   * with the other planned or active discharges holding each. Not paginated: a site's trucks are
   * few enough for the page to search them in place, as every other truck collection does.
   */
  abstract listTruckCandidates(dischargeId: string): Promise<TruckCandidatesRead>
}
