import { InvalidUserIdentityException } from '#users/shared/user_exceptions'

export const MAX_USER_NAME_LENGTH = 255
export const MAX_USER_EMAIL_LENGTH = 255

export type UserIdentity = {
  firstName: string
  lastName: string
  email: string
}

/**
 * Surrounding whitespace is insignificant everywhere in an identity; nothing else about the entered
 * value is. Capitalization, accents, apostrophes, hyphens, and non-Latin characters survive a
 * correction exactly as typed.
 */
export const normalizeUserIdentity = (identity: UserIdentity): UserIdentity => ({
  firstName: identity.firstName.trim(),
  lastName: identity.lastName.trim(),
  email: identity.email.trim(),
})

export const assertValidUserIdentity = (identity: UserIdentity): UserIdentity => {
  const normalized = normalizeUserIdentity(identity)

  const isWithin = (value: string, maximum: number) => value.length > 0 && value.length <= maximum

  if (
    !isWithin(normalized.firstName, MAX_USER_NAME_LENGTH) ||
    !isWithin(normalized.lastName, MAX_USER_NAME_LENGTH) ||
    !isWithin(normalized.email, MAX_USER_EMAIL_LENGTH)
  ) {
    throw new InvalidUserIdentityException()
  }

  return normalized
}

/**
 * Exact comparison, deliberately: re-casing a stored value is a change the record should show, so
 * `Jean` → `jean` is a correction like any other and is applied as one.
 */
export const isSameUserIdentity = (left: UserIdentity, right: UserIdentity): boolean =>
  left.firstName === right.firstName &&
  left.lastName === right.lastName &&
  left.email === right.email

/**
 * Case-insensitive, deliberately: this answers "does the correction reach a different mailbox",
 * which is what decides whether an outstanding activation link is aimed at the wrong place. It is
 * also the comparison the `users_email_unique` index makes on `LOWER(email)`.
 */
export const isSameEmailAddress = (left: string, right: string): boolean =>
  left.trim().toLowerCase() === right.trim().toLowerCase()
