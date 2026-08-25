import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import type { Decimal } from 'decimal.js'
import type { DateTime } from 'luxon'

import type Truck from '#models/truck'
import type { BulkTruckLifecycleBlocker } from '#trucks/shared/truck_lifecycle_blockers'

export type CreateTruckCommand = {
  registration: string
  vehicleModel: string | null
  capacityTonnes: Decimal.Value
  transportCompanyId: string
}

export type UpdateTruckCommand = {
  id: string
  registration: string
  vehicleModel: string | null
  capacityTonnes: Decimal.Value
  transportCompanyId: string
  /**
   * The truck's transport company as read by the caller when it decided whether this update is a
   * reassignment and, if so, validated it. The write is conditioned on this still being the
   * stored value, so a reassignment (or lock/availability decision) made against a value another
   * request has since changed is reported as `TRANSPORT_COMPANY_CHANGED` rather than silently
   * applied or silently overwritten.
   */
  expectedTransportCompanyId: string
}

export type TruckWriteResult =
  | { kind: 'CREATED'; truck: Truck }
  | { kind: 'UPDATED'; truck: Truck }
  | { kind: 'DUPLICATE_REGISTRATION' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ARCHIVED' }
  | { kind: 'SUSPENDED' }
  | { kind: 'TRANSPORT_COMPANY_CHANGED' }
  | { kind: 'INVALID_TRANSPORT_COMPANY' }

export type FindCompanyIdsWithAvailableTrucksInput = {
  transportCompanyIds: readonly string[]
  client?: QueryClientContract
}

export type ArchiveTruckCommand = {
  id: string
  archivedAt: DateTime
  archivedByUserId: string
  archiveComment: string | null
}

export type ArchiveTruckResult =
  | { kind: 'ARCHIVED'; truck: Truck }
  | { kind: 'ALREADY_ARCHIVED' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'IN_USE' }
  | { kind: 'SUSPENDED' }

export type ArchiveTrucksCommand = {
  ids: string[]
  archivedAt: DateTime
  archivedByUserId: string
  archiveComment: string | null
}

export type BulkTruckLifecycleResult = {
  updatedTrucks: Truck[]
  blockedTrucks: BulkTruckLifecycleBlocker[]
}

export type ReactivateTruckCommand = {
  id: string
  reactivatedAt: DateTime
  reactivatedByUserId: string
  reactivationComment: string | null
}

export type ReactivateTruckResult =
  | { kind: 'REACTIVATED'; truck: Truck }
  | { kind: 'ALREADY_AVAILABLE' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'TRANSPORT_COMPANY_ARCHIVED' }
  | { kind: 'SUSPENDED' }

export type SuspendTruckCommand = {
  id: string
  suspendedAt: DateTime
  suspendedByUserId: string
  suspensionComment: string | null
}

export type SuspendTruckResult =
  | { kind: 'SUSPENDED'; truck: Truck }
  | { kind: 'ALREADY_SUSPENDED' }
  | { kind: 'ARCHIVED' }
  | { kind: 'NOT_FOUND' }

export type ReturnTruckToServiceCommand = {
  id: string
  returnedToServiceAt: DateTime
  returnedToServiceByUserId: string
  returnToServiceComment: string | null
}

/**
 * The mirror of `ReactivateTruckResult`, minus `SUSPENDED` — the source state *is* suspended — and
 * plus `ARCHIVED`. Both transitions guard the same invariant (no available truck under an archived
 * transport company) and differ only in the state they start from.
 */
export type ReturnTruckToServiceResult =
  | { kind: 'RETURNED'; truck: Truck }
  | { kind: 'ALREADY_AVAILABLE' }
  | { kind: 'ARCHIVED' }
  | { kind: 'TRANSPORT_COMPANY_ARCHIVED' }
  | { kind: 'NOT_FOUND' }

export type ReactivateTrucksCommand = {
  ids: string[]
  reactivatedAt: DateTime
  reactivatedByUserId: string
  reactivationComment: string | null
}

export default abstract class TruckRepository {
  abstract list(): Promise<Truck[]>
  abstract listAvailable(): Promise<Truck[]>
  abstract listSuspended(): Promise<Truck[]>
  abstract findById(id: string): Promise<Truck | null>
  abstract create(command: CreateTruckCommand): Promise<TruckWriteResult>
  abstract updateAvailable(command: UpdateTruckCommand): Promise<TruckWriteResult>
  abstract findCompanyIdsWithAvailableTrucks(
    input: FindCompanyIdsWithAvailableTrucksInput,
  ): Promise<Set<string>>
  abstract archiveAvailable(command: ArchiveTruckCommand): Promise<ArchiveTruckResult>
  abstract archiveAvailableMany(command: ArchiveTrucksCommand): Promise<BulkTruckLifecycleResult>
  abstract reactivateArchived(command: ReactivateTruckCommand): Promise<ReactivateTruckResult>
  abstract reactivateArchivedMany(
    command: ReactivateTrucksCommand,
  ): Promise<BulkTruckLifecycleResult>
  abstract suspendAvailable(command: SuspendTruckCommand): Promise<SuspendTruckResult>
  abstract returnSuspendedToService(
    command: ReturnTruckToServiceCommand,
  ): Promise<ReturnTruckToServiceResult>
}
