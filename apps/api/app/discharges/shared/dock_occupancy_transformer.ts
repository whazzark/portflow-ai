import { BaseTransformer } from '@adonisjs/core/transformers'

import type { DockOccupancyRead } from '#discharges/shared/repositories/discharge_repository'

export default class DockOccupancyTransformer extends BaseTransformer<DockOccupancyRead> {
  /**
   * Another discharge holding a dock, named by what the discharges list already shows every role,
   * over the period its shifts are planned for.
   */
  toObject() {
    return {
      discharge: {
        id: this.resource.discharge.id,
        vesselName: this.resource.discharge.vesselName,
        status: this.resource.discharge.status,
      },
      startAt: this.resource.startAt.toUTC().toISO() as string,
      endAt: this.resource.endAt.toUTC().toISO() as string,
    }
  }
}
