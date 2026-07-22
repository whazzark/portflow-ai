import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import DockPolicy from '#docks/shared/dock_policy'

test.group('Dock policy', () => {
  test('allows administrators to administer docks', async ({ assert }) => {
    const policy = new DockPolicy()
    const organizationAdmin = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .make()
    const operationsAdmin = await UserFactory.apply('active')
      .merge({ role: 'OPERATIONS_ADMIN' })
      .make()

    assert.isTrue(policy.create(organizationAdmin))
    assert.isTrue(policy.list(operationsAdmin))
    assert.isTrue(policy.update(operationsAdmin))
    assert.isTrue(policy.archive(organizationAdmin))
    assert.isTrue(policy.reactivate(operationsAdmin))
  })

  test('allows active users to inspect docks but not administer them', async ({ assert }) => {
    const policy = new DockPolicy()
    const lead = await UserFactory.apply('active').merge({ role: 'OPERATIONS_LEAD' }).make()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).make()

    assert.isTrue(policy.view(lead))
    assert.isTrue(policy.listAvailable(observer))
    assert.isFalse(policy.create(lead))
    assert.isFalse(policy.update(observer))
  })

  test('denies inactive users', async ({ assert }) => {
    const policy = new DockPolicy()
    const pending = await UserFactory.merge({ role: 'OBSERVER' }).make()

    assert.isFalse(policy.view(pending))
    assert.isFalse(policy.listAvailable(pending))
  })
})
