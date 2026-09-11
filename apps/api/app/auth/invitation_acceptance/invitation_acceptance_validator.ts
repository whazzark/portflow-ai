import vine from '@vinejs/vine'

import { newPasswordFields } from '#auth/shared/new_password_rule'

/**
 * `token` is a string and nothing more — no length, charset, or format rule. Any such rule would
 * answer a malformed link with a field-level `422` instead of the refusal every other unusable link
 * meets, telling the two apart. The digest accepts any input, and the bodyparser's size limit
 * already bounds it.
 *
 * A missing or empty token — the bodyparser turns `''` into `null` — is still a `422`: only a broken
 * client sends one, and a refusal about the request says nothing about any link.
 */
const token = vine.string()

export const invitationPreviewValidator = vine.create({
  token,
})

export const invitationAcceptanceValidator = vine.create({
  token,
  ...newPasswordFields,
})
