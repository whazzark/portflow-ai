import { describe, expect, test } from 'vitest'

import type { UserDto } from '@/features/users/types'
import { activationLinkState } from './activation-link'

const EXPIRY = '2026-09-18T09:30:00.000Z'
const AT_EXPIRY = Date.parse(EXPIRY)

function pendingUser(activationLinkExpiresAt: string | null | undefined) {
  const user = { id: 'pending', accessStatus: 'PENDING' } as Record<string, unknown>

  if (activationLinkExpiresAt !== undefined) {
    user.activationLinkExpiresAt = activationLinkExpiresAt
  }

  return user as UserDto
}

describe('activationLinkState', () => {
  test('is valid until the very instant the link expires', () => {
    expect(activationLinkState(pendingUser(EXPIRY), AT_EXPIRY - 1)).toBe('valid')
  })

  test('is expired from the instant the link expires onward', () => {
    expect(activationLinkState(pendingUser(EXPIRY), AT_EXPIRY)).toBe('expired')
    expect(activationLinkState(pendingUser(EXPIRY), AT_EXPIRY + 86_400_000)).toBe('expired')
  })

  test('is missing for a pending user holding no link', () => {
    expect(activationLinkState(pendingUser(null), AT_EXPIRY)).toBe('missing')
  })

  test('says nothing when the expiry was not disclosed to this viewer', () => {
    expect(activationLinkState(pendingUser(undefined), AT_EXPIRY)).toBeUndefined()
  })

  test.each(['ACTIVE', 'DEACTIVATED', 'CANCELLED'] as const)(
    'says nothing for a %s user, whose link no longer matters',
    (accessStatus) => {
      const user = { ...pendingUser(EXPIRY), accessStatus } as UserDto

      expect(activationLinkState(user, AT_EXPIRY - 1)).toBeUndefined()
    },
  )
})
