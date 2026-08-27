import vine from '@vinejs/vine'

/**
 * The first password strength rule in this codebase, and deliberately asymmetric with
 * `loginValidator`, which keeps `minLength(1)`: login must accept whatever was stored, and a length
 * refusal there would leak that an account exists.
 *
 * **No `.trim()`, unlike every other string field here — including `loginValidator`'s email.**
 * Trimming a password silently changes the secret: a trailing space stripped on renewal but not at
 * login would lock the user out of the account they just fixed. Surrounding whitespace is part of
 * the secret.
 *
 * The maximum exists so an unbounded string cannot be pushed through scrypt. `confirmed` reports its
 * failure against `passwordConfirmation`, so a mismatch reaches that field through the existing
 * `applyValidationError` path with no mapping.
 */
export const passwordRenewalValidator = vine.create({
  password: vine.string().minLength(12).maxLength(128).confirmed({ as: 'passwordConfirmation' }),
  passwordConfirmation: vine.string(),
})
