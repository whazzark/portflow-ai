import vine from '@vinejs/vine'

import { newPasswordFields } from '#auth/shared/new_password_rule'

/**
 * The password a user chooses for themselves obeys `newPasswordFields`, as at a renewal and at an
 * invitation acceptance: one definition, so no path can record a weaker credential than another.
 *
 * What this seam adds is `currentPassword`. The renewal asks for none — the administrator's
 * requirement is what stands in its place — whereas here nothing but the open session vouches for
 * the person at the keyboard, and an open session is not a credential.
 *
 * Not trimmed, for the reason `new_password_rule.ts` records: trimming silently changes a secret.
 */
export const changeOwnPasswordValidator = vine.create({
  currentPassword: vine.string().minLength(1),
  ...newPasswordFields,
})
