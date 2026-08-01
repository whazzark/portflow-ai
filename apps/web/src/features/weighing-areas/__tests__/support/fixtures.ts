import type { WeighingAreaDto } from '@/features/weighing-areas/types'

export const WEIGHING_AREAS: WeighingAreaDto[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Alpha Scale',
    latitude: -90,
    longitude: 180,
    status: 'AVAILABLE',
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    name: 'Retired Scale',
    latitude: 90,
    longitude: -180,
    status: 'ARCHIVED',
    archivedAt: '2026-01-01T00:00:00.000Z',
    archivedByUserId: null,
    archiveComment: 'Retired',
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]
