import vine from '@vinejs/vine'

import { USER_ROLES } from '#models/user'
import { nonBlank } from '#shared/validators/lifecycle_validator'

/**
 * Shape only. What the values *mean* — the trimming, and whether the email already belongs to
 * someone — belongs to the use case.
 */
export const inviteUserValidator = vine.create({
  firstName: vine.string().use(nonBlank()).minLength(1).maxLength(255),
  lastName: vine.string().use(nonBlank()).minLength(1).maxLength(255),
  email: vine.string().use(nonBlank()).minLength(1).maxLength(255).email(),
  role: vine.enum(USER_ROLES),
})
