import type { SessionUser } from '@/features/auth/context/session-context'
import { CUSTOMERS } from '@/features/customers/__tests__/support/fixtures'
import type { CustomerDto } from '@/features/customers/types'
import type {
  DischargeDetailDto,
  DischargeDto,
  PlanningDoorDto,
  StartProblemDto,
  TruckCandidateDto,
} from '@/features/discharges/types'
import { DOCKS } from '@/features/docks/__tests__/support/fixtures'
import type { DockDto } from '@/features/docks/types'

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
    // A started fixture keeps its expected start, with nobody recorded as starting it.
    startedAt:
      listed.status === 'PLANNED' ? null : (listed.expectedStartAt ?? '2026-10-01T06:00:00.000Z'),
    startedBy: null,
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
    otherHoldings: [],
    ...overrides,
  }
}

export function buildTruckCandidate(overrides: Partial<TruckCandidateDto> = {}): TruckCandidateDto {
  return {
    id: 'candidate-1',
    registration: 'EF-456-GH',
    transportCompany: { id: 'company-1', name: 'Transports du Port' },
    otherHoldings: [],
    ...overrides,
  }
}

/** The trucks a planned discharge may reserve, one of them already held by an active discharge. */
export const TRUCK_CANDIDATES: TruckCandidateDto[] = [
  buildTruckCandidate({
    id: 'candidate-cedar',
    registration: 'CE-101-DR',
    transportCompany: { id: 'company-atlantic', name: 'Atlantique Transports' },
    otherHoldings: [
      { dischargeId: 'discharge-cedar', vesselName: 'MV Ocean Cedar', status: 'ACTIVE' },
    ],
  }),
  buildTruckCandidate({
    id: 'candidate-loire',
    registration: 'LO-202-RE',
    transportCompany: { id: 'company-loire', name: 'Loire Logistique' },
  }),
  buildTruckCandidate({
    id: 'candidate-port',
    registration: 'PO-303-RT',
    transportCompany: { id: 'company-1', name: 'Transports du Port' },
  }),
  buildTruckCandidate({
    id: 'candidate-rade',
    registration: 'RA-404-DE',
    transportCompany: { id: 'company-1', name: 'Transports du Port' },
  }),
]

type DetailShift = DischargeDetailDto['shifts'][number]

