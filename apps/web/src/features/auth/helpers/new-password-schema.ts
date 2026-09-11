import { z } from 'zod'

// Mirrors `newPasswordFields` on the API, which is authoritative and shared by the password renewal
// and the invitation acceptance. Deliberately unlike the login form's `min(1)`: this is where the
// rule is set, not where a stored password is accepted.
export const newPasswordSchema = z.object({
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters.')
    .max(128, 'Password must be at most 128 characters.'),
  passwordConfirmation: z.string().min(1, 'Confirm your new password.'),
})

// The match is checked on submit only, so blurring the password field before the confirmation has
// been typed does not accuse the user of a mismatch they have not made yet. Reported against
// `passwordConfirmation`, the same field the API's `confirmed` rule names.
export const newPasswordSubmitSchema = newPasswordSchema.refine(
  ({ password, passwordConfirmation }) => password === passwordConfirmation,
  { message: 'Passwords do not match.', path: ['passwordConfirmation'] },
)
