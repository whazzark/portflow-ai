import vine from '@vinejs/vine'

import { lifecycleComment } from '#shared/validators/lifecycle_validator'

/**
 * Validates the target in the path and the optional comment in the body. The body may be omitted
 * entirely: a restoration needs no reason.
 *
 * `params.id` is checked for the reason `deactivateUserValidator` records: `users.id` is a real
 * `uuid` column, so a non-UUID string reaching PostgreSQL raises `22P02` and surfaces as a 500 — a
 * failure the SQLite-backed suites never see.
 *
 * The comment follows the lifecycle comment rule the cancellation comment already uses — trimmed, at
 * most 1,000 characters — so the two comments on either side of a cancelled invitation obey the same
 * rules. Turning a blank comment into `null` is the use case's job, not the validator's.
 */
export const restoreUserInvitationValidator = vine.create({
  params: vine.object({
    id: vine.string().uuid(),
  }),
  comment: lifecycleComment(),
})
