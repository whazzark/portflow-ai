import type { Route } from '@tuyau/core/types'
import type { WarehouseDoorDto, WarehouseWithDoorsDto } from '@/features/warehouses/types'

export const API_BASE_URL = 'http://localhost:3333'

export const WAREHOUSE_ADMIN = {
  id: 1,
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'admin@portflow.test',
  role: 'OPERATIONS_ADMIN',
  accessStatus: 'ACTIVE',
}

export const WAREHOUSE_OBSERVER = {
  ...WAREHOUSE_ADMIN,
  email: 'observer@portflow.test',
  role: 'OBSERVER',
}

/** The lifecycle context every warehouse carries. Spread rather than repeated, so a later
 * lifecycle field widens one place instead of every fixture. */
export const warehouseLifecycle = (
  overrides: Partial<WarehouseWithDoorsDto> = {},
): Omit<WarehouseWithDoorsDto, 'id' | 'name' | 'status' | 'footprint' | 'doors'> => ({
  archivedAt: null,
  archivedByUserId: null,
  archiveComment: null,
  reactivatedAt: null,
  reactivatedByUserId: null,
  reactivationComment: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

/** The same for a door, plus the archive provenance introduced by GH-210. */
export const doorLifecycle = (
  overrides: Partial<WarehouseDoorDto> = {},
): Omit<WarehouseDoorDto, 'id' | 'name' | 'status' | 'latitude' | 'longitude'> => ({
  archivedAt: null,
  archivedByUserId: null,
  archiveComment: null,
  reactivatedAt: null,
  reactivatedByUserId: null,
  reactivationComment: null,
  archivedWithWarehouse: false,
  ...overrides,
})

export const WAREHOUSES: WarehouseWithDoorsDto[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'North Shed',
    status: 'AVAILABLE',
    ...warehouseLifecycle(),
    footprint: {
      points: [
        { latitude: 48.85, longitude: 2.34 },
        { latitude: 48.86, longitude: 2.35 },
        { latitude: 48.85, longitude: 2.36 },
      ],
    },
    doors: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'North Door',
        status: 'AVAILABLE',
        latitude: 48.855,
        longitude: 2.345,
        ...doorLifecycle(),
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Old Door',
        status: 'ARCHIVED',
        latitude: 48.8552,
        longitude: 2.3452,
        ...doorLifecycle({ archivedAt: '2026-05-01T09:00:00.000Z' }),
      },
    ],
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    name: 'Retired Shed',
    status: 'ARCHIVED',
    ...warehouseLifecycle({ archivedAt: '2026-06-01T09:00:00.000Z' }),
    footprint: {
      points: [
        { latitude: 43.29, longitude: 5.36 },
        { latitude: 43.3, longitude: 5.37 },
        { latitude: 43.29, longitude: 5.38 },
      ],
    },
    doors: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Retired Door',
        status: 'ARCHIVED',
        latitude: 43.295,
        longitude: 5.365,
        ...doorLifecycle({ archivedAt: '2026-06-01T09:00:00.000Z', archivedWithWarehouse: true }),
      },
    ],
  },
]

/** A wider set for bulk-selection tests: three available warehouses with differing door counts,
 * plus the archived one, so a selection can mix eligible and ineligible warehouses. Kept separate
 * from `WAREHOUSES` so the delivered consultation tests keep their exact counts. */
export const BULK_WAREHOUSES: WarehouseWithDoorsDto[] = [
  WAREHOUSES[0],
  {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    name: 'East Shed',
    status: 'AVAILABLE',
    ...warehouseLifecycle(),
    footprint: {
      points: [
        { latitude: 47.21, longitude: -1.55 },
        { latitude: 47.22, longitude: -1.54 },
        { latitude: 47.21, longitude: -1.53 },
      ],
    },
    doors: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'East Door',
        status: 'AVAILABLE',
        latitude: 47.215,
        longitude: -1.545,
        ...doorLifecycle(),
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'East Side Door',
        status: 'AVAILABLE',
        latitude: 47.216,
        longitude: -1.544,
        ...doorLifecycle(),
      },
    ],
  },
  {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    name: 'West Shed',
    status: 'AVAILABLE',
    ...warehouseLifecycle(),
    footprint: {
      points: [
        { latitude: 44.83, longitude: -0.57 },
        { latitude: 44.84, longitude: -0.56 },
        { latitude: 44.83, longitude: -0.55 },
      ],
    },
    doors: [],
  },
  WAREHOUSES[1],
]

