import type User from '#models/user'

/**
 * The roles `CONTEXT.md` allows to be accountable for a shift. Preparing a discharge is open to the
 * same roles, which is why the discharge policy reads this rule too.
 *
 * GH-66, which keeps a responsible from losing eligibility, must import this rule rather than
 * redefine it, so the picker, the preparation command, and that protection can never disagree.
 */
export const SHIFT_RESPONSIBLE_ROLES = [
  'OPERATIONS_LEAD',
  'OPERATIONS_ADMIN',
  'ORGANIZATION_ADMIN',
] as const

export function isEligibleShiftResponsible(user: Pick<User, 'accessStatus' | 'role'>) {
  return (
    user.accessStatus === 'ACTIVE' &&
    (SHIFT_RESPONSIBLE_ROLES as readonly string[]).includes(user.role)
  )
}
