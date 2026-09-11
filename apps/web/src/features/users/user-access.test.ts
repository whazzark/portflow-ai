import { describe, expect, test } from 'vitest'

import type { SessionUser } from '@/features/auth/context/session-context'
import {
  OBSERVER,
  OPERATIONS_ADMIN,
  OPERATIONS_LEAD,
  ORGANIZATION_ADMIN,
  USERS,
} from '@/features/users/__tests__/support/fixtures'
import type { UserDto } from '@/features/users/types'
import { userAccessActions } from '@/features/users/user-access'

const userIn = (accessStatus: UserDto['accessStatus']) => {
  const user = USERS.find((candidate) => candidate.accessStatus === accessStatus)

  if (!user) {
    throw new Error(`No ${accessStatus} user in the fixtures`)
  }

  return user
}

const organizationAdmin = ORGANIZATION_ADMIN as unknown as SessionUser

describe('userAccessActions', () => {
  test.each([
    ['ACTIVE', ['deactivate']],
    ['PENDING', ['cancel-invitation', 'remove']],
    ['CANCELLED', ['remove']],
    ['DEACTIVATED', []],
  ] as const)('offers an organization admin the right action on a %s user', (status, actions) => {
    expect(userAccessActions(organizationAdmin, userIn(status))).toEqual(actions)
  })

  // The workbench never shows these viewers a pending user, but the rule must not lean on that.
  test.each([OPERATIONS_ADMIN, OPERATIONS_LEAD, OBSERVER])(
    'offers nothing to a $role, whatever the status',
    (viewer) => {
      for (const status of ['ACTIVE', 'PENDING', 'CANCELLED', 'DEACTIVATED'] as const) {
        expect(userAccessActions(viewer as unknown as SessionUser, userIn(status))).toEqual([])
      }
    },
  )

  test('offers nothing on the viewer own record, whatever its status', () => {
    for (const status of ['ACTIVE', 'PENDING', 'CANCELLED'] as const) {
      const user = userIn(status)

      expect(userAccessActions({ ...organizationAdmin, id: user.id }, user)).toEqual([])
    }
  })
})
