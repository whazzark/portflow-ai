import { createHash, randomBytes } from 'node:crypto'

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
 * The guard, not a lock, is the concurrency control: `WHERE access_status = 'CANCELLED'` is what makes
 * two racing restorations record exactly one and issue exactly one link. These cases prove the
 * outcome union the use case reads, that the new link replaces whatever token the user still holds,
 * that the cancellation and invitation events survive, and that a refusal leaves no trace.
 */
test.group('Restore cancelled invitation repository write', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  const organizationAdmin = () =>
    UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

  /**
   * A cancelled user as GH-12 leaves one — invited, then cancelled by an administrator with a comment —
   * except that it still holds a token: the stale row D5's delete exists for.
   */
  const cancelledUserWithStaleLink = async () => {
    const inviter = await organizationAdmin()
    const canceller = await organizationAdmin()
    const user = await UserFactory.apply('cancelled').merge({ role: 'OPERATIONS_LEAD' }).create()
    // Written after creation rather than merged in: the state runs after the merged attributes and
    // would put these back to null.
    user.invitedAt = DateTime.now().minus({ days: 3 })
    user.invitedByUserId = inviter.id
    user.cancelledByUserId = canceller.id
    user.cancellationComment = 'Start date postponed.'
    await user.save()
    const stale = await UserActivationTokenFactory.merge({ userId: user.id }).create()

    return { user, inviter, canceller, stale }
  }

  const newLink = () => ({
    hash: createHash('sha256').update(randomBytes(32)).digest('hex'),
    expiresAt: DateTime.now().plus({ days: 7 }),
  })

  const tokensOf = (userId: string) => UserActivationToken.query().where('userId', userId)

  const restore = async (
    id: string,
    actorId: string,
    comment: string | null = null,
    link = newLink(),
  ) => {
    const repository = await app.container.make(UserRepository)

    return repository.restoreCancelledInvitation({
      id,
      restoredByUserId: actorId,
      restoredAt: DateTime.now(),
      comment,
      activationTokenHash: link.hash,
      activationTokenExpiresAt: link.expiresAt,
    })
  }

  test('makes a cancelled user pending and records the restoration, its administrator, and its comment', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const { user } = await cancelledUserWithStaleLink()
    const before = await User.findOrFail(user.id)
    const at = DateTime.now()

    const result = await restore(user.id, admin.id, 'Start date confirmed.')

    assert.equal(result.kind, 'RESTORED')
    const restored = await User.findOrFail(user.id)
    assert.equal(restored.accessStatus, 'PENDING')
    assert.equal(restored.invitationRestoredByUserId, admin.id)
    assert.equal(restored.invitationRestorationComment, 'Start date confirmed.')
    // Compared at second precision: PostgreSQL stores these timestamps truncated to the second
    // while SQLite keeps the fraction, so only the whole seconds are comparable across dialects.
    assert.isAtLeast(
      Math.floor(restored.invitationRestoredAt?.toSeconds() ?? 0),
      Math.floor(at.toSeconds()),
    )
    assert.isAtLeast(
      Math.floor(restored.updatedAt?.toSeconds() ?? 0),
      Math.floor(before.updatedAt?.toSeconds() ?? 0),
    )
  })

  test('keeps identity, role, password, and the invitation and cancellation events unchanged', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const { user, inviter, canceller } = await cancelledUserWithStaleLink()
    // Read back rather than reused from memory: both dialects store these timestamps at second
    // precision, so an in-memory `DateTime` carries milliseconds the row never had.
    const before = await User.findOrFail(user.id)

    await restore(user.id, admin.id)

    const after = await User.findOrFail(user.id)
    assert.equal(after.firstName, before.firstName)
    assert.equal(after.lastName, before.lastName)
    assert.equal(after.email, before.email)
    assert.equal(after.role, before.role)
    assert.isNull(after.password)
    assert.equal(after.invitedByUserId, inviter.id)
    assert.equal(after.invitedAt?.toISO(), before.invitedAt?.toISO())
    assert.equal(after.cancelledByUserId, canceller.id)
    assert.equal(after.cancelledAt?.toISO(), before.cancelledAt?.toISO())
    assert.equal(after.cancellationComment, 'Start date postponed.')
    assert.isNull(after.activationLinkRenewedAt)
    assert.isNull(after.activationLinkRenewedByUserId)
    assert.isNull(after.activatedAt)
    assert.isNull(after.deactivatedAt)
  })

  test('replaces every token the user still held with exactly the new one', async ({ assert }) => {
    const admin = await organizationAdmin()
    const { user, stale } = await cancelledUserWithStaleLink()
    const link = newLink()

    await restore(user.id, admin.id, null, link)

    const tokens = await tokensOf(user.id)
    assert.lengthOf(tokens, 1, 'a restored user holds one live link')
    assert.equal(tokens[0].hash, link.hash)
    assert.equal(
      Math.floor(tokens[0].expiresAt.toSeconds()),
      Math.floor(link.expiresAt.toSeconds()),
    )
    assert.lengthOf(
      await UserActivationToken.query().where('hash', stale.hash),
      0,
      'no link issued before the restoration can be found any more',
    )
  })

  test('returns the restored user with every access-history actor and the new link resolved', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const { user, inviter, canceller } = await cancelledUserWithStaleLink()
    const link = newLink()

    const result = await restore(user.id, admin.id, null, link)

    assert.equal(result.kind, 'RESTORED')
    if (result.kind === 'RESTORED') {
      assert.equal(result.user.invitationRestoredBy.id, admin.id)
      assert.equal(result.user.cancelledBy.id, canceller.id)
      assert.equal(result.user.invitedBy.id, inviter.id)
      assert.equal(result.user.activationToken.hash, link.hash)
      assert.equal(result.activationToken.hash, link.hash)
    }
  })

  test('reports an unknown user as not found and issues nothing', async ({ assert }) => {
    const admin = await organizationAdmin()
    const link = newLink()

    const result = await restore('00000000-0000-4000-8000-999999999999', admin.id, null, link)

    assert.deepEqual(result, { kind: 'NOT_FOUND' })
    assert.lengthOf(await UserActivationToken.query().where('hash', link.hash), 0)
  })

  test('reports the observed status without writing when the user is not cancelled', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()

    for (const state of ['invited', 'active', 'deactivated'] as const) {
      const target = await UserFactory.apply(state).create()
      const held = await UserActivationTokenFactory.merge({ userId: target.id }).create()
      const before = await User.findOrFail(target.id)
      const link = newLink()

      const result = await restore(target.id, admin.id, 'Should not stick.', link)

      assert.deepEqual(result, { kind: 'NOT_CANCELLED', accessStatus: before.accessStatus })
      const after = await User.findOrFail(target.id)
      assert.equal(after.accessStatus, before.accessStatus)
      assert.isNull(after.invitationRestoredAt)
      assert.isNull(after.invitationRestoredByUserId)
      assert.isNull(after.invitationRestorationComment)
      assert.equal(after.updatedAt?.toISO(), before.updatedAt?.toISO())
      // A pending target's link — the one they may already hold — is left exactly as it was.
      const tokens = await tokensOf(target.id)
      assert.lengthOf(tokens, 1)
      assert.equal(tokens[0].hash, held.hash)
      assert.lengthOf(await UserActivationToken.query().where('hash', link.hash), 0)
    }
  })

  test('refuses a second restoration as already pending, and keeps the first one’s link and event', async ({
    assert,
  }) => {
    const first = await organizationAdmin()
    const second = await organizationAdmin()
    const { user } = await cancelledUserWithStaleLink()
    const firstLink = newLink()

    await restore(user.id, first.id, 'From the first.', firstLink)
    const result = await restore(user.id, second.id, 'From the second.')

    assert.deepEqual(result, { kind: 'NOT_CANCELLED', accessStatus: 'PENDING' })
    const tokens = await tokensOf(user.id)
    assert.lengthOf(tokens, 1, 'one restoration, one link')
    assert.equal(tokens[0].hash, firstLink.hash)
    const stored = await User.findOrFail(user.id)
    assert.equal(stored.invitationRestoredByUserId, first.id)
    assert.equal(stored.invitationRestorationComment, 'From the first.')
  })

  test('finds nothing to restore once the user was removed, and issues no link', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const { user } = await cancelledUserWithStaleLink()
    const repository = await app.container.make(UserRepository)
    const link = newLink()

    await repository.removeNeverActivated({ id: user.id })
    const result = await restore(user.id, admin.id, null, link)

    assert.deepEqual(result, { kind: 'NOT_FOUND' })
    assert.lengthOf(await UserActivationToken.query().where('hash', link.hash), 0)
  })

  test('lets a removal that follows a restoration take the new link with the user', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const { user } = await cancelledUserWithStaleLink()
    const repository = await app.container.make(UserRepository)
    const link = newLink()

    await restore(user.id, admin.id, null, link)
    const removal = await repository.removeNeverActivated({ id: user.id })

    assert.deepEqual(removal, { kind: 'REMOVED' })
    assert.lengthOf(await tokensOf(user.id), 0)
    assert.lengthOf(await UserActivationToken.query().where('hash', link.hash), 0)
  })

  test('rolls the status back when the new link cannot be written', async ({ assert }) => {
    const admin = await organizationAdmin()
    const { user, stale } = await cancelledUserWithStaleLink()
    // Another user's token already holds the digest, so inserting the new link hits the `hash`
    // unique index after the status `UPDATE` has run: the failure lands mid-transaction.
    const bystander = await UserFactory.apply('invited').create()
    const collision = await UserActivationTokenFactory.merge({ userId: bystander.id }).create()

    await assert.rejects(() =>
      restore(user.id, admin.id, 'Should not stick.', {
        hash: collision.hash,
        expiresAt: DateTime.now().plus({ days: 7 }),
      }),
    )

    const after = await User.findOrFail(user.id)
    assert.equal(after.accessStatus, 'CANCELLED')
    assert.isNull(after.invitationRestoredAt)
    assert.isNull(after.invitationRestoredByUserId)
    assert.isNull(after.invitationRestorationComment)
    // Rolled back whole: the row the delete had removed is back, and no new link exists for them.
    const tokens = await tokensOf(user.id)
    assert.lengthOf(tokens, 1)
    assert.equal(tokens[0].hash, stale.hash)
  })
})
