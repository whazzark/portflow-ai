import type { SessionUser } from '@/features/auth/context/session-context'
import type { DischargeDto } from '@/features/discharges/types'

export const API_BASE_URL = 'http://localhost:3333'

export const ACTIVE_OBSERVER: SessionUser = {
  id: 'observer-1',
  firstName: 'Olivia',
  lastName: 'Observer',
  email: 'observer@portflow.test',
  role: 'OBSERVER',
  accessStatus: 'ACTIVE',
  invitedAt: null,
  activatedAt: '2026-01-01T00:00:00.000Z',
  cancelledAt: null,
  deactivatedAt: null,
  reactivatedAt: null,
  invitedByUserId: null,
  activatedByUserId: null,
  cancelledByUserId: null,
  deactivatedByUserId: null,
  reactivatedByUserId: null,
  passwordRenewalRequired: false,
}

export const ACTIVE_OPERATIONS_LEAD: SessionUser = {
  ...ACTIVE_OBSERVER,
  id: 'lead-1',
  email: 'lead@portflow.test',
  role: 'OPERATIONS_LEAD',
}

export const ACTIVE_OPERATIONS_ADMIN: SessionUser = {
  ...ACTIVE_OBSERVER,
  id: 'operations-admin-1',
  email: 'operations-admin@portflow.test',
  role: 'OPERATIONS_ADMIN',
}

export const ACTIVE_ORGANIZATION_ADMIN: SessionUser = {
  ...ACTIVE_OBSERVER,
  id: 'admin-1',
  email: 'admin@portflow.test',
  role: 'ORGANIZATION_ADMIN',
}

export const ACTIVE_ROLES = [
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_LEAD,
  ACTIVE_OPERATIONS_ADMIN,
  ACTIVE_ORGANIZATION_ADMIN,
]

/**
 * Ordered as the API returns them: expected start ascending. The screen is what reverses the
 * closed collection, so the fixture must not pre-sort for it.
 */
const UNSORTED_DISCHARGES: DischargeDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000005',
    status: 'CLOSED',
    vesselName: 'MV Loire Star',
    vesselImo: '9410004',
    expectedStartAt: '2026-07-01T06:00:00.000Z',
    dock: { id: 'dock-sud', name: 'Quai Sud' },
    productLots: [
      {
        id: 'lot-5',
        customerId: 'customer-soufflet',
        customerName: 'Soufflet Négoce',
        productName: 'Colza',
      },
    ],
    shiftCount: 2,
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    status: 'CLOSED',
    vesselName: 'MV Loire Star',
    vesselImo: '9410003',
    expectedStartAt: '2026-08-01T06:00:00.000Z',
    dock: { id: 'dock-nord', name: 'Quai Nord' },
    productLots: [
      {
        id: 'lot-4',
        customerId: 'customer-cargill',
        customerName: 'Cargill France',
        productName: 'Blé tendre',
      },
    ],
    shiftCount: 4,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    status: 'ACTIVE',
    vesselName: 'MV Ocean Cedar',
    vesselImo: '9410002',
    expectedStartAt: '2026-09-08T05:00:00.000Z',
    dock: { id: 'dock-est', name: 'Quai Est' },
    productLots: [
      {
        id: 'lot-2',
        customerId: 'customer-soufflet',
        customerName: 'Soufflet Négoce',
        productName: 'Maïs',
      },
      {
        id: 'lot-3',
        customerId: 'customer-cargill',
        customerName: 'Cargill France',
        productName: 'Orge fourragère',
      },
    ],
    shiftCount: 3,
  },
  {
    // No IMO, no lot, no shift: a discharge only just planned.
    id: '00000000-0000-4000-8000-000000000002',
    status: 'PLANNED',
    vesselName: 'MV Baltic Star',
    vesselImo: null,
    expectedStartAt: '2026-09-20T07:00:00.000Z',
    dock: { id: 'dock-sud', name: 'Quai Sud' },
    productLots: [],
    shiftCount: 0,
  },
  {
    id: '00000000-0000-4000-8000-000000000001',
    status: 'PLANNED',
    vesselName: 'MV Atlantic Dawn',
    vesselImo: '9410001',
    expectedStartAt: '2026-10-01T06:00:00.000Z',
    dock: { id: 'dock-nord', name: 'Quai Nord' },
    productLots: [
      {
        id: 'lot-1',
        customerId: 'customer-cargill',
        customerName: 'Cargill France',
        productName: 'Blé tendre',
      },
    ],
    shiftCount: 2,
  },
]

export const DISCHARGES: DischargeDto[] = [...UNSORTED_DISCHARGES].sort((left, right) =>
  (left.expectedStartAt ?? '').localeCompare(right.expectedStartAt ?? ''),
)
