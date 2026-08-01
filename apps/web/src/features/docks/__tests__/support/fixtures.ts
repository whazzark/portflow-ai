import type { DockDto } from '@/features/docks/types'

export const API_BASE_URL = 'http://localhost:3333'

export const DOCK_ADMIN = {
  id: 1,
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'admin@portflow.test',
  role: 'OPERATIONS_ADMIN',
  accessStatus: 'ACTIVE',
}

export const DOCK_OBSERVER = {
  ...DOCK_ADMIN,
  email: 'observer@portflow.test',
  role: 'OBSERVER',
}

export const DOCKS: DockDto[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Bêta Dock',
    latitude: 48.8566,
    longitude: 2.3522,
    status: 'AVAILABLE',
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: '2026-01-02T00:00:00.000Z',
    reactivatedByUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    reactivationComment: 'Returned to service',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'North Dock',
    latitude: 49.4944,
    longitude: 0.1079,
    status: 'AVAILABLE',
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
    createdAt: '2025-02-01T00:00:00.000Z',
    updatedAt: '2025-02-02T00:00:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Retired Dock',
    latitude: 43.2965,
    longitude: 5.3698,
    status: 'ARCHIVED',
    archivedAt: '2026-03-01T00:00:00.000Z',
    archivedByUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    archiveComment: 'No longer used',
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
]
