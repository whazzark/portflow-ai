import { Decimal } from 'decimal.js'
import type { DateTime } from 'luxon'
import {
  availableLifecycle,
  FIXTURE_REFERENCE_DATE,
  fixtureUuid,
  type LifecycleAttributes,
  type LifecycleFactoryState,
} from './shared.js'
import { TRANSPORT_COMPANY_FIXTURE_IDS } from './transport_companies.js'
import { USER_FIXTURE_IDS } from './users.js'

/**
 * Only trucks can be suspended, so the shape stays local rather than widening the
 * `LifecycleAttributes` that every other site reference shares.
 */
type TruckLifecycleAttributes = Omit<LifecycleAttributes, 'status'> & {
  status: 'AVAILABLE' | 'ARCHIVED' | 'SUSPENDED'
  suspendedAt: DateTime | null
  suspendedByUserId: string | null
  suspensionComment: string | null
}

const noSuspension = {
  suspendedAt: null,
  suspendedByUserId: null,
  suspensionComment: null,
} as const

type TruckFixtureState = LifecycleFactoryState | 'suspended'

const values = [
  ['AA-101-PF', 'Volvo FMX', '32.5', TRANSPORT_COMPANY_FIXTURE_IDS.atlantic, 'available'],
  ['BB-202-PF', null, '28.75', TRANSPORT_COMPANY_FIXTURE_IDS.armor, 'available'],
  ['CC-303-PF', 'Renault Trucks C', '30', TRANSPORT_COMPANY_FIXTURE_IDS.estuaire, 'reactivated'],
  ['ZZ-909-PF', 'Scania XT', '34.25', TRANSPORT_COMPANY_FIXTURE_IDS.loire, 'archived'],
  ['DD-404-PF', 'MAN TGS', '31.5', TRANSPORT_COMPANY_FIXTURE_IDS.atlantic, 'suspended'],
] as const

export const TRUCK_FIXTURES = values.map(
  ([registration, vehicleModel, capacity, transportCompanyId, state], index) => {
    const lifecycle: TruckLifecycleAttributes =
      state === 'archived'
        ? {
            status: 'ARCHIVED' as const,
            archivedAt: FIXTURE_REFERENCE_DATE.minus({ days: 60 }),
            archivedByUserId: USER_FIXTURE_IDS.operationsAdmin,
            archiveComment: 'Vehicle retired from the fleet',
            reactivatedAt: null,
            reactivatedByUserId: null,
            reactivationComment: null,
            ...noSuspension,
          }
        : state === 'suspended'
          ? {
              status: 'SUSPENDED' as const,
              archivedAt: null,
              archivedByUserId: null,
              archiveComment: null,
              reactivatedAt: null,
              reactivatedByUserId: null,
              reactivationComment: null,
              suspendedAt: FIXTURE_REFERENCE_DATE.minus({ days: 5 }),
              suspendedByUserId: USER_FIXTURE_IDS.operationsAdmin,
              suspensionComment: 'Gearbox failure, awaiting workshop slot',
            }
          : state === 'reactivated'
            ? {
                status: 'AVAILABLE' as const,
                archivedAt: FIXTURE_REFERENCE_DATE.minus({ days: 75 }),
                archivedByUserId: USER_FIXTURE_IDS.operationsAdmin,
                // Deliberately a retirement reason: a temporary immobilisation is now modelled by
                // the SUSPENDED state, not by archiving and reactivating the truck.
                archiveComment: 'Vehicle withdrawn pending fleet review',
                reactivatedAt: FIXTURE_REFERENCE_DATE.minus({ days: 15 }),
                reactivatedByUserId: USER_FIXTURE_IDS.operationsAdmin,
                reactivationComment: 'Vehicle returned to the active fleet',
                ...noSuspension,
              }
            : { ...availableLifecycle(), ...noSuspension }
    return {
      id: fixtureUuid(23500008, index + 1),
      state: state as TruckFixtureState,
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
  suspended: TRUCK_FIXTURES[4].id,
} as const
export const TRUCK_FIXTURE_EXEMPLARS = {
  available: TRUCK_FIXTURES[0],
  reactivated: TRUCK_FIXTURES[2],
  archived: TRUCK_FIXTURES[3],
  suspended: TRUCK_FIXTURES[4],
} as const
