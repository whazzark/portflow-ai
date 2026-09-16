import { BaseTransformer } from '@adonisjs/core/transformers'

import type { PlanningOptions } from '#discharges/shared/repositories/discharge_repository'

export default class DischargePlanningOptionsTransformer extends BaseTransformer<PlanningOptions> {
  /**
   * The choices a planning sheet offers. A door carries its warehouse's name, which the warehouses
   * collection keeps to administrators, and the other discharges holding it are named by what the
   * discharges list already shows every role: their vessel, status, and expected start.
   */
  toObject() {
    return {
      warehouseDoors: this.resource.warehouseDoors.map((door) => ({
        id: door.id,
        name: door.name,
        warehouse: door.warehouse,
        otherDischargeAssignments: door.otherDischargeAssignments.map(({ discharge }) => ({
          discharge: {
            id: discharge.id,
            vesselName: discharge.vesselName,
            status: discharge.status,
            expectedStartAt: discharge.expectedStartAt,
          },
        })),
      })),
      weighingAreas: this.resource.weighingAreas,
    }
  }
}
