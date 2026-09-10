import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import DischargePolicy from '#discharges/shared/discharge_policy'
import { USER_ROLES } from '#models/user'

test.group('Discharge policy', () => {
  test('allows every active role to browse discharges', async ({ assert }) => {
    const policy = new DischargePolicy()

    for (const role of USER_ROLES) {
      const user = await UserFactory.apply('active').merge({ role }).make()

      assert.isTrue(policy.list(user), `expected ${role} to browse discharges`)
    }
  })

  test('denies users whose access is not active', async ({ assert }) => {
    const policy = new DischargePolicy()

    for (const accessStatus of ['PENDING', 'CANCELLED', 'DEACTIVATED'] as const) {
      const user = await UserFactory.merge({ accessStatus, role: 'OPERATIONS_ADMIN' }).make()

      assert.isFalse(policy.list(user), `expected ${accessStatus} access to be denied`)
    }
  })
})
