import { DateTime } from 'luxon'

export const FIXTURE_REFERENCE_DATE = DateTime.fromISO('2025-06-01T10:00:00.000Z')
export const FIXTURE_ARCHIVED_AT = DateTime.fromISO('2025-01-15T10:00:00.000Z')
export const FIXTURE_REACTIVATED_AT = DateTime.fromISO('2025-03-15T10:00:00.000Z')
export const FIXTURE_ARCHIVED_ONLY_AT = DateTime.fromISO('2025-04-15T10:00:00.000Z')

export type LifecycleFactoryState = 'available' | 'archived' | 'reactivated'

export const fixtureUuid = (domain: number, index: number) =>
  `${String(domain).padStart(8, '0')}-0000-4000-8000-${String(index).padStart(12, '0')}`

export type LifecycleAttributes = {
  status: 'AVAILABLE' | 'ARCHIVED'
  archivedAt: DateTime | null
  archivedByUserId: string | null
  archiveComment: string | null
  reactivatedAt: DateTime | null
  reactivatedByUserId: string | null
  reactivationComment: string | null
}

export const availableLifecycle = (): LifecycleAttributes => ({
  status: 'AVAILABLE',
  archivedAt: null,
  archivedByUserId: null,
  archiveComment: null,
  reactivatedAt: null,
  reactivatedByUserId: null,
  reactivationComment: null,
})

export const archivedLifecycle = (
  actorId: string,
  comment: string,
  archivedAt = FIXTURE_ARCHIVED_ONLY_AT,
): LifecycleAttributes => ({
  status: 'ARCHIVED',
  archivedAt,
  archivedByUserId: actorId,
  archiveComment: comment,
  reactivatedAt: null,
  reactivatedByUserId: null,
  reactivationComment: null,
})

export const reactivatedLifecycle = (
  actorId: string,
  archiveComment: string,
  reactivationComment: string,
): LifecycleAttributes => ({
  status: 'AVAILABLE',
  archivedAt: FIXTURE_ARCHIVED_AT,
  archivedByUserId: actorId,
  archiveComment,
  reactivatedAt: FIXTURE_REACTIVATED_AT,
  reactivatedByUserId: actorId,
  reactivationComment,
})
