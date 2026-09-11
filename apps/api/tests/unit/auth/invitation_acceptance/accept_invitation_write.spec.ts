import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import { digestActivationSecret } from '#users/shared/activation_link_issuer'
import UserRepository from '#users/shared/repositories/user_repository'

import { issueActivationLink } from '../../../support/activation_links.ts'

const HASHED_PASSWORD = 'scrypt$already-hashed-by-the-caller'

/**
 * The guarded delete of the token, not a lock, is the concurrency control: only one acceptance can
 * consume a link, and a refusal — whichever guard refused — leaves no trace at all, including the
 * link itself.
 */
test.group('Accept invitation repository write', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  const repository = () => app.container.make(UserRepository)

  const tokenRowsOf = async (userId: string) =>
    (await db.from('user_activation_tokens').where('user_id', userId)).length

  const accept = async (token: string, acceptedAt = DateTime.now()) =>
    (await repository()).acceptInvitation({
      tokenHash: digestActivationSecret(token),
      hashedPassword: HASHED_PASSWORD,
      acceptedAt,
    })

  test('finds the pending user a usable link opens', async ({ assert }) => {
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)

    const found = await (await repository()).findPendingByActivationTokenHash(
      digestActivationSecret(token),
      DateTime.now(),
    )

    assert.equal(found?.id, pending.id)
  })

  test('finds nothing for an unknown digest or an expired link', async ({ assert }) => {
    const pending = await UserFactory.apply('invited').create()
    const { token: expired } = await issueActivationLink(pending, { expired: true })

    const repo = await repository()

    assert.isNull(
      await repo.findPendingByActivationTokenHash(digestActivationSecret('nope'), DateTime.now()),
    )
    assert.isNull(
      await repo.findPendingByActivationTokenHash(digestActivationSecret(expired), DateTime.now()),
    )
  })

  for (const state of ['active', 'cancelled', 'deactivated'] as const) {
    test(`finds nothing for a link whose user is ${state}`, async ({ assert }) => {
      const user = await UserFactory.apply(state).create()
      const { token } = await issueActivationLink(user)

      const found = await (await repository()).findPendingByActivationTokenHash(
        digestActivationSecret(token),
        DateTime.now(),
      )

      assert.isNull(found)
    })
  }

  test('consumes the link and activates its user with a self-attributed event', async ({
    assert,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    // Merged rather than `apply('invited')`, whose state resets the inviter to null: the default
    // factory user is already `PENDING`.
    const pending = await UserFactory.merge({
      invitedAt: DateTime.now(),
      invitedByUserId: admin.id,
      role: 'OPERATIONS_LEAD',
    }).create()
    const { token } = await issueActivationLink(pending)
    // Read back rather than reused from memory: both dialects store these timestamps at second
    // precision, so an in-memory `DateTime` carries milliseconds the row never had.
    const before = await User.findOrFail(pending.id)
    const acceptedAt = DateTime.now().startOf('second')

    const result = await accept(token, acceptedAt)

    assert.equal(result.kind, 'ACCEPTED')
    assert.equal(await tokenRowsOf(pending.id), 0)

    const activated = await User.findOrFail(pending.id)
    assert.equal(activated.accessStatus, 'ACTIVE')
    assert.equal(activated.password, HASHED_PASSWORD)
    assert.equal(activated.activatedByUserId, pending.id)
    assert.equal(activated.activatedAt?.toSeconds(), acceptedAt.toSeconds())
    assert.isNull(activated.passwordRenewalRequiredAt)
    assert.equal(activated.firstName, before.firstName)
    assert.equal(activated.lastName, before.lastName)
    assert.equal(activated.email, before.email)
    assert.equal(activated.role, before.role)
    assert.equal(activated.invitedByUserId, admin.id)
    assert.equal(activated.invitedAt?.toSeconds(), before.invitedAt?.toSeconds())

    if (result.kind === 'ACCEPTED') {
      assert.equal(result.user.id, pending.id)
      assert.equal(result.user.accessStatus, 'ACTIVE')
      assert.equal(result.user.activatedBy.id, pending.id)
    }
  })

  test('refuses an unknown digest', async ({ assert }) => {
    const result = await accept('nope')

    assert.deepEqual(result, { kind: 'UNUSABLE' })
  })

  test('refuses a link that expired before the acceptance and keeps it for a renewal', async ({
    assert,
  }) => {
    const pending = await UserFactory.apply('invited').create()
    // Valid for 7 days from now, so an acceptance a day past that falls after its expiry.
    const { token } = await issueActivationLink(pending)

    const result = await accept(token, DateTime.now().plus({ days: 8 }))

    assert.deepEqual(result, { kind: 'UNUSABLE' })
    assert.equal(await tokenRowsOf(pending.id), 1)

    const untouched = await User.findOrFail(pending.id)
    assert.equal(untouched.accessStatus, 'PENDING')
    assert.isNull(untouched.password)
  })

  test('rolls the consumption back when the user is no longer pending', async ({ assert }) => {
    const cancelled = await UserFactory.apply('cancelled').create()
    const { token } = await issueActivationLink(cancelled)

    const result = await accept(token)

    assert.deepEqual(result, { kind: 'UNUSABLE' })
    assert.equal(await tokenRowsOf(cancelled.id), 1)

    const untouched = await User.findOrFail(cancelled.id)
    assert.equal(untouched.accessStatus, 'CANCELLED')
    assert.isNull(untouched.password)
    assert.isNull(untouched.activatedAt)
  })

  test('refuses a second acceptance through the same link', async ({ assert }) => {
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)

    const first = await accept(token)
    const second = await accept(token)

    assert.equal(first.kind, 'ACCEPTED')
    assert.deepEqual(second, { kind: 'UNUSABLE' })
  })
})
