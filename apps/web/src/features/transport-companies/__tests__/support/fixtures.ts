import type { TransportCompanyDto } from '@/features/transport-companies/types'

export const API_BASE_URL = 'http://localhost:3333'

export const ACTIVE_USER = {
  id: 'user-1',
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'claire@portflow.test',
  role: 'OBSERVER',
  accessStatus: 'ACTIVE',
}

export const TRANSPORT_COMPANIES: TransportCompanyDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Atlantic Transport',
    status: 'AVAILABLE',
    archivedAt: null,
    archivedByUserId: null,
    archivedBy: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivatedBy: null,
    reactivationComment: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Bêta Logistique',
    status: 'AVAILABLE',
    archivedAt: null,
    archivedByUserId: null,
    archivedBy: null,
    archiveComment: null,
    reactivatedAt: '2026-07-01T10:15:00.000Z',
    reactivatedByUserId: 'user-1',
    reactivatedBy: { id: 'user-1', firstName: 'Claire', lastName: 'Martin' },
    reactivationComment: 'Contract renewed',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-01T10:15:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Coastal Haulage',
    status: 'ARCHIVED',
    archivedAt: '2026-07-20T14:32:11.000Z',
    archivedByUserId: 'user-1',
    archivedBy: { id: 'user-1', firstName: 'Claire', lastName: 'Martin' },
    archiveComment: 'Provider no longer serves the site',
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivatedBy: null,
    reactivationComment: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-20T14:32:11.000Z',
  },
]
