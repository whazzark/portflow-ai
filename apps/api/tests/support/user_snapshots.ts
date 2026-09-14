import type User from '#models/user'

/**
 * Everything about a user a role change must leave exactly as it found it — GH-28's FR-005 and
 * FR-016 — and everything a refused one must leave alone on every user it touched (GH-29's FR-009).
 * The role itself is left out, so each test states what it expects of it.
 */
export const untouchedFields = (user: User) => ({
  accessStatus: user.accessStatus,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  password: user.password,
  invitedAt: user.invitedAt?.toISO() ?? null,
  invitedByUserId: user.invitedByUserId,
  activatedAt: user.activatedAt?.toISO() ?? null,
  activatedByUserId: user.activatedByUserId,
  cancelledAt: user.cancelledAt?.toISO() ?? null,
  cancelledByUserId: user.cancelledByUserId,
  deactivatedAt: user.deactivatedAt?.toISO() ?? null,
  deactivatedByUserId: user.deactivatedByUserId,
  reactivatedAt: user.reactivatedAt?.toISO() ?? null,
  reactivatedByUserId: user.reactivatedByUserId,
  passwordRenewalRequiredAt: user.passwordRenewalRequiredAt?.toISO() ?? null,
})
