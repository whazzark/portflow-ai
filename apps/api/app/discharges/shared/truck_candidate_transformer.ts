import { BaseTransformer } from '@adonisjs/core/transformers'

import type { TruckCandidate } from '#discharges/shared/discharge_detail_read'

/**
 * A truck offered for reservation. Its registration and company are current, unlike a pool
 * entry's captured ones: nothing has been reserved yet.
 */
export default class TruckCandidateTransformer extends BaseTransformer<TruckCandidate> {
  toObject() {
    return {
      id: this.resource.id,
      registration: this.resource.registration,
      transportCompany: {
        id: this.resource.transportCompany.id,
        name: this.resource.transportCompany.name,
      },
      otherHoldings: this.resource.otherHoldings.map((holding) => ({
        dischargeId: holding.dischargeId,
        vesselName: holding.vesselName,
        status: holding.status,
      })),
    }
  }
}
