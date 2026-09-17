import type { DateTime } from 'luxon'

import type DischargeStartRepository from '#discharges/shared/repositories/discharge_start_repository'
import type { ActivationResult } from '#discharges/shared/repositories/discharge_start_repository'

export const DISCHARGE_ID = '44444444-4444-4444-8444-444444444444'
export const DOCK_ID = '11111111-1111-4111-8111-111111111111'
export const SHIFT_ID = '88888888-8888-4888-8888-888888888888'
export const USER_ID = '99999999-9999-4999-8999-999999999999'
const LOT_ID = '22222222-2222-4222-8222-222222222222'
const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333'
const TRUCK_ID = '13131313-1313-4313-8313-131313131313'
const DOOR_ID = '14141414-1414-4414-8414-141414141414'
const AREA_ID = '15151515-1515-4515-8515-151515151515'

/**
 * A start repository over a discharge that can start: one lot with a door, one held truck, and a
 * first shift using them and a weighing area under an eligible responsible, with nothing held
 * elsewhere. Each call is recorded by name, reads with their mode.
 */
export function readyStartRepository(
  calls: string[],
  activations: Array<{ shiftId: string; userId: string; instant: DateTime }>,
  activation: ActivationResult = { kind: 'ACTIVATED' },
) {
  return {
    findDischarge: () => {
      calls.push('findDischarge')
      return Promise.resolve({ id: DISCHARGE_ID, status: 'PLANNED', dockId: DOCK_ID })
    },
    readStartPlan: () => {
      calls.push('readStartPlan')
      return Promise.resolve({
        lots: [{ id: LOT_ID, customerId: CUSTOMER_ID }],
        currentAssignments: [{ productLotId: LOT_ID, warehouseDoorId: DOOR_ID }],
        heldTruckIds: [TRUCK_ID],
        firstShift: {
          id: SHIFT_ID,
          responsibleUserId: USER_ID,
          truckIds: [TRUCK_ID],
          warehouseDoorIds: [DOOR_ID],
          weighingAreaIds: [AREA_ID],
        },
      })
    },
    readReferences: (_ids: unknown, mode: string) => {
      calls.push(`readReferences:${mode}`)
      return Promise.resolve({
        dock: { id: DOCK_ID, status: 'AVAILABLE' },
        customers: new Map([[CUSTOMER_ID, 'AVAILABLE']]),
        users: new Map([[USER_ID, { accessStatus: 'ACTIVE', role: 'OPERATIONS_LEAD' }]]),
        trucks: new Map([[TRUCK_ID, 'AVAILABLE']]),
        warehouseDoors: new Map([[DOOR_ID, { status: 'AVAILABLE', warehouseStatus: 'AVAILABLE' }]]),
        weighingAreas: new Map([[AREA_ID, 'AVAILABLE']]),
      })
    },
    findActiveHolders: () => {
      calls.push('findActiveHolders')
      return Promise.resolve({ dock: null, trucks: new Map(), doors: new Map() })
    },
    activate: (command: { shiftId: string; userId: string; instant: DateTime }) => {
      calls.push('activate')
      activations.push(command)
      return Promise.resolve(activation)
    },
  } as unknown as DischargeStartRepository
}
