import { test } from '@japa/runner'
import CustomerPolicy from '#customers/shared/customer_policy'
import { UserFactory } from '#database/factories/user_factory'

test.group('Customer policy', () => {
  test('allows organization and operations admins to administer customers', async ({ assert }) => {
    const policy = new CustomerPolicy()
    const organizationAdmin = await UserFactory.merge({ role: 'ORGANIZATION_ADMIN' }).make()
    const operationsAdmin = await UserFactory.merge({ role: 'OPERATIONS_ADMIN' }).make()

    assert.isTrue(policy.create(organizationAdmin))
    assert.isTrue(policy.list(operationsAdmin))
    assert.isTrue(policy.view(organizationAdmin))
    assert.isTrue(policy.update(operationsAdmin))
  })

  test('denies customer administration to read-only roles', async ({ assert }) => {
    const policy = new CustomerPolicy()
    const lead = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).make()
    const observer = await UserFactory.merge({ role: 'OBSERVER' }).make()

    assert.isFalse(policy.create(lead))
    assert.isFalse(policy.list(observer))
    assert.isFalse(policy.view(lead))
    assert.isFalse(policy.update(observer))
  })

  test('allows available reads only for active users', async ({ assert }) => {
    const policy = new CustomerPolicy()
    const activeObserver = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).make()
    const pendingObserver = await UserFactory.merge({ role: 'OBSERVER' }).make()

    assert.isTrue(policy.listAvailable(activeObserver))
    assert.isFalse(policy.listAvailable(pendingObserver))
  })
})
