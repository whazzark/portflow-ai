import type { WarehouseWithDoorsDto } from '@/features/warehouses/types'

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

export const WAREHOUSES: WarehouseWithDoorsDto[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'North Shed',
    status: 'AVAILABLE',
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
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Old Door',
        status: 'ARCHIVED',
        latitude: 48.8552,
        longitude: 2.3452,
      },
    ],
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    name: 'Retired Shed',
    status: 'ARCHIVED',
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
      },
    ],
  },
]

export const CREATED_WAREHOUSE: WarehouseWithDoorsDto = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  name: 'South Shed',
  status: 'AVAILABLE',
  footprint: {
    points: [
      { latitude: 10.5, longitude: 20.5 },
      { latitude: 11.5, longitude: 21.5 },
      { latitude: 12.5, longitude: 20.5 },
    ],
  },
  doors: [],
}
