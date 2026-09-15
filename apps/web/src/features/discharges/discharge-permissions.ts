import type { SessionUser } from '@/features/auth/context/session-context'

const PREPARING_ROLES: ReadonlyArray<SessionUser['role']> = [
  'OPERATIONS_LEAD',
  'OPERATIONS_ADMIN',
  'ORGANIZATION_ADMIN',
]

/**
 * Whether this viewer may create a discharge and correct a planned one.
 *
 * Mirrors the API rule rather than replacing it — `DischargePolicy.create` and `update` stay
 * authoritative. This exists so the workbench never offers an action the API would refuse, which
 * is a courtesy to the user, not a security boundary.
 */
export function canPrepareDischarges(user: SessionUser | null | undefined) {
  return Boolean(user && user.accessStatus === 'ACTIVE' && PREPARING_ROLES.includes(user.role))
}
