import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserActivationTokenFactory } from '#database/factories/user_activation_token_factory'
import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import UserActivationToken from '#models/user_activation_token'
import UserRepository from '#users/shared/repositories/user_repository'

/**
 * The guard, not a lock, is the concurrency control: `WHERE access_status = 'PENDING'` is what makes
 * two racing cancellations record exactly one. These cases prove the outcome union the use case
 * reads, that the token goes with the status and only with it, and that a refusal leaves no trace.
 */
test.group('Cancel pending invitation repository write', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  const organizationAdmin = () =>
    UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

  const pendingUserWithLink = async () => {
    const inviter = await organizationAdmin()
    const user = await UserFactory.apply('invited').merge({ role: 'OPERATIONS_LEAD' }).create()
    // Written after creation rather than merged in: the `invited` state runs after the merged
    // attributes and would put `invitedByUserId` back to null.
    user.invitedByUserId = inviter.id
    await user.save()
    await UserActivationTokenFactory.merge({ userId: user.id }).create()

    return { user, inviter }
  }

  const tokensOf = async (userId: string) =>
    (await UserActivationToken.query().where('userId', userId)).length

  const cancel = async (id: string, actorId: string, comment: string | null = null) => {
    const repository = await app.container.make(UserRepository)

    return repository.cancelPendingInvitation({
      id,
      cancelledByUserId: actorId,
      cancelledAt: DateTime.now(),
      comment,
    })
  }

  test('cancels a pending user and records the event, its administrator, and its comment', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const { user } = await pendingUserWithLink()
    const at = DateTime.now()

    const result = await cancel(user.id, admin.id, 'Hired elsewhere.')

    assert.equal(result.kind, 'CANCELLED')
    const cancelled = await User.findOrFail(user.id)
    assert.equal(cancelled.accessStatus, 'CANCELLED')
    assert.equal(cancelled.cancelledByUserId, admin.id)
    assert.equal(cancelled.cancellationComment, 'Hired elsewhere.')
    // Compared at second precision: PostgreSQL stores these timestamps truncated to the second
    // while SQLite keeps the fraction, so only the whole seconds are comparable across dialects.
    assert.isAtLeast(
      Math.floor(cancelled.cancelledAt?.toSeconds() ?? 0),
      Math.floor(at.toSeconds()),
    )
  })

  test('deletes the pending user activation token and nobody else', async ({ assert }) => {
    const admin = await organizationAdmin()
    const { user } = await pendingUserWithLink()
    const { user: bystander } = await pendingUserWithLink()

    await cancel(user.id, admin.id)

    assert.equal(await tokensOf(user.id), 0)
    assert.equal(await tokensOf(bystander.id), 1)
  })

  test('keeps identity, role, password, and the invitation event unchanged', async ({ assert }) => {
    const admin = await organizationAdmin()
    const { user, inviter } = await pendingUserWithLink()
    // Read back rather than reused from memory: both dialects store these timestamps at second
    // precision, so an in-memory `DateTime` carries milliseconds the row never had.
    const before = await User.findOrFail(user.id)

    await cancel(user.id, admin.id)

    const after = await User.findOrFail(user.id)
    assert.equal(after.firstName, before.firstName)
    assert.equal(after.lastName, before.lastName)
    assert.equal(after.email, before.email)
    assert.equal(after.role, before.role)
    assert.isNull(after.password)
    assert.equal(after.invitedByUserId, inviter.id)
    assert.equal(after.invitedAt?.toISO(), before.invitedAt?.toISO())
    assert.isNull(after.activatedAt)
    assert.isNull(after.deactivatedAt)
  })

  test('returns the cancelled user with every access-history actor resolved', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const { user, inviter } = await pendingUserWithLink()

    const result = await cancel(user.id, admin.id)

    assert.equal(result.kind, 'CANCELLED')
    if (result.kind === 'CANCELLED') {
      assert.equal(result.user.cancelledBy.id, admin.id)
      assert.equal(result.user.invitedBy.id, inviter.id)
    }
  })

  test('reports the observed status without writing when the user is not pending', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const firstCanceller = await organizationAdmin()

    for (const [state, accessStatus] of [
      ['active', 'ACTIVE'],
      ['deactivated', 'DEACTIVATED'],
      ['cancelled', 'CANCELLED'],
    ] as const) {
      const target = await UserFactory.apply(state).create()
      if (state === 'cancelled') {
        // A first cancellation's context, which a refused second one must leave standing.
        target.cancelledByUserId = firstCanceller.id
        target.cancellationComment = 'First withdrawal.'
        await target.save()
      }
      const before = await User.findOrFail(target.id)

      const result = await cancel(target.id, admin.id, 'Second attempt.')

      assert.deepEqual(result, { kind: 'NOT_PENDING', accessStatus })
      const after = await User.findOrFail(target.id)
      assert.equal(after.accessStatus, before.accessStatus)
      assert.equal(after.cancelledAt?.toISO() ?? null, before.cancelledAt?.toISO() ?? null)
      assert.equal(after.cancelledByUserId, before.cancelledByUserId)
      assert.equal(after.cancellationComment, before.cancellationComment)
      assert.equal(after.updatedAt?.toISO(), before.updatedAt?.toISO())
    }
  })

  test('reports a missing user without writing or touching anyone token', async ({ assert }) => {
    const admin = await organizationAdmin()
    const { user: bystander } = await pendingUserWithLink()

    const result = await cancel('00000000-0000-4000-8000-999999999999', admin.id)

    assert.deepEqual(result, { kind: 'NOT_FOUND' })
    assert.equal(await tokensOf(bystander.id), 1)
    assert.equal((await User.findOrFail(bystander.id)).accessStatus, 'PENDING')
  })

  test('lets exactly one of two attempts on the same user through', async ({ assert }) => {
    const admin = await organizationAdmin()
    const other = await organizationAdmin()
    const { user } = await pendingUserWithLink()

    const first = await cancel(user.id, admin.id, 'Winner.')
    const second = await cancel(user.id, other.id, 'Loser.')

    assert.equal(first.kind, 'CANCELLED')
    assert.deepEqual(second, { kind: 'NOT_PENDING', accessStatus: 'CANCELLED' })
    // The loser overwrites nothing: the recorded administrator and comment are still the winner's.
    const stored = await User.findOrFail(user.id)
    assert.equal(stored.cancelledByUserId, admin.id)
    assert.equal(stored.cancellationComment, 'Winner.')
  })

  test('cancels a pending user who holds no activation token', async ({ assert }) => {
    const admin = await organizationAdmin()
    const user = await UserFactory.apply('invited').create()

    const result = await cancel(user.id, admin.id)

    assert.equal(result.kind, 'CANCELLED')
    assert.equal((await User.findOrFail(user.id)).accessStatus, 'CANCELLED')
  })
})
