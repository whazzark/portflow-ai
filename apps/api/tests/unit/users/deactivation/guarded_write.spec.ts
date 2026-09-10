import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import UserRepository from '#users/shared/repositories/user_repository'

/**
 * The guard, not a lock, is the concurrency control: `WHERE access_status = 'ACTIVE'` is what makes
 * two racing deactivations record exactly one. These cases prove the outcome union the use case
 * reads, and that a refusal leaves no trace at all.
 */
test.group('Deactivate active user repository write', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  const rememberedConnection = (userId: string) =>
    db.table('remember_me_tokens').insert({
      tokenable_id: userId,
      hash: `hash-${userId}`,
      expires_at: DateTime.now().plus({ days: 30 }).toSQL({ includeOffset: false }),
      created_at: DateTime.now().toSQL({ includeOffset: false }),
      updated_at: DateTime.now().toSQL({ includeOffset: false }),
    })

  const connectionsOf = async (userId: string) =>
    (await db.from('remember_me_tokens').where('tokenable_id', userId)).length

  const deactivate = async (id: string, actorId: string) => {
    const repository = await app.container.make(UserRepository)

    return repository.deactivateActive({
      id,
      deactivatedByUserId: actorId,
      deactivatedAt: DateTime.now(),
    })
  }

  test('deactivates an active user and resolves the responsible administrator', async ({
    assert,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const target = await UserFactory.apply('active').create()

    const result = await deactivate(target.id, admin.id)

    assert.equal(result.kind, 'DEACTIVATED')
    if (result.kind === 'DEACTIVATED') {
      assert.equal(result.user.accessStatus, 'DEACTIVATED')
      assert.equal(result.user.deactivatedBy.id, admin.id)
    }
  })

  test('revokes the deactivated user remembered connections and nobody else', async ({
    assert,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const target = await UserFactory.apply('active').create()
    const bystander = await UserFactory.apply('active').create()
    await rememberedConnection(target.id)
    await rememberedConnection(target.id)
    await rememberedConnection(bystander.id)

    await deactivate(target.id, admin.id)

    assert.equal(await connectionsOf(target.id), 0)
    assert.equal(await connectionsOf(bystander.id), 1)
  })

  test('reports the observed status without writing when the user is not active', async ({
    assert,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    for (const [state, accessStatus] of [
      ['invited', 'PENDING'],
      ['cancelled', 'CANCELLED'],
      ['deactivated', 'DEACTIVATED'],
    ] as const) {
      const target = await UserFactory.apply(state).create()
      await rememberedConnection(target.id)
      const before = await User.findOrFail(target.id)

      const result = await deactivate(target.id, admin.id)

      assert.deepEqual(result, { kind: 'NOT_ACTIVE', accessStatus })
      const after = await User.findOrFail(target.id)
      assert.equal(after.accessStatus, before.accessStatus)
      assert.deepEqual(after.deactivatedAt?.toISO() ?? null, before.deactivatedAt?.toISO() ?? null)
      assert.equal(after.deactivatedByUserId, before.deactivatedByUserId)
      assert.equal(await connectionsOf(target.id), 1)
    }
  })

  test('reports a missing user without writing', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    const result = await deactivate('00000000-0000-4000-8000-999999999999', admin.id)

    assert.deepEqual(result, { kind: 'NOT_FOUND' })
  })

  test('lets exactly one of two attempts on the same user through', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const other = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const target = await UserFactory.apply('active').create()

    const first = await deactivate(target.id, admin.id)
    const second = await deactivate(target.id, other.id)

    assert.equal(first.kind, 'DEACTIVATED')
    assert.deepEqual(second, { kind: 'NOT_ACTIVE', accessStatus: 'DEACTIVATED' })
    // The loser overwrites nothing: the recorded administrator is still the winner's.
    assert.equal((await User.findOrFail(target.id)).deactivatedByUserId, admin.id)
  })
})