export function buildShift(overrides: Partial<DetailShift> = {}): DetailShift {
  return {
    // A started shift has no readiness; a planned one lacks nothing unless a test says what.
    readinessGaps: (overrides.status ?? 'PLANNED') === 'PLANNED' ? [] : null,
    id: 'shift-1',
    status: 'PLANNED',
    plannedStartAt: '2026-10-04T06:00:00.000Z',
    plannedEndAt: '2026-10-04T14:00:00.000Z',
    responsible: { id: 'lead-1', firstName: 'Léa', lastName: 'Martin' },
    actualStartAt: null,
    startedBy: null,
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

export const AVAILABLE_DOCKS: DockDto[] = DOCKS.filter((dock) => dock.status === 'AVAILABLE')

export const AVAILABLE_CUSTOMERS: CustomerDto[] = CUSTOMERS.filter(
  (customer) => customer.status === 'AVAILABLE',
)

export const ELIGIBLE_RESPONSIBLES = [
  { id: 'responsible-lea', firstName: 'Léa', lastName: 'Martin' },
  { id: 'responsible-thomas', firstName: 'Thomas', lastName: 'Bernard' },
]

/** The warehouses a shift's doors are chosen from, reduced to what that choice reads. */
export const SHIFT_WAREHOUSES = [
  {
    id: 'warehouse-a',
    name: 'Magasin A',
    status: 'AVAILABLE' as const,
    doors: [
      { id: 'door-a1', name: 'Door A1', status: 'AVAILABLE' as const },
      { id: 'door-a2', name: 'Door A2', status: 'AVAILABLE' as const },
      { id: 'door-a3', name: 'Door A3', status: 'ARCHIVED' as const },
    ],
  },
  {
    id: 'warehouse-b',
    name: 'Magasin B',
    status: 'ARCHIVED' as const,
    doors: [{ id: 'door-b1', name: 'Door B1', status: 'ARCHIVED' as const }],
  },
]

export const AVAILABLE_WEIGHING_AREAS = [
  { id: 'area-north', name: 'North scale', status: 'AVAILABLE' as const },
  { id: 'area-south', name: 'South scale', status: 'AVAILABLE' as const },
]

type DetailDoorSelection = DetailShift['warehouseDoors'][number]
type DetailAreaSelection = DetailShift['weighingAreas'][number]

export function buildDoorSelection(
  overrides: Partial<DetailDoorSelection> = {},
): DetailDoorSelection {
  return {
    id: 'door-selection-1',
    effectiveFrom: '2026-09-08T05:00:00.000Z',
    effectiveTo: null,
    warehouseDoor: { id: 'door-a1', name: 'Door A1', status: 'AVAILABLE' },
    warehouse: { id: 'warehouse-a', name: 'Magasin A', status: 'AVAILABLE' },
    ...overrides,
  }
}

export function buildAreaSelection(
  overrides: Partial<DetailAreaSelection> = {},
): DetailAreaSelection {
  return {
    id: 'area-selection-1',
    effectiveFrom: '2026-09-08T05:00:00.000Z',
    effectiveTo: null,
    weighingArea: { id: 'area-north', name: 'Pont Nord', status: 'AVAILABLE' },
    ...overrides,
  }
}

/** Two warehouses, three doors; Door A2 is also held by an active discharge. */
export const PLANNING_DOORS: PlanningDoorDto[] = [
  {
    id: 'door-a1',
    name: 'Door A1',
    warehouse: { id: 'warehouse-a', name: 'Magasin A' },
    otherDischargeAssignments: [],
  },
  {
    id: 'door-a2',
    name: 'Door A2',
    warehouse: { id: 'warehouse-a', name: 'Magasin A' },
    otherDischargeAssignments: [
      {
        discharge: {
          id: 'discharge-ocean-cedar',
          vesselName: 'MV Ocean Cedar',
          status: 'ACTIVE',
          expectedStartAt: '2026-09-10T06:00:00.000Z',
        },
      },
    ],
  },
  {
    id: 'door-b1',
    name: 'Door B1',
    warehouse: { id: 'warehouse-b', name: 'Magasin B' },
    otherDischargeAssignments: [],
  },
]

export const PLANNING_WEIGHING_AREAS = [
  { id: 'area-north', name: 'Pont Nord' },
  { id: 'area-south', name: 'Pont Sud' },
]

export function buildStartProblem(overrides: Partial<StartProblemDto> = {}): StartProblemDto {
  return {
    family: 'INCOMPLETE_PREPARATION',
    code: 'LOT_WITHOUT_WAREHOUSE_DOOR',
    subject: { type: 'PRODUCT_LOT', id: 'lot-detail-1' },
    ...overrides,
  }
}

/**
 * A planned discharge that can start: each lot has a warehouse door of its own, the pool holds one
 * truck, and the earliest shift uses that truck, a door, and a weighing area. A later shift has no
 * resource yet.
 */
export function startableDetail(): DischargeDetailDto {
  const doorPeriod = (lotDoor: 'a1' | 'b1') =>
    buildDoorPeriod({
      id: `door-period-${lotDoor}`,
      warehouseDoor: {
        id: `door-${lotDoor}`,
        name: `Door ${lotDoor.toUpperCase()}`,
        status: 'AVAILABLE',
      },
      warehouse:
        lotDoor === 'a1'
          ? { id: 'warehouse-a', name: 'Magasin A', status: 'AVAILABLE' }
          : { id: 'warehouse-b', name: 'Magasin B', status: 'AVAILABLE' },
    })

  return buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
    productLots: [
      buildLot({ id: 'lot-wheat', doorAssignments: [doorPeriod('a1')] }),
      buildLot({
        id: 'lot-barley',
        productName: 'Orge',
        customer: { id: 'customer-soufflet', name: 'Soufflet Négoce', status: 'AVAILABLE' },
        doorAssignments: [doorPeriod('b1')],
      }),
    ],
    truckPool: [buildPoolEntry({ id: 'pool-a', truckId: 'truck-a', registration: 'AA-100-AA' })],
    shifts: [
      buildShift({
        id: 'shift-first',
        trucks: [
          {
            id: 'shift-truck-a',
            truckId: 'truck-a',
            registration: 'AA-100-AA',
            truckStatus: 'AVAILABLE',
            effectiveFrom: '2026-09-07T08:00:00.000Z',
            effectiveTo: null,
          },
        ],
        warehouseDoors: [
          {
            id: 'shift-door-a1',
            effectiveFrom: '2026-09-07T08:00:00.000Z',
            effectiveTo: null,
            warehouseDoor: { id: 'door-a1', name: 'Door A1', status: 'AVAILABLE' },
            warehouse: { id: 'warehouse-a', name: 'Magasin A', status: 'AVAILABLE' },
          },
        ],
        weighingAreas: [
          {
            id: 'shift-area-north',
            effectiveFrom: '2026-09-07T08:00:00.000Z',
            effectiveTo: null,
            weighingArea: { id: 'area-north', name: 'Pont-bascule Nord', status: 'AVAILABLE' },
          },
        ],
      }),
      buildShift({
        id: 'shift-later',
        plannedStartAt: '2026-10-04T14:00:00.000Z',
        plannedEndAt: '2026-10-04T22:00:00.000Z',
      }),
    ],
  })
}

