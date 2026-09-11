/**
 * The identity a user is recorded with. Surrounding spaces never carry meaning here, and an email
 * padded or typed in another case is the same person — which the conflict decision has to see
 * *before* it decides, not after.
 *
 * Casing is preserved: the address is displayed as its owner writes it, and uniqueness is enforced
 * case-insensitively by the `users_email_unique` index on `LOWER(email)`.
 */
export const normalizeUserName = (name: string) => name.trim()

export const normalizeUserEmail = (email: string) => email.trim()
