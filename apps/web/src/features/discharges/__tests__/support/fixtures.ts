import type { SessionUser } from '@/features/auth/context/session-context'
import type { DischargeDetailDto, DischargeDto } from '@/features/discharges/types'

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

/**
 * A complete detail for one listed discharge, sharing its identity and vessel so a row opens its
 * own detail. Sections a test does not care about stay at their plain defaults; a test that does
 * passes them in `overrides`.
 */
export function buildDischargeDetail(
  listed: DischargeDto,
  overrides: Partial<DischargeDetailDto> = {},
): DischargeDetailDto {
  return {
    id: listed.id,
    status: listed.status,
    vesselName: listed.vesselName,
    vesselImo: listed.vesselImo,
    vesselComment: null,
    expectedStartAt: listed.expectedStartAt ?? '2026-10-01T06:00:00.000Z',
    expectedTonnage: '0.000',
    dock: { ...listed.dock, status: 'AVAILABLE' },
    productLots: [],
    shifts: [],
    truckPool: [],
    ...overrides,
  }
}

type DetailPoolEntry = DischargeDetailDto['truckPool'][number]

export function buildPoolEntry(overrides: Partial<DetailPoolEntry> = {}): DetailPoolEntry {
  return {
    id: 'pool-1',
    truckId: 'truck-1',
    registration: 'AB-123-CD',
    truckStatus: 'AVAILABLE',
    transportCompany: { id: 'company-1', name: 'Transports du Port', status: 'AVAILABLE' },
    reservedAt: '2026-09-07T08:00:00.000Z',
    releasedAt: null,
    ...overrides,
  }
}

type DetailShift = DischargeDetailDto['shifts'][number]

export function buildShift(overrides: Partial<DetailShift> = {}): DetailShift {
  return {
    id: 'shift-1',
    status: 'PLANNED',
    plannedStartAt: '2026-10-04T06:00:00.000Z',
    plannedEndAt: '2026-10-04T14:00:00.000Z',
    responsible: { id: 'lead-1', firstName: 'Léa', lastName: 'Martin' },
    trucks: [],
    warehouseDoors: [],
    weighingAreas: [],
    ...overrides,
  }
}

type DetailLot = DischargeDetailDto['productLots'][number]
type DetailDoorPeriod = DetailLot['doorAssignments'][number]

export function buildLot(overrides: Partial<DetailLot> = {}): DetailLot {
  return {
    id: 'lot-detail-1',
    productName: 'Blé tendre',
    description: null,
    expectedQuantityTonnes: '1000.000',
    customer: { id: 'customer-cargill', name: 'Cargill France', status: 'AVAILABLE' },
    doorAssignments: [],
    ...overrides,
  }
}

export function buildDoorPeriod(overrides: Partial<DetailDoorPeriod> = {}): DetailDoorPeriod {
  return {
    id: 'door-period-1',
    effectiveFrom: '2026-09-08T05:00:00.000Z',
    effectiveTo: null,
    warehouseDoor: { id: 'door-a1', name: 'Door A1', status: 'AVAILABLE' },
    warehouse: { id: 'warehouse-a', name: 'Magasin A', status: 'AVAILABLE' },
    ...overrides,
  }
}

export const DISCHARGE_DETAILS: DischargeDetailDto[] = DISCHARGES.map((listed) =>
  buildDischargeDetail(listed),
)

export function listedDischarge(vesselName: string, status: DischargeDto['status']) {
  const found = DISCHARGES.find(
    (discharge) => discharge.vesselName === vesselName && discharge.status === status,
  )

  if (!found) {
    throw new Error(`No ${status} fixture for ${vesselName}`)
  }

  return found
}
