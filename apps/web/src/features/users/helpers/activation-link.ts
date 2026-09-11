import type { UserDto } from '@/features/users/types'

export type ActivationLinkState = 'valid' | 'expired' | 'missing'

/**
 * Where a pending user's activation link stands, derived from the expiry the collection carries.
 *
 * Computed at render time against the clock, on purpose: validity is a comparison with the current
 * time rather than a recorded state, so a link that expires while the collection is open reads as
 * expired at the next render — it needs no renewal, job, or refetch to become so. The API sends the
 * expiry rather than a flag for exactly that reason.
 *
 * `undefined` means there is nothing to present: the user is not pending — a link only matters while
 * they are — or the expiry was withheld from this viewer. The key is then absent rather than null,
 * and absence must never be read as "no link".
 */
export function activationLinkState(user: UserDto, now: number): ActivationLinkState | undefined {
  if (user.accessStatus !== 'PENDING' || !('activationLinkExpiresAt' in user)) {
    return undefined
  }

  const expiresAt = user.activationLinkExpiresAt

  if (expiresAt === null || expiresAt === undefined) {
    return 'missing'
  }

  return Date.parse(expiresAt) > now ? 'valid' : 'expired'
}
