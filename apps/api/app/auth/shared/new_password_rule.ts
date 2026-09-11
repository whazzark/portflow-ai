import vine from '@vinejs/vine'

/**
 * The rule every password a user chooses for themselves must meet — at a password renewal and at an
 * invitation acceptance alike. One definition, so that no account can start its life, or be renewed,
 * with a weaker credential than the other path would allow.
 *
 * Deliberately asymmetric with `loginValidator`, which keeps `minLength(1)`: login must accept
 * whatever was stored, and a length refusal there would leak that an account exists.
 *
 * **No `.trim()`, unlike every other string field here — including `loginValidator`'s email.**
 * Trimming a password silently changes the secret: a trailing space stripped here but not at login
 * would lock the user out of the account they just set up.
 *
 * Note that the rule alone does not make surrounding whitespace part of the secret: the bodyparser's
 * default `trimWhitespaces` trims every JSON string before any validator runs, at login as much as
 * here. Every entry point trims the same way, so nobody is locked out — but a padded password is
 * recorded without its padding.
 *
 * The maximum exists so an unbounded string cannot be pushed through scrypt. `confirmed` reports its
 * failure against `passwordConfirmation`, so a mismatch reaches that field through the existing
 * `applyValidationError` path with no mapping.
 */
export const newPasswordFields = {
  password: vine.string().minLength(12).maxLength(128).confirmed({ as: 'passwordConfirmation' }),
  passwordConfirmation: vine.string(),
}
