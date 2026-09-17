import type { SessionUser } from '@/features/auth/context/session-context'
import type { DischargeDetailDto } from '@/features/discharges/types'

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

/**
 * Whether this viewer may add a shift to this discharge: a closed discharge receives no new shift,
 * while a planned or active one does. Mirrors `DischargePolicy.update` and the addition's status
 * rule, which stay authoritative.
 */
export function canAddShifts(
  user: SessionUser | null | undefined,
  discharge: Pick<DischargeDetailDto, 'status'>,
) {
  return canPrepareDischarges(user) && discharge.status !== 'CLOSED'
}
