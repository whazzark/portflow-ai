import { createHash, randomBytes } from 'node:crypto'

import { DateTime } from 'luxon'
import env from '#start/env'

/**
 * How long an administrator-issued invitation stays usable. Long enough to survive a weekend or an
 * absence, short enough that a leaked link stops working on its own; recovering an expired one is
 * an activation link renewal, not a second invitation.
 */
export const ACTIVATION_LINK_LIFETIME_IN_DAYS = 7

const ACTIVATION_SECRET_BYTES = 32

export type IssuedActivationLink = {
  /** Handed to the inviting administrator once, and never readable again. */
  url: string
  /** The only trace kept of the secret above. */
  hash: string
  expiresAt: DateTime
}

/**
 * Issues the confidential activation link of a pending user.
 *
 * The secret is 256 bits of randomness, so a plain SHA-256 digest is the right one-way function:
 * scrypt exists to make *low-entropy* passwords expensive to guess, it would put a deliberately slow
 * hash inside an invitation write, and — decisively — a salted password hash cannot be looked up,
 * where accepting an invitation has to find a presented secret in one indexed query.
 *
 * A class rather than a module of functions so the clock and the format stay assertable through the
 * container, and so the renewal slice can reuse the issuance whole.
 */
export default class ActivationLinkIssuer {
  issue(): IssuedActivationLink {
    const secret = randomBytes(ACTIVATION_SECRET_BYTES).toString('base64url')
    const origin = env.get('WEB_ORIGIN').replace(/\/+$/, '')

    return {
      url: `${origin}/activate/${secret}`,
      hash: createHash('sha256').update(secret).digest('hex'),
      expiresAt: DateTime.now().plus({ days: ACTIVATION_LINK_LIFETIME_IN_DAYS }),
    }
  }
}
