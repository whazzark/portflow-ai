import {
  availableLifecycle,
  FIXTURE_REFERENCE_DATE,
  fixtureUuid,
  type LifecycleFactoryState,
} from './shared.js'
import { USER_FIXTURE_IDS } from './users.js'

const values = [
  ['Atlantique Transport Routier', 'available'],
  ['Armor Fret Services', 'available'],
  ['Estuaire Bennes', 'reactivated'],
  ['Grand Ouest Camions', 'available'],
  ['Loire Vrac Transport', 'archived'],
  ['Noroît Logistique', 'archivedNullable'],
] as const

export const TRANSPORT_COMPANY_FIXTURES = values.map(([name, rawState], index) => {
  const state: LifecycleFactoryState = rawState === 'archivedNullable' ? 'archived' : rawState
  const lifecycle =
    rawState === 'archived'
      ? {
          status: 'ARCHIVED' as const,
          archivedAt: FIXTURE_REFERENCE_DATE.minus({ days: 90 }),
          archivedByUserId: USER_FIXTURE_IDS.operationsAdmin,
          archiveComment: 'Provider no longer serves the site',
          reactivatedAt: null,
          reactivatedByUserId: null,
          reactivationComment: null,
        }
      : rawState === 'archivedNullable'
        ? {
            status: 'ARCHIVED' as const,
            archivedAt: FIXTURE_REFERENCE_DATE.minus({ days: 240 }),
            archivedByUserId: null,
            archiveComment: 'Historical provider retained without a resolvable actor',
            reactivatedAt: null,
            reactivatedByUserId: null,
            reactivationComment: null,
          }
        : rawState === 'reactivated'
          ? {
              status: 'AVAILABLE' as const,
              archivedAt: FIXTURE_REFERENCE_DATE.minus({ days: 120 }),
              archivedByUserId: USER_FIXTURE_IDS.operationsAdmin,
              archiveComment: 'Provider temporarily suspended during contract review',
              reactivatedAt: FIXTURE_REFERENCE_DATE.minus({ days: 35 }),
              reactivatedByUserId: USER_FIXTURE_IDS.operationsAdmin,
              reactivationComment: 'Contract renewed for the current season',
            }
          : availableLifecycle()
  return {
    id: fixtureUuid(23500003, index + 1),
    state,
    attributes: {
      name,
      ...lifecycle,
      createdAt: FIXTURE_REFERENCE_DATE.minus({ days: 180 + index * 23 }),
    },
  }
})

export const TRANSPORT_COMPANY_FIXTURE_IDS = {
  atlantic: TRANSPORT_COMPANY_FIXTURES[0].id,
  armor: TRANSPORT_COMPANY_FIXTURES[1].id,
  estuaire: TRANSPORT_COMPANY_FIXTURES[2].id,
  loire: TRANSPORT_COMPANY_FIXTURES[4].id,
} as const
export const TRANSPORT_COMPANY_FIXTURE_EXEMPLARS = {
  available: TRANSPORT_COMPANY_FIXTURES[0],
  reactivated: TRANSPORT_COMPANY_FIXTURES[2],
  archived: TRANSPORT_COMPANY_FIXTURES[4],
} as const
