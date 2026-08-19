import { Decimal } from 'decimal.js'
import {
  availableLifecycle,
  FIXTURE_REFERENCE_DATE,
  fixtureUuid,
  type LifecycleFactoryState,
} from './shared.js'
import { TRANSPORT_COMPANY_FIXTURE_IDS } from './transport_companies.js'
import { USER_FIXTURE_IDS } from './users.js'

const values = [
  ['AA-101-PF', 'Volvo FMX', '32.5', TRANSPORT_COMPANY_FIXTURE_IDS.atlantic, 'available'],
  ['BB-202-PF', null, '28.75', TRANSPORT_COMPANY_FIXTURE_IDS.armor, 'available'],
  ['CC-303-PF', 'Renault Trucks C', '30', TRANSPORT_COMPANY_FIXTURE_IDS.estuaire, 'reactivated'],
  ['ZZ-909-PF', 'Scania XT', '34.25', TRANSPORT_COMPANY_FIXTURE_IDS.loire, 'archived'],
] as const

export const TRUCK_FIXTURES = values.map(
  ([registration, vehicleModel, capacity, transportCompanyId, state], index) => {
    const lifecycle =
      state === 'archived'
        ? {
            status: 'ARCHIVED' as const,
            archivedAt: FIXTURE_REFERENCE_DATE.minus({ days: 60 }),
            archivedByUserId: USER_FIXTURE_IDS.operationsAdmin,
            archiveComment: 'Vehicle retired from the fleet',
            reactivatedAt: null,
            reactivatedByUserId: null,
            reactivationComment: null,
          }
        : state === 'reactivated'
          ? {
              status: 'AVAILABLE' as const,
              archivedAt: FIXTURE_REFERENCE_DATE.minus({ days: 75 }),
              archivedByUserId: USER_FIXTURE_IDS.operationsAdmin,
              archiveComment: 'Vehicle temporarily suspended for fleet maintenance',
              reactivatedAt: FIXTURE_REFERENCE_DATE.minus({ days: 15 }),
              reactivatedByUserId: USER_FIXTURE_IDS.operationsAdmin,
              reactivationComment: 'Vehicle returned to the active fleet',
            }
          : availableLifecycle()
    return {
      id: fixtureUuid(23500008, index + 1),
      state: state as LifecycleFactoryState,
      attributes: {
        registration,
        vehicleModel,
        capacityTonnes: new Decimal(capacity),
        transportCompanyId,
        ...lifecycle,
        createdAt: FIXTURE_REFERENCE_DATE.minus({ days: 150 + index * 20 }),
      },
    }
  },
)

export const TRUCK_FIXTURE_IDS = {
  available: TRUCK_FIXTURES[0].id,
  reactivated: TRUCK_FIXTURES[2].id,
  archived: TRUCK_FIXTURES[3].id,
} as const
export const TRUCK_FIXTURE_EXEMPLARS = {
  available: TRUCK_FIXTURES[0],
  reactivated: TRUCK_FIXTURES[2],
  archived: TRUCK_FIXTURES[3],
} as const
