import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import UserRepository from '#users/shared/repositories/user_repository'

/**
 * Two concurrency controls, each proven here by the commit orders it resolves. The guard
 * `WHERE access_status = 'ACTIVE'` is what makes two deactivations of the *same* user record exactly
 * one. The actor and target rows locked in id order, with the actor re-read under that lock, are
 * what make two administrators deactivating *each other* resolve to exactly one — the second finds
 * its own actor gone (research D2 of the GH-21 feature). The single-connection test database cannot
 * run the two at once, so each race is played as the sequence it collapses to. These cases prove the
 * outcome union the use case reads, and that a refusal leaves no trace at all.
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

  // Two administrators deactivating each other at the same instant collapse, under the row lock, to
  // one of these two commit orders. Whichever lands second finds its own actor already deactivated.
  test('refuses the second of two admins deactivating each other', async ({ assert }) => {
    const first = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const second = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    await rememberedConnection(first.id)

    const winner = await deactivate(second.id, first.id)
    const loser = await deactivate(first.id, second.id)

    assert.equal(winner.kind, 'DEACTIVATED')
    assert.deepEqual(loser, { kind: 'ACTOR_NOT_ENTITLED' })
    const remaining = await User.findOrFail(first.id)
    assert.equal(remaining.accessStatus, 'ACTIVE')
    assert.equal(remaining.role, 'ORGANIZATION_ADMIN')
    assert.isNull(remaining.deactivatedAt)
    assert.isNull(remaining.deactivatedByUserId)
    assert.equal(await connectionsOf(first.id), 1)
    assert.equal((await User.findOrFail(second.id)).deactivatedByUserId, first.id)
  })

  test('keeps an organization admin through a three-admin cycle', async ({ assert }) => {
    const [a, b, c] = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .createMany(3)

    const results = []
    for (const [target, actor] of [
      [b, a],
      [c, b],
      [a, c],
    ]) {
      results.push(await deactivate(target.id, actor.id))
    }

    assert.deepEqual(
      results.map((result) => result.kind),
      ['DEACTIVATED', 'ACTOR_NOT_ENTITLED', 'DEACTIVATED'],
    )
    const survivor = await User.findOrFail(c.id)
    assert.equal(survivor.accessStatus, 'ACTIVE')
    assert.equal(survivor.role, 'ORGANIZATION_ADMIN')
    // Each deactivation that landed names an administrator who was still active when it did.
    assert.equal((await User.findOrFail(b.id)).deactivatedByUserId, a.id)
    assert.equal((await User.findOrFail(a.id)).deactivatedByUserId, c.id)
  })

  // A role change committed before the lock is one the write must see: the policy let an organization
  // admin through, and by the time the deactivation lands they no longer are one.
  test('refuses once the actor was demoted', async ({ assert }) => {
    for (const role of ['OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const actor = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
      const target = await UserFactory.apply('active').create()
      actor.role = role
      await actor.save()

      const result = await deactivate(target.id, actor.id)

      assert.deepEqual(result, { kind: 'ACTOR_NOT_ENTITLED' }, role)
      const untouched = await User.findOrFail(target.id)
      assert.equal(untouched.accessStatus, 'ACTIVE')
      assert.isNull(untouched.deactivatedAt)
    }
  })

  test('reports lost entitlement ahead of any reason about the target', async ({ assert }) => {
    const deactivatedActor = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    deactivatedActor.accessStatus = 'DEACTIVATED'
    await deactivatedActor.save()
    const demotedActor = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    for (const actor of [deactivatedActor, demotedActor]) {
      for (const state of ['invited', 'cancelled', 'deactivated'] as const) {
        const target = await UserFactory.apply(state).create()
        await rememberedConnection(target.id)
        const before = await User.findOrFail(target.id)

        const result = await deactivate(target.id, actor.id)

        assert.deepEqual(result, { kind: 'ACTOR_NOT_ENTITLED' }, `${actor.role} → ${state}`)
        const after = await User.findOrFail(target.id)
        assert.equal(after.accessStatus, before.accessStatus)
        assert.deepEqual(
          after.deactivatedAt?.toISO() ?? null,
          before.deactivatedAt?.toISO() ?? null,
        )
        assert.equal(after.deactivatedByUserId, before.deactivatedByUserId)
        assert.equal(await connectionsOf(target.id), 1)
      }

      assert.deepEqual(await deactivate('00000000-0000-4000-8000-999999999999', actor.id), {
        kind: 'ACTOR_NOT_ENTITLED',
      })
    }
  })

  // The requirement is independent of the access status and of the role: the administrator still
  // counts as an active organization admin, and still leaves one behind.
  test('still counts an organization admin who owes a password renewal', async ({ assert }) => {
    const actor = await UserFactory.apply('passwordRenewalRequired')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const target = await UserFactory.apply('active').create()
    assert.equal(actor.accessStatus, 'ACTIVE')
    assert.isNotNull(actor.passwordRenewalRequiredAt)

    const result = await deactivate(target.id, actor.id)

    assert.equal(result.kind, 'DEACTIVATED')
  })
})
