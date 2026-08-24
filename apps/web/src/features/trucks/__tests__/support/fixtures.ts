import type { SessionUser } from '@/features/auth/context/session-context'
import type { TruckDto } from '@/features/trucks/types'

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
}

export const ACTIVE_OPERATIONS_LEAD: SessionUser = {
  ...ACTIVE_OBSERVER,
  id: 'lead-1',
  email: 'lead@portflow.test',
  role: 'OPERATIONS_LEAD',
}

export const ACTIVE_ORGANIZATION_ADMIN: SessionUser = {
  ...ACTIVE_OBSERVER,
  id: 'admin-1',
  email: 'admin@portflow.test',
  role: 'ORGANIZATION_ADMIN',
}

export const ACTIVE_OPERATIONS_ADMIN: SessionUser = {
  ...ACTIVE_OBSERVER,
  id: 'operations-admin-1',
  email: 'operations-admin@portflow.test',
  role: 'OPERATIONS_ADMIN',
}

export const TRUCKS: TruckDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    registration: 'AA-101-PF',
    vehicleModel: 'Volvo FMX',
    capacityTonnes: 32.5,
    transportCompanyId: '00000000-0000-4000-8000-000000000001',
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
    id: '00000000-0000-4000-8000-000000000102',
    registration: 'BB-202-PF',
    vehicleModel: null,
    capacityTonnes: 28.75,
    transportCompanyId: '00000000-0000-4000-8000-000000000002',
    status: 'AVAILABLE',
    archivedAt: '2026-06-01T08:00:00.000Z',
    archivedByUserId: null,
    archivedBy: null,
    archiveComment: null,
    reactivatedAt: '2026-07-01T10:15:00.000Z',
    reactivatedByUserId: 'admin-1',
    reactivatedBy: { id: 'admin-1', firstName: 'Olivia', lastName: 'Observer' },
    reactivationComment: 'Vehicle returned to service',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-01T10:15:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    registration: 'CC-303-PF',
    vehicleModel: 'Scania XT',
    capacityTonnes: 34.25,
    transportCompanyId: '00000000-0000-4000-8000-000000000003',
    status: 'ARCHIVED',
    archivedAt: '2026-07-20T14:32:11.000Z',
    archivedByUserId: 'admin-1',
    archivedBy: { id: 'admin-1', firstName: 'Olivia', lastName: 'Observer' },
    archiveComment: 'Vehicle retired from the fleet',
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivatedBy: null,
    reactivationComment: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-20T14:32:11.000Z',
  },
]

export const AVAILABLE_TRUCKS = TRUCKS.filter((truck) => truck.status === 'AVAILABLE')

/**
 * A larger, self-contained truck set for lifecycle and multi-selection tests, so bulk-archive
 * scenarios don't have to share (and accidentally shift the lifecycle counts asserted by) the
 * default {@link TRUCKS} fixture.
 */
export const BULK_TRUCKS: TruckDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    registration: 'GG-701-PF',
    vehicleModel: 'DAF XF',
    capacityTonnes: 24,
    transportCompanyId: '00000000-0000-4000-8000-000000000001',
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
    id: '00000000-0000-4000-8000-000000000202',
    registration: 'HH-802-PF',
    vehicleModel: null,
    capacityTonnes: 19.5,
    transportCompanyId: '00000000-0000-4000-8000-000000000002',
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
    id: '00000000-0000-4000-8000-000000000203',
    registration: 'II-903-PF',
    vehicleModel: 'Renault T',
    capacityTonnes: 27.25,
    transportCompanyId: '00000000-0000-4000-8000-000000000003',
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
    id: '00000000-0000-4000-8000-000000000204',
    registration: 'JJ-004-PF',
    vehicleModel: 'MAN TGX',
    capacityTonnes: 22,
    transportCompanyId: '00000000-0000-4000-8000-000000000001',
    status: 'ARCHIVED',
    archivedAt: '2026-07-15T11:00:00.000Z',
    archivedByUserId: 'operations-admin-1',
    archivedBy: { id: 'operations-admin-1', firstName: 'Olivia', lastName: 'Observer' },
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivatedBy: null,
    reactivationComment: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-15T11:00:00.000Z',
  },
]

export const BULK_AVAILABLE_TRUCKS = BULK_TRUCKS.filter((truck) => truck.status === 'AVAILABLE')
