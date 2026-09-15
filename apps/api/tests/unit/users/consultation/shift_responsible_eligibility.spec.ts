import { test } from '@japa/runner'

import { USER_ROLES } from '#models/user'
import {
  isEligibleShiftResponsible,
  SHIFT_RESPONSIBLE_ROLES,
} from '#users/shared/shift_responsible_eligibility'

test.group('Shift responsible eligibility', () => {
  test('names operations leads, operations admins, and organization admins', ({ assert }) => {
    assert.deepEqual(
      [...SHIFT_RESPONSIBLE_ROLES],
      ['OPERATIONS_LEAD', 'OPERATIONS_ADMIN', 'ORGANIZATION_ADMIN'],
    )
  })

  test('allows active users holding one of those roles', ({ assert }) => {
    for (const role of SHIFT_RESPONSIBLE_ROLES) {
      assert.isTrue(isEligibleShiftResponsible({ accessStatus: 'ACTIVE', role }), role)
    }
  })

  test('rejects an active observer', ({ assert }) => {
    assert.isFalse(isEligibleShiftResponsible({ accessStatus: 'ACTIVE', role: 'OBSERVER' }))
  })

  test('rejects every role whose access is not active', ({ assert }) => {
    for (const role of USER_ROLES) {
      for (const accessStatus of ['PENDING', 'CANCELLED', 'DEACTIVATED'] as const) {
        assert.isFalse(
          isEligibleShiftResponsible({ accessStatus, role }),
          `expected ${accessStatus} ${role} to be ineligible`,
        )
      }
    }
  })
})
