import Discharge from '#models/discharge'

import DischargeRepository from './discharge_repository.ts'

export default class LucidDischargeRepository extends DischargeRepository {
  /**
   * Ordered by expected start ascending, with the identity breaking ties. The direction the user
   * reads is a per-tab choice the browsing screen makes; what has to be authoritative here is that
   * two discharges expected at the same minute never swap places between two reads. The lots are
   * ordered on the same terms: unordered, Postgres is free to return them differently between two
   * reads, and the row's customers are read off that order.
   */
  list(): Promise<Discharge[]> {
    return Discharge.query()
      .preload('dock')
      .preload('productLots', (productLots) => productLots.preload('customer').orderBy('id', 'asc'))
      .withCount('shifts')
      .orderBy('expectedStartAt', 'asc')
      .orderBy('id', 'asc')
  }
}
