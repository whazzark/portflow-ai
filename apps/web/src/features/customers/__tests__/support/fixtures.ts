import type { CustomerDto } from '@/features/customers/types'

export const API_BASE_URL = 'http://localhost:3333'

export const ADMIN = {
  id: 1,
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'admin@portflow.test',
  role: 'OPERATIONS_ADMIN',
  accessStatus: 'ACTIVE',
}

export const OBSERVER = { ...ADMIN, role: 'OBSERVER', email: 'observer@portflow.test' }

export const CUSTOMERS: CustomerDto[] = [
  {
    id: 'available-1',
    code: 'ACME-01',
    companyName: 'Acme Logistics',
    status: 'AVAILABLE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
  },
  {
    id: 'available-2',
    code: 'BETA-02',
    companyName: 'Bêta Maritime',
    status: 'AVAILABLE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-04T00:00:00.000Z',
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
  },
  {
    id: 'archived-1',
    code: 'OLD-03',
    companyName: 'Old Harbor',
    status: 'ARCHIVED',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    archivedAt: '2026-01-02T00:00:00.000Z',
    archivedByUserId: 'admin-1',
    archiveComment: 'No longer used',
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
  },
]
