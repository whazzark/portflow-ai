import { BaseTransformer } from '@adonisjs/core/transformers'

import type Discharge from '#models/discharge'

export default class DischargeTransformer extends BaseTransformer<Discharge> {
  /**
   * The discharge as the browsing screen reads it: what identifies it, what situates it on the
   * site, and how far its preparation has gone. The vessel comment, the lots' quantities and
   * descriptions, and the timestamps stay behind — they belong to the detail screen, and a list
   * that carries them invites a row to grow into one.
   */
  toObject() {
    const discharge = this.pick(this.resource, [
      'id',
      'status',
      'vesselName',
      'vesselImo',
      'expectedStartAt',
    ])

    return {
      ...discharge,
      dock: {
        id: this.resource.dock.id,
        name: this.resource.dock.name,
      },
      productLots: this.resource.productLots.map((productLot) => ({
        id: productLot.id,
        customerId: productLot.customerId,
        customerName: productLot.customer.companyName,
        productName: productLot.productName,
      })),
      // Counted rather than loaded: no shift field is read here, only how many were prepared.
      shiftCount: Number(this.resource.$extras.shifts_count),
    }
  }
}
