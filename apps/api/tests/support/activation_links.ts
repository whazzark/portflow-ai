import { randomBytes } from 'node:crypto'

import { UserActivationTokenFactory } from '#database/factories/user_activation_token_factory'
import type User from '#models/user'
import { digestActivationSecret } from '#users/shared/activation_link_issuer'

/**
 * Stores an activation link for `user` the way an invitation does — only its digest — and hands the
 * secret back to the test, which is the one party that may know it. The factory itself never
 * retains a secret, so a fixture link can only be presented through this helper.
 */
export async function issueActivationLink(
  user: User,
  options: { expired?: boolean } = {},
): Promise<{ token: string }> {
  const token = randomBytes(32).toString('base64url')
  const factory = UserActivationTokenFactory.merge({
    userId: user.id,
    hash: digestActivationSecret(token),
  })

  await (options.expired ? factory.apply('expired') : factory).create()

  return { token }
}
