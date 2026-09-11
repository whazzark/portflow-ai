import { describe, expect, test } from 'vitest'

import type { UserDto } from '@/features/users/types'
import { canRenewActivationLink } from './user-permissions'

const ORGANIZATION_ADMIN = { id: 'viewer', role: 'ORGANIZATION_ADMIN' } as const

function userWith(accessStatus: UserDto['accessStatus']) {
  return { id: 'target', accessStatus } as UserDto
}

describe('canRenewActivationLink', () => {
  test('lets an organization admin renew a pending user’s link', () => {
    expect(canRenewActivationLink(ORGANIZATION_ADMIN, userWith('PENDING'))).toBe(true)
  })

  test.each(['ACTIVE', 'DEACTIVATED', 'CANCELLED'] as const)(
    'never offers it on a %s user, whom the API would refuse',
    (accessStatus) => {
      expect(canRenewActivationLink(ORGANIZATION_ADMIN, userWith(accessStatus))).toBe(false)
    },
  )

  test.each(['OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER'] as const)(
    'never offers it to an %s',
    (role) => {
      expect(canRenewActivationLink({ id: 'viewer', role }, userWith('PENDING'))).toBe(false)
    },
  )
})
