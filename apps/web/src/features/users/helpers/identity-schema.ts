import { z } from 'zod'

/** Mirrors the API bounds: `users.first_name`, `last_name`, and `email` are all `string` columns. */
const MAX_LENGTH = 255

/**
 * The shape of an identity, whoever edits it — an administrator correcting another user, or a user
 * updating their own. One set of rules on both forms, as on the API, so the two can never drift.
 */
export const identitySchemaFields = {
  firstName: z.string().trim().min(1, 'First name is required.').max(MAX_LENGTH),
  lastName: z.string().trim().min(1, 'Last name is required.').max(MAX_LENGTH),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .max(MAX_LENGTH)
    .email('Enter a valid email address.'),
}