/** An archived warehouse holding both kinds of archived door, which is the distinction
 * reactivation turns on: `Cascaded Door` was archived by this warehouse's archival and comes back
 * with it, while `Solo Door` was archived on its own and must stay archived (GH-211 FR-007/FR-008).
 * Kept out of `WAREHOUSES` so the delivered consultation tests keep their exact door counts. */
export const MIXED_ARCHIVED_WAREHOUSE: WarehouseWithDoorsDto = {
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  name: 'Mixed Shed',
  status: 'ARCHIVED',
  ...warehouseLifecycle({
    archivedAt: '2026-07-01T09:00:00.000Z',
    archiveComment: 'Zone closed for works',
  }),
  footprint: {
    points: [
      { latitude: 45.75, longitude: 4.85 },
      { latitude: 45.76, longitude: 4.86 },
      { latitude: 45.75, longitude: 4.87 },
    ],
  },
  doors: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      name: 'Cascaded Door',
      status: 'ARCHIVED',
      latitude: 45.755,
      longitude: 4.855,
      ...doorLifecycle({
        archivedAt: '2026-07-01T09:00:00.000Z',
        archiveComment: 'Zone closed for works',
        archivedWithWarehouse: true,
      }),
    },
    {
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Solo Door',
      status: 'ARCHIVED',
      latitude: 45.7552,
      longitude: 4.8552,
      ...doorLifecycle({
        archivedAt: '2026-02-01T09:00:00.000Z',
        archiveComment: 'Door retired on its own',
      }),
    },
  ],
}

/** Selection set for reactivation tests: one available warehouse the reactivate intent must refuse
 * to make checkable, and two archived ones a selection can span. */
export const REACTIVATE_WAREHOUSES: WarehouseWithDoorsDto[] = [
  WAREHOUSES[0],
  MIXED_ARCHIVED_WAREHOUSE,
  WAREHOUSES[1],
]

export const CREATED_WAREHOUSE: WarehouseWithDoorsDto = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  name: 'South Shed',
  status: 'AVAILABLE',
  ...warehouseLifecycle(),
  footprint: {
    points: [
      { latitude: 10.5, longitude: 20.5 },
      { latitude: 11.5, longitude: 21.5 },
      { latitude: 12.5, longitude: 20.5 },
    ],
  },
  doors: [],
}

/** A warehouse with no doors, so a reshape is bounded only by the geometry rules. */
export const DOORLESS_WAREHOUSE: WarehouseWithDoorsDto = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  name: 'East Shed',
  status: 'AVAILABLE',
  ...warehouseLifecycle(),
  footprint: {
    points: [
      { latitude: 45.75, longitude: 4.85 },
      { latitude: 45.76, longitude: 4.86 },
      { latitude: 45.75, longitude: 4.87 },
    ],
  },
  doors: [],
}

/** What the API returns once North Shed has been corrected. */
export const UPDATED_WAREHOUSE: WarehouseWithDoorsDto = {
  ...WAREHOUSES[0],
  name: 'North Shed Renamed',
  footprint: {
    points: [
      { latitude: 48.85, longitude: 2.34 },
      { latitude: 48.87, longitude: 2.35 },
      { latitude: 48.85, longitude: 2.36 },
    ],
  },
}

/** What `POST /api/v1/warehouse-doors` returns: the standalone door DTO, which carries its
 * containing warehouse and its creation time and none of the lifecycle context an embedded door
 * has. Derived from the write contract rather than hand-written. */
export type CreatedWarehouseDoorDto = Route.Response<'warehouse_doors.store'>['data']

export const CREATED_DOOR: CreatedWarehouseDoorDto = {
  id: '55555555-5555-4555-8555-555555555555',
  warehouseId: WAREHOUSES[0].id,
  name: 'South Door',
  status: 'AVAILABLE',
  latitude: 48.853,
  longitude: 2.35,
  createdAt: '2026-08-26T09:12:44.000Z',
}

/** The same door as the warehouse collection embeds it, for the refetch that follows creation. */
export const WAREHOUSES_WITH_CREATED_DOOR: WarehouseWithDoorsDto[] = [
  {
    ...WAREHOUSES[0],
    doors: [
      ...(WAREHOUSES[0].doors ?? []),
      {
        id: CREATED_DOOR.id,
        name: CREATED_DOOR.name,
        status: 'AVAILABLE',
        latitude: CREATED_DOOR.latitude,
        longitude: CREATED_DOOR.longitude,
        ...doorLifecycle(),
      },
    ],
  },
  WAREHOUSES[1],
]
