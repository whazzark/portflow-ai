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
  | { kind: 'TRANSPORT_COMPANY_CHANGED' }

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

export default abstract class TruckRepository {
  abstract list(): Promise<Truck[]>
  abstract listAvailable(): Promise<Truck[]>
  abstract findById(id: string): Promise<Truck | null>
  abstract create(command: CreateTruckCommand): Promise<TruckWriteResult>
  abstract updateAvailable(command: UpdateTruckCommand): Promise<TruckWriteResult>
  abstract archiveAvailable(command: ArchiveTruckCommand): Promise<ArchiveTruckResult>
  abstract archiveAvailableMany(command: ArchiveTrucksCommand): Promise<BulkTruckLifecycleResult>
}
