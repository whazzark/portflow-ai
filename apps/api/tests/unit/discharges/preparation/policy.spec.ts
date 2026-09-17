import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import DischargePolicy from '#discharges/shared/discharge_policy'

const PREPARING_ROLES = ['OPERATIONS_LEAD', 'OPERATIONS_ADMIN', 'ORGANIZATION_ADMIN'] as const

test.group('Discharge preparation policy', () => {
  test('allows active operations leads and admins to create and correct discharges', async ({
    assert,
  }) => {
    const policy = new DischargePolicy()

    for (const role of PREPARING_ROLES) {
      const user = await UserFactory.apply('active').merge({ role }).make()

      assert.isTrue(policy.create(user), `expected ${role} to create a discharge`)
      assert.isTrue(policy.update(user), `expected ${role} to correct a discharge`)
      assert.isTrue(policy.start(user), `expected ${role} to start a discharge`)
    }
  })

  test('denies observers whatever their access status', async ({ assert }) => {
    const policy = new DischargePolicy()

    for (const accessStatus of ['ACTIVE', 'PENDING', 'CANCELLED', 'DEACTIVATED'] as const) {
      const user = await UserFactory.merge({ accessStatus, role: 'OBSERVER' }).make()

      assert.isFalse(policy.create(user), `expected an ${accessStatus} observer to be denied`)
      assert.isFalse(policy.update(user), `expected an ${accessStatus} observer to be denied`)
      assert.isFalse(policy.start(user), `expected an ${accessStatus} observer to be denied`)
    }
  })

  test('denies preparing roles whose access is not active', async ({ assert }) => {
    const policy = new DischargePolicy()

    for (const role of PREPARING_ROLES) {
      for (const accessStatus of ['PENDING', 'CANCELLED', 'DEACTIVATED'] as const) {
        const user = await UserFactory.merge({ accessStatus, role }).make()

        assert.isFalse(policy.create(user), `expected ${accessStatus} ${role} to be denied`)
        assert.isFalse(policy.update(user), `expected ${accessStatus} ${role} to be denied`)
        assert.isFalse(policy.start(user), `expected ${accessStatus} ${role} to be denied`)
      }
    }
  })
})
