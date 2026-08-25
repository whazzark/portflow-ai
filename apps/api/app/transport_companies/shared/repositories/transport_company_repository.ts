import type { DateTime } from 'luxon'
import type TransportCompany from '#models/transport_company'
import type { BulkTransportCompanyLifecycleBlocker } from '#transport_companies/shared/transport_company_lifecycle_blockers'

export type { BulkTransportCompanyLifecycleBlocker } from '#transport_companies/shared/transport_company_lifecycle_blockers'

export type CreateTransportCompanyCommand = {
  name: string
  contactPhone: string
  contactEmail: string
}

export type UpdateTransportCompanyCommand = {
  id: string
  name: string
  contactPhone: string
  contactEmail: string
}

export type TransportCompanyWriteResult =
  | { kind: 'CREATED'; company: TransportCompany }
  | { kind: 'UPDATED'; company: TransportCompany }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ARCHIVED' }
  | { kind: 'DUPLICATE_NAME' }

export type ArchiveTransportCompanyCommand = {
  id: string
  archivedAt: DateTime
  archivedByUserId: string
  archiveComment: string | null
}

// Deliberately a separate type from `TransportCompanyWriteResult`, whose `ARCHIVED` member means
// the opposite thing: "refused because the row is archived". Reusing one type for both meanings
// would make `kind === 'ARCHIVED'` ambiguous at every call site.
export type ArchiveTransportCompanyResult =
  | { kind: 'ARCHIVED'; company: TransportCompany }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ALREADY_ARCHIVED' }
  | { kind: 'HAS_AVAILABLE_TRUCKS' }

export type ArchiveTransportCompaniesCommand = {
  ids: string[]
  archivedAt: DateTime
  archivedByUserId: string
  archiveComment: string | null
}

export type BulkTransportCompanyLifecycleResult = {
  updatedCompanies: TransportCompany[]
  blockedCompanies: BulkTransportCompanyLifecycleBlocker[]
}

export type ReactivateTransportCompanyCommand = {
  id: string
  reactivatedAt: DateTime
  reactivatedByUserId: string
  reactivationComment: string | null
}

// Deliberately a separate type from `ArchiveTransportCompanyResult` and from
// `TransportCompanyWriteResult`, whose `ARCHIVED` member means yet another thing. Reusing one type
// for more than one meaning would make `kind` ambiguous at every call site.
export type ReactivateTransportCompanyResult =
  | { kind: 'REACTIVATED'; company: TransportCompany }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ALREADY_AVAILABLE' }

export type ReactivateTransportCompaniesCommand = {
  ids: string[]
  reactivatedAt: DateTime
  reactivatedByUserId: string
  reactivationComment: string | null
}

export default abstract class TransportCompanyRepository {
  abstract create(command: CreateTransportCompanyCommand): Promise<TransportCompanyWriteResult>
  abstract list(): Promise<TransportCompany[]>
  abstract listAvailable(): Promise<TransportCompany[]>
  abstract findById(id: string): Promise<TransportCompany | null>
  abstract updateAvailable(
    command: UpdateTransportCompanyCommand,
  ): Promise<TransportCompanyWriteResult>
  abstract archiveAvailable(
    command: ArchiveTransportCompanyCommand,
  ): Promise<ArchiveTransportCompanyResult>
  abstract archiveAvailableMany(
    command: ArchiveTransportCompaniesCommand,
  ): Promise<BulkTransportCompanyLifecycleResult>
  abstract reactivateArchived(
    command: ReactivateTransportCompanyCommand,
  ): Promise<ReactivateTransportCompanyResult>
  abstract reactivateArchivedMany(
    command: ReactivateTransportCompaniesCommand,
  ): Promise<BulkTransportCompanyLifecycleResult>
}
