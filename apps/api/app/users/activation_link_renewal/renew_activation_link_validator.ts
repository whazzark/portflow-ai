import vine from '@vinejs/vine'

/**
 * Validates the route parameter, not a body: this command has none.
 *
 * `params.id` is checked for the reason `deactivateUserValidator` records: `users.id` is a real
 * `uuid` column, so a non-UUID string reaching PostgreSQL raises `22P02` and surfaces as a 500.
 */
export const renewActivationLinkValidator = vine.create({
  params: vine.object({
    id: vine.string().uuid(),
  }),
})
