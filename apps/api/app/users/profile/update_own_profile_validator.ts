import vine from '@vinejs/vine'

import { userIdentityFields } from '#users/shared/user_validator'

/**
 * The same identity an administrator's correction accepts, and no user identifier: the target is
 * the session's user, always.
 *
 * `currentPassword` is optional here because whether it is required depends on the stored address,
 * which only the use case reads. It is not trimmed — the same treatment login gives a password —
 * since a surrounding space is part of what the user chose.
 */
export const updateOwnProfileValidator = vine.create({
  ...userIdentityFields,
  currentPassword: vine.string().optional(),
})
