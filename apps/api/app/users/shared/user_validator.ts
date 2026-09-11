import vine from '@vinejs/vine'

import { nonBlank } from '#shared/validators/lifecycle_validator'
import { MAX_USER_EMAIL_LENGTH, MAX_USER_NAME_LENGTH } from '#users/shared/normalize_user_identity'

const nameField = () => vine.string().use(nonBlank()).minLength(1).maxLength(MAX_USER_NAME_LENGTH)

/**
 * All three keys are required. An omitted key must fail validation rather than silently preserving
 * or clearing a stored value, so "leave the last name alone" is expressed by sending it back
 * unchanged — the same rule `updateTruckValidator` records for a nullable field.
 *
 * `trim()` on the address alone, because a padded address is not a well-formed one and the
 * `email()` rule would refuse it before the use case ever normalizes it.
 *
 * `params.id` is checked for the reason `deactivateUserValidator` records: `users.id` is a real
 * `uuid` column, so a non-UUID string reaching PostgreSQL raises `22P02` and surfaces as a 500.
 */
export const updateUserIdentityValidator = vine.create({
  params: vine.object({
    id: vine.string().uuid(),
  }),
  firstName: nameField(),
  lastName: nameField(),
  email: vine.string().trim().email().maxLength(MAX_USER_EMAIL_LENGTH),
})
