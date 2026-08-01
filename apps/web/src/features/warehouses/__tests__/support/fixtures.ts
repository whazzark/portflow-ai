import type { WarehouseDto } from '@/features/warehouses/types'

export const API_BASE_URL = 'http://localhost:3333'

export const WAREHOUSES: WarehouseDto[] = [
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
  },
]
