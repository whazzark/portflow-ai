import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import UserRepository from '#users/shared/repositories/user_repository'

/**
 * `deactivateActive` with the guard reversed: `WHERE access_status = 'DEACTIVATED'` is what makes
 * two racing reactivations record exactly one. These cases prove the outcome union the use case
 * reads, that the status, the event, the renewal requirement, and the revocation land together, and
 * that a refusal leaves no trace at all.
 */
test.group('Reactivate deactivated user repository write', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  const rememberedConnection = (userId: string) =>
    db.table('remember_me_tokens').insert({
      tokenable_id: userId,
      hash: `hash-${userId}-${Math.random()}`,
      expires_at: DateTime.now().plus({ days: 30 }).toSQL({ includeOffset: false }),
      created_at: DateTime.now().toSQL({ includeOffset: false }),
      updated_at: DateTime.now().toSQL({ includeOffset: false }),
    })

  const connectionsOf = async (userId: string) =>
    (await db.from('remember_me_tokens').where('tokenable_id', userId)).length

  const reactivate = async (id: string, actorId: string, at = DateTime.now()) => {
    const repository = await app.container.make(UserRepository)

    return repository.reactivateDeactivated({ id, reactivatedByUserId: actorId, reactivatedAt: at })
  }

  const organizationAdmin = () =>
    UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

  test('reactivates a deactivated user, records the event, and requires a new password', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const deactivator = await organizationAdmin()
    // `tap`, not `merge`: a factory state runs after `merge` and would reset the actor to null.
    const target = await UserFactory.apply('deactivated')
      .tap((user) => {
        user.deactivatedByUserId = deactivator.id
      })
      .create()
    const at = DateTime.now()

    const result = await reactivate(target.id, admin.id, at)

    assert.equal(result.kind, 'REACTIVATED')
    const stored = await User.findOrFail(target.id)
    assert.equal(stored.accessStatus, 'ACTIVE')
    assert.equal(stored.reactivatedByUserId, admin.id)
    // Compared at second precision: PostgreSQL stores these timestamps truncated to the second
    // while SQLite keeps the fraction, so only the whole seconds are comparable across dialects.
    assert.equal(stored.reactivatedAt?.toUnixInteger(), at.toUnixInteger())
    assert.equal(stored.passwordRenewalRequiredAt?.toUnixInteger(), at.toUnixInteger())
  })

  test('returns the user with the reactivation and the deactivation it reverses resolved', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const deactivator = await organizationAdmin()
    // `tap`, not `merge`: a factory state runs after `merge` and would reset the actor to null.
    const target = await UserFactory.apply('deactivated')
      .tap((user) => {
        user.deactivatedByUserId = deactivator.id
      })
      .create()

    const result = await reactivate(target.id, admin.id)

    if (result.kind !== 'REACTIVATED') {
      throw new Error(`Expected REACTIVATED, got ${result.kind}`)
    }
    assert.equal(result.user.accessStatus, 'ACTIVE')
    assert.equal(result.user.reactivatedBy.id, admin.id)
    assert.equal(result.user.deactivatedBy.id, deactivator.id)
  })

  test('leaves the credential, the identity, and every earlier event untouched', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const resetter = await organizationAdmin()
    const target = await UserFactory.apply('deactivated')
      .merge({
        role: 'OPERATIONS_LEAD',
        passwordResetAt: DateTime.now().minus({ days: 10 }),
        passwordResetByUserId: resetter.id,
      })
      .create()
    const before = await User.findOrFail(target.id)

    await reactivate(target.id, admin.id)

    const after = await User.findOrFail(target.id)
    assert.equal(after.password, before.password)
    assert.equal(after.role, 'OPERATIONS_LEAD')
    assert.equal(after.email, before.email)
    assert.equal(after.firstName, before.firstName)
    assert.equal(after.lastName, before.lastName)
    assert.equal(after.deactivatedAt?.toISO(), before.deactivatedAt?.toISO())
    assert.equal(after.deactivatedByUserId, before.deactivatedByUserId)
    assert.equal(after.passwordResetAt?.toISO(), before.passwordResetAt?.toISO())
    assert.equal(after.passwordResetByUserId, resetter.id)
  })

  test('revokes the reactivated user remembered connections and nobody else', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('deactivated').create()
    const bystander = await UserFactory.apply('active').create()
    // Normally none survive the deactivation; seeded here to prove the write guarantees it anyway.
    await rememberedConnection(target.id)
    await rememberedConnection(target.id)
    await rememberedConnection(bystander.id)

    await reactivate(target.id, admin.id)

    assert.equal(await connectionsOf(target.id), 0)
    assert.equal(await connectionsOf(bystander.id), 1)
  })

  test('reports the observed status without writing when the user is not deactivated', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()

    for (const [state, accessStatus] of [
      ['invited', 'PENDING'],
      ['cancelled', 'CANCELLED'],
      ['active', 'ACTIVE'],
    ] as const) {
      const target = await UserFactory.apply(state).create()
      await rememberedConnection(target.id)
      const before = await User.findOrFail(target.id)

      const result = await reactivate(target.id, admin.id)

      assert.deepEqual(result, { kind: 'NOT_DEACTIVATED', accessStatus })
      const after = await User.findOrFail(target.id)
      assert.equal(after.accessStatus, before.accessStatus)
      assert.equal(after.reactivatedAt?.toISO() ?? null, before.reactivatedAt?.toISO() ?? null)
      assert.equal(after.reactivatedByUserId, before.reactivatedByUserId)
      assert.isNull(after.passwordRenewalRequiredAt)
      assert.equal(await connectionsOf(target.id), 1)
    }
  })

  test('reports a missing user without writing', async ({ assert }) => {
    const admin = await organizationAdmin()

    const result = await reactivate('00000000-0000-4000-8000-999999999999', admin.id)

    assert.deepEqual(result, { kind: 'NOT_FOUND' })
  })

  test('lets exactly one of two attempts on the same user through', async ({ assert }) => {
    const admin = await organizationAdmin()
    const other = await organizationAdmin()
    const target = await UserFactory.apply('deactivated').create()

    const first = await reactivate(target.id, admin.id)
    const second = await reactivate(target.id, other.id)

    assert.equal(first.kind, 'REACTIVATED')
    assert.deepEqual(second, { kind: 'NOT_DEACTIVATED', accessStatus: 'ACTIVE' })
    // The loser overwrites nothing: the recorded administrator is still the winner's.
    assert.equal((await User.findOrFail(target.id)).reactivatedByUserId, admin.id)
  })
})
