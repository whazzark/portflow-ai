import {
  availableLifecycle,
  FIXTURE_REFERENCE_DATE,
  fixtureUuid,
  type LifecycleFactoryState,
} from './shared.js'
import { USER_FIXTURE_IDS } from './users.js'

const values = [
  [
    'Atlantique Transport Routier',
    'available',
    '+33 2 40 12 34 56',
    'dispatch@atlantique-transport.test',
  ],
  ['Armor Fret Services', 'available', '+33 2 96 45 67 89', 'contact@armor-fret.test'],
  ['Estuaire Bennes', 'reactivated', '02.40.55.12.34', 'exploitation@estuaire-bennes.test'],
  ['Grand Ouest Camions', 'available', '(02) 51-22-33-44', 'dispatch@grand-ouest-camions.test'],
  ['Loire Vrac Transport', 'archived', '+33 2 41 33 22 11', 'contact@loire-vrac.test'],
  // Deliberately carries no contact details: the seeded stand-in for an archived company
  // registered before this feature, so FR-018's grandfathering and the "not recorded" display
  // state have a real row to exercise on a read-only record, not only hand-built test rows.
  ['Noroît Logistique', 'archivedNullable', null, null],
  // The same stand-in, but AVAILABLE: demonstrates that updating a pre-existing company with no
  // contact details requires supplying both on the next edit (FR-018), which an archived company
  // cannot demonstrate since it offers no edit affordance at all.
  ['Kernévez Fret', 'available', null, null],
] as const

export const TRANSPORT_COMPANY_FIXTURES = values.map(
  ([name, rawState, contactPhone, contactEmail], index) => {
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
        contactPhone,
        contactEmail,
        ...lifecycle,
        createdAt: FIXTURE_REFERENCE_DATE.minus({ days: 180 + index * 23 }),
      },
    }
  },
)

export const TRANSPORT_COMPANY_FIXTURE_IDS = {
  atlantic: TRANSPORT_COMPANY_FIXTURES[0].id,
  armor: TRANSPORT_COMPANY_FIXTURES[1].id,
  estuaire: TRANSPORT_COMPANY_FIXTURES[2].id,
  loire: TRANSPORT_COMPANY_FIXTURES[4].id,
  // Registered before this feature: no contact details recorded. Archived.
  noroit: TRANSPORT_COMPANY_FIXTURES[5].id,
  // Registered before this feature: no contact details recorded. Available, so it can still be
  // edited — demonstrating that its next update must supply both contact fields.
  kernevez: TRANSPORT_COMPANY_FIXTURES[6].id,
} as const
export const TRANSPORT_COMPANY_FIXTURE_EXEMPLARS = {
  available: TRANSPORT_COMPANY_FIXTURES[0],
  reactivated: TRANSPORT_COMPANY_FIXTURES[2],
  archived: TRANSPORT_COMPANY_FIXTURES[4],
} as const
