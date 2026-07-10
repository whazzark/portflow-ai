import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'

test.group('Persist user access status', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('creates a pending user with no password', async ({ assert }) => {
    const user = await UserFactory.create()

    assert.equal(user.accessStatus, 'PENDING')
    assert.isNull(user.password)
  })

  test('persists invitation metadata set at creation', async ({ assert }) => {
    const inviter = await UserFactory.apply('active').create()

    const invitedAt = DateTime.now()
    const user = await UserFactory.merge({ invitedAt, invitedByUserId: inviter.id }).create()
    await user.refresh()

    assert.equal(user.invitedByUserId, inviter.id)
    assert.isTrue(user.invitedAt?.hasSame(invitedAt, 'second'))
  })

  test('persists activation metadata and the chosen password', async ({ assert }) => {
    const user = await UserFactory.create()

    const activatedAt = DateTime.now()
    user.accessStatus = 'ACTIVE'
    user.password = 'a-hashed-password'
    user.activatedAt = activatedAt
    await user.save()
    await user.refresh()

    assert.equal(user.accessStatus, 'ACTIVE')
    assert.equal(user.password, 'a-hashed-password')
    assert.isTrue(user.activatedAt?.hasSame(activatedAt, 'second'))
  })

  test('persists cancellation metadata for a pending user', async ({ assert }) => {
    const canceller = await UserFactory.apply('active').create()
    const user = await UserFactory.create()

    const cancelledAt = DateTime.now()
    user.accessStatus = 'CANCELLED'
    user.cancelledAt = cancelledAt
    user.cancelledByUserId = canceller.id
    await user.save()
    await user.refresh()

    assert.equal(user.accessStatus, 'CANCELLED')
    assert.equal(user.cancelledByUserId, canceller.id)
    assert.isTrue(user.cancelledAt?.hasSame(cancelledAt, 'second'))
  })

  test('persists deactivation and reactivation metadata for an active user', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const user = await UserFactory.apply('active').create()

    const deactivatedAt = DateTime.now()
    user.accessStatus = 'DEACTIVATED'
    user.deactivatedAt = deactivatedAt
    user.deactivatedByUserId = actor.id
    await user.save()
    await user.refresh()

    assert.equal(user.accessStatus, 'DEACTIVATED')
    assert.equal(user.deactivatedByUserId, actor.id)
    assert.isTrue(user.deactivatedAt?.hasSame(deactivatedAt, 'second'))

    const reactivatedAt = DateTime.now()
    user.accessStatus = 'ACTIVE'
    user.reactivatedAt = reactivatedAt
    user.reactivatedByUserId = actor.id
    await user.save()
    await user.refresh()

    assert.equal(user.accessStatus, 'ACTIVE')
    assert.equal(user.reactivatedByUserId, actor.id)
    assert.isTrue(user.reactivatedAt?.hasSame(reactivatedAt, 'second'))
  })

  test('rejects a duplicate email', async ({ assert }) => {
    const user = await UserFactory.create()

    await assert.rejects(() => UserFactory.merge({ email: user.email }).create())
  })
})
