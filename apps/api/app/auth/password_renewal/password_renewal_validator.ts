import vine from '@vinejs/vine'

import { newPasswordFields } from '#auth/shared/new_password_rule'

/**
 * The first password strength rule in this codebase, now shared with the invitation acceptance —
 * see `new_password_rule.ts` for why it is not trimmed and why it is asymmetric with login.
 */
export const passwordRenewalValidator = vine.create({
  ...newPasswordFields,
})
