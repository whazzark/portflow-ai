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
   */
  abstract findDetail(id: string): Promise<Discharge | null>
}
