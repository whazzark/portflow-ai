import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import WeighingAreaPolicy from '#weighing_areas/shared/weighing_area_policy'

test.group('Weighing area policy', () => {
  test('allows administrators to administer and active users to select areas', async ({
    assert,
  }) => {
    const policy = new WeighingAreaPolicy()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).make()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).make()

    assert.isTrue(policy.create(admin))
    assert.isTrue(policy.list(admin))
    assert.isTrue(policy.update(admin))
    assert.isTrue(policy.archive(admin))
    assert.isTrue(policy.reactivate(admin))
    assert.isTrue(policy.view(observer))
    assert.isTrue(policy.listAvailable(observer))
    assert.isFalse(policy.create(observer))
  })
})
