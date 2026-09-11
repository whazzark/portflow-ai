import vine from '@vinejs/vine'

import { lifecycleComment } from '#shared/validators/lifecycle_validator'

/**
 * Validates the target in the path and the optional comment in the body. The body may be omitted
 * entirely: a cancellation needs no reason.
 *
 * `params.id` is checked for the reason `deactivateUserValidator` records: `users.id` is a real
 * `uuid` column, so a non-UUID string reaching PostgreSQL raises `22P02` and surfaces as a 500 — a
 * failure the SQLite-backed suites never see.
 *
 * The comment follows the lifecycle comment rule every site reference already uses — trimmed, at
 * most 1,000 characters — so the workbench can offer the same field with the same limit. Turning a
 * blank comment into `null` is the use case's job, not the validator's.
 */
export const cancelUserInvitationValidator = vine.create({
  params: vine.object({
    id: vine.string().uuid(),
  }),
  comment: lifecycleComment(),
})
