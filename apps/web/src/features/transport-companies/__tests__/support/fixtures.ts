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

export const ADMIN_USER = {
  ...ACTIVE_USER,
  id: 'user-2',
  role: 'OPERATIONS_ADMIN',
  email: 'admin@portflow.test',
}

export const TRANSPORT_COMPANIES: TransportCompanyDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Atlantic Transport',
    contactPhone: '+33 2 40 12 34 56',
    contactEmail: 'dispatch@atlantic-transport.test',
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
    contactPhone: '02.96.45.67.89',
    contactEmail: 'contact@beta-logistique.test',
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
    // Archived but still reachable: proves the contact section stays readable and read-only on
    // an archived company, distinct from the un-migrated company below which has none.
    contactPhone: '+44 20 7946 0958',
    contactEmail: 'ops@coastal-haulage.test',
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
  {
    id: '00000000-0000-4000-8000-000000000004',
    name: 'Nordic Haulers',
    // Registered before this feature: no contact details recorded. Available (not archived) so
    // it stays editable, exercising the "must supply both on the next update" rule.
    contactPhone: null,
    contactEmail: null,
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
]

export function createdTransportCompany(
  name: string,
  id = 'created-1',
  contactPhone = '+33 1 23 45 67 89',
  contactEmail = 'contact@example.test',
): TransportCompanyDto {
  return {
    id,
    name,
    contactPhone,
    contactEmail,
    status: 'AVAILABLE',
    archivedAt: null,
    archivedByUserId: null,
    archivedBy: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivatedBy: null,
    reactivationComment: null,
    createdAt: '2026-08-24T09:41:00.000Z',
    updatedAt: '2026-08-24T09:41:00.000Z',
  }
}
