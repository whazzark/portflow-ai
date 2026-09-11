import type { SessionUser } from '@/features/auth/context/session-context'
import type { UserDto } from '@/features/users/types'

type Viewer = Pick<SessionUser, 'id' | 'role'>

/**
 * Whether this viewer may require this user to choose a new password.
 *
 * Mirrors the API rule rather than replacing it — `UserPolicy.resetPassword` plus the eligibility
 * checks in `ResetUserPasswordUseCase` stay authoritative. This exists so the workbench never offers
 * an action the API would refuse, which is a courtesy to the administrator, not a security boundary.
 *
 * - organization admins only: an operations admin may consult active users but holds no write
 *   access to them;
 * - active targets only: a pending user has no password yet, a deactivated one is served by
 *   reactivation, and a cancelled one holds no access to protect;
 * - never oneself: requiring oneself to renew is a self-service password change under another name.
 */
export function canResetPassword(viewer: Viewer, user: UserDto) {
  return (
    viewer.role === 'ORGANIZATION_ADMIN' && user.accessStatus === 'ACTIVE' && user.id !== viewer.id
  )
}

/**
 * Whether this viewer may replace this user's activation link.
 *
 * Mirrors the API rule rather than replacing it — `UserPolicy.renewActivationLink` plus the pending
 * guard in the repository's renewal stay authoritative. A courtesy to the administrator, not a
 * security boundary:
 *
 * - organization admins only: issuing a way into the application is theirs alone, as inviting is;
 * - pending targets only: an active user has a password (reset it instead), a deactivated one is
 *   reactivated, and a cancelled invitation is restored. No self rule is needed — a viewer is
 *   active, so never pending.
 */
export function canRenewActivationLink(viewer: Viewer, user: UserDto) {
  return viewer.role === 'ORGANIZATION_ADMIN' && user.accessStatus === 'PENDING'
}

/**
 * Whether this user currently owes a password renewal.
 *
 * The key is withheld from viewers who may not consult the access history, so its absence reads as
 * "not disclosed" rather than "no requirement" — both answer `false` here, which is right: a viewer
 * who may not know must not be shown an indicator either way.
 */
export function owesPasswordRenewal(user: UserDto) {
  return user.passwordRenewalRequired === true
}
