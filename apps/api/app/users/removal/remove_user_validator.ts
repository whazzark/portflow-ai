import vine from '@vinejs/vine'

/**
 * Validates the route parameter, not a body: this command has none.
 *
 * `users.id` is a real `uuid` column, so handing PostgreSQL a non-UUID string raises `22P02` and
 * surfaces as a 500 — a failure the SQLite-backed suites never see. Rejecting the request here is
 * what keeps a malformed reference from reaching the database at all, and it stays distinguishable
 * from a well-formed identifier that matches no user.
 *
 * Nested under `params` because that is the key the generated client contract reads as a route
 * parameter; a bare `id` would surface on the web side as a required request body that does not
 * exist.
 */
export const removeUserValidator = vine.create({
  params: vine.object({
    id: vine.string().uuid(),
  }),
})
