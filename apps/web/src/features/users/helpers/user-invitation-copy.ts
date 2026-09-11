import type { UserAccessStatus } from '@/features/users/types'

/**
 * What an administrator does about an email that already belongs to someone. The invitation refuses
 * it whatever the status; what differs is where they go next, which is the only useful thing the
 * refusal can add.
 */
const CONFLICT_NEXT_ACTION: Record<UserAccessStatus, string> = {
  PENDING:
    'This person is already invited. Renew their activation link instead of inviting them again.',
  ACTIVE: 'This person already holds active access.',
  CANCELLED: 'This invitation was cancelled. Restore it instead of inviting this person again.',
  DEACTIVATED: 'This access was deactivated. Reactivate it instead of inviting this person again.',
}

const ACCESS_STATUSES = Object.keys(CONFLICT_NEXT_ACTION) as UserAccessStatus[]

/**
 * Reads the access status out of a conflict's `meta`, which crosses the wire as `unknown`. An
 * unrecognized shape falls back to the API's own message rather than inventing an action.
 */
export function invitationConflictMessage(meta: unknown, fallback: string) {
  const accessStatus = (meta as { accessStatus?: string } | undefined)?.accessStatus

  return accessStatus && ACCESS_STATUSES.includes(accessStatus as UserAccessStatus)
    ? CONFLICT_NEXT_ACTION[accessStatus as UserAccessStatus]
    : fallback
}