const HOUR_MS = 3_600_000
/** The first shift of the active scenario starts here; every shift lasts eight hours. */
const ACTIVE_SCENARIO_START = Date.parse('2026-09-14T04:00:00.000Z')
const ACTIVE_SCENARIO_RESERVED_AT = '2026-09-12T07:00:00.000Z'

const at = (hours: number) => new Date(ACTIVE_SCENARIO_START + hours * HOUR_MS).toISOString()

/** The trucks of the active scenario's pool, the last one released on its first day. */
const ACTIVE_SCENARIO_TRUCKS = [
  'BB-202-PF',
  'MS-518-PF',
  'NF-535-PF',
  'PN-552-PF',
  'QV-569-PF',
  'RJ-586-PF',
  'SR-603-PF',
  'TY-620-PF',
  'UM-637-PF',
  'CC-303-PF',
]

const RESPONSIBLES = {
  sophie: { id: 'responsible-sophie', firstName: 'Sophie', lastName: 'Dubois' },
  thomas: { id: 'responsible-thomas', firstName: 'Thomas', lastName: 'Bernard' },
  claire: { id: 'responsible-claire', firstName: 'Claire', lastName: 'Martin' },
}

const DOUANE = {
  warehouseDoor: { id: 'door-douane', name: 'Porte Douane', status: 'AVAILABLE' as const },
  warehouse: { id: 'warehouse-douane', name: 'Magasin sous douane', status: 'AVAILABLE' as const },
}
const NORD = {
  warehouseDoor: { id: 'door-nord', name: 'Porte Nord', status: 'AVAILABLE' as const },
  warehouse: { id: 'warehouse-nord', name: 'Magasin Nord', status: 'AVAILABLE' as const },
}

