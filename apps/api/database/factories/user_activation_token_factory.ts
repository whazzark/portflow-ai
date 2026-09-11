import { createHash, randomBytes } from 'node:crypto'

import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import UserActivationToken from '#models/user_activation_token'

/**
 * A stored activation link. The secret is thrown away on purpose, exactly as the invitation does:
 * a fixture that could reproduce the link would not be a fixture of this table.
 *
 * `userId` is supplied by the caller — a token without its pending user has nothing to activate.
 */
export const UserActivationTokenFactory = factory
  .define(UserActivationToken, () => ({
    hash: createHash('sha256').update(randomBytes(32)).digest('hex'),
    expiresAt: DateTime.now().plus({ days: 7 }),
  }))
  .state('expired', (token) => {
    token.expiresAt = DateTime.now().minus({ days: 1 })
  })
  .build()