function scenarioShift(
  index: number,
  status: DetailShift['status'],
  truckCount: number,
  doors: Array<typeof DOUANE>,
): DetailShift {
  const responsible = [RESPONSIBLES.sophie, RESPONSIBLES.thomas, RESPONSIBLES.claire][index % 3]
  const started = status !== 'PLANNED'

  return buildShift({
    id: `shift-${index + 1}`,
    status,
    plannedStartAt: at(index * 8),
    plannedEndAt: at(index * 8 + 8),
    responsible,
    actualStartAt: started ? at(index * 8) : null,
    trucks: ACTIVE_SCENARIO_TRUCKS.slice(0, truckCount).map((registration, truck) => ({
      id: `shift-${index + 1}-truck-${truck}`,
      truckId: `truck-${registration}`,
      registration,
      truckStatus: 'AVAILABLE',
      effectiveFrom: ACTIVE_SCENARIO_RESERVED_AT,
      effectiveTo: null,
    })),
    warehouseDoors: doors.map((door, position) => ({
      id: `shift-${index + 1}-door-${position}`,
      effectiveFrom: ACTIVE_SCENARIO_RESERVED_AT,
      effectiveTo: null,
      ...door,
    })),
    weighingAreas: [
      buildAreaSelection({
        id: `shift-${index + 1}-area`,
        effectiveFrom: ACTIVE_SCENARIO_RESERVED_AT,
        weighingArea: { id: 'area-pont-nord', name: 'Pont-bascule Nord', status: 'AVAILABLE' },
      }),
    ],
  })
}

/**
 * The retained design's active scenario: fourteen eight-hour shifts, five completed, the sixth
 * under way with Claire Martin, two trucks, two doors, and one weighing area, and the seventh next
 * with Sophie Dubois and six trucks. Five lots for five customers, two of them with a door; ten
 * trucks reserved, one of them released.
 */
export function activeDischargeDetail(
  overrides: Partial<DischargeDetailDto> = {},
): DischargeDetailDto {
  const lot = (
    id: string,
    customer: string,
    productName: string,
    tonnes: string,
    door?: typeof DOUANE,
  ) =>
    buildLot({
      id,
      productName,
      expectedQuantityTonnes: tonnes,
      customer: { id: `customer-${id}`, name: customer, status: 'AVAILABLE' },
      doorAssignments: door
        ? [
            buildDoorPeriod({
              id: `${id}-door`,
              effectiveFrom: ACTIVE_SCENARIO_RESERVED_AT,
              ...door,
            }),
          ]
        : [],
    })

  // The active shift is the sixth; the seventh, next, holds six trucks.
  const shifts = Array.from({ length: 14 }, (_, index) => {
    if (index < 5) {
      return scenarioShift(index, 'COMPLETED', 4, [DOUANE])
    }
    if (index === 5) {
      return {
        ...scenarioShift(index, 'ACTIVE', 0, [DOUANE, NORD]),
        trucks: ['PN-552-PF', 'QV-569-PF'].map((registration, truck) => ({
          id: `shift-6-truck-${truck}`,
          truckId: `truck-${registration}`,
          registration,
          truckStatus: 'AVAILABLE' as const,
          effectiveFrom: ACTIVE_SCENARIO_RESERVED_AT,
          effectiveTo: null,
        })),
      }
    }

    return scenarioShift(index, 'PLANNED', index === 6 ? 6 : 3, [DOUANE])
  })

  return buildDischargeDetail(listedDischarge('MV Ocean Cedar', 'ACTIVE'), {
    vesselComment: 'Draught restricted at low tide',
    expectedTonnage: '16790.500',
    startedAt: at(0),
    productLots: [
      lot('armor', 'Armor Chaîne du Froid', 'Petcoke', '3781.000', DOUANE),
      lot('baltic', 'Baltic Eco Fuels', 'Maïs grain', '4557.500'),
      lot('boreal', 'Boréal Shipping France', 'Blé dur', '1834.250', NORD),
      lot('cap', 'Cap Horizon Logistique', 'Colza', '2689.250'),
      lot('ceres', 'Cérès Agro Négoce', 'Pois protéagineux', '3928.500'),
    ],
    truckPool: ACTIVE_SCENARIO_TRUCKS.map((registration) =>
      buildPoolEntry({
        id: `pool-${registration}`,
        truckId: `truck-${registration}`,
        registration,
        reservedAt: ACTIVE_SCENARIO_RESERVED_AT,
        releasedAt: registration === 'CC-303-PF' ? at(6) : null,
      }),
    ),
    shifts,
    ...overrides,
  })
}
