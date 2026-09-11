import { createHash } from 'node:crypto'

import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserActivationTokenFactory } from '#database/factories/user_activation_token_factory'
import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import UserActivationToken from '#models/user_activation_token'
import env from '#start/env'
import { UserNotPendingException } from '#users/activation_link_renewal/activation_link_renewal_exceptions'
import RenewActivationLinkUseCase from '#users/activation_link_renewal/renew_activation_link_use_case'
import ActivationLinkIssuer from '#users/shared/activation_link_issuer'
import { UserNotFoundException } from '#users/shared/user_exceptions'

function organizationAdmin() {
  return UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
}

async function pendingUserHoldingLink(state?: 'expired') {
  const user = await UserFactory.apply('invited').create()
  const tokenFactory = UserActivationTokenFactory.merge({ userId: user.id })
  const token = await (state ? tokenFactory.apply(state) : tokenFactory).create()

  return { user, token }
}

async function renew(target: User, actor: User) {
  const useCase = await app.container.make(RenewActivationLinkUseCase)

  return useCase.handle({
    targetUserId: target.id,
    actorUserId: actor.id,
    renewedAt: DateTime.now(),
  })
}

/** The digest the database keeps of the secret a link carries. */
function digestOf(url: string) {
  const secret = url.split('/activate/')[1] ?? ''

  return createHash('sha256').update(secret).digest('hex')
}

function tokensOf(user: User) {
  return UserActivationToken.query().where('userId', user.id)
}

test.group('RenewActivationLinkUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(ActivationLinkIssuer))

  test('replaces the pending user’s link with a new one, and the previous one ceases to exist', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const { user, token: previous } = await pendingUserHoldingLink()

    const { activationLink } = await renew(user, admin)

    const tokens = await tokensOf(user)
    assert.lengthOf(tokens, 1, 'a pending user holds one live link')
    assert.notEqual(tokens[0].hash, previous.hash)
    assert.equal(
      tokens[0].hash,
      digestOf(activationLink.url),
      'the stored digest is the new link’s',
    )
    assert.lengthOf(
      await UserActivationToken.query().where('hash', previous.hash),
      0,
      'no link can be found by the previous secret any more',
    )
    assert.isTrue(activationLink.url.startsWith(`${env.get('WEB_ORIGIN')}/activate/`))
  })

  test('issues the new link for 7 days from the renewal', async ({ assert }) => {
    const admin = await organizationAdmin()
    const { user } = await pendingUserHoldingLink()
    const sevenDaysFromNow = DateTime.now().plus({ days: 7 })

    const { activationLink } = await renew(user, admin)

    const [token] = await tokensOf(user)
    assert.isBelow(Math.abs(activationLink.expiresAt.diff(sevenDaysFromNow).as('seconds')), 5)
    assert.isBelow(Math.abs(token.expiresAt.diff(sevenDaysFromNow).as('seconds')), 5)
  })

  test('renews an expired link as it renews a valid one', async ({ assert }) => {
    const admin = await organizationAdmin()
    const { user, token: expired } = await pendingUserHoldingLink('expired')

    await renew(user, admin)

    const tokens = await tokensOf(user)
    assert.lengthOf(tokens, 1)
    assert.notEqual(tokens[0].hash, expired.hash)
    assert.isTrue(tokens[0].expiresAt > DateTime.now(), 'the renewed link is usable again')
  })

  test('issues a first link to a pending user who holds none', async ({ assert }) => {
    const admin = await organizationAdmin()
    const user = await UserFactory.apply('invited').create()

    const { activationLink } = await renew(user, admin)

    const tokens = await tokensOf(user)
    assert.lengthOf(tokens, 1)
    assert.equal(tokens[0].hash, digestOf(activationLink.url))
  })

  test('records the renewal against the administrator, and changes nothing else', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const inviter = await organizationAdmin()
    const user = await UserFactory.apply('invited').merge({ role: 'OPERATIONS_LEAD' }).create()
    // Set after creation: the `invited` state resets the inviter after a `merge`.
    await user.merge({ invitedByUserId: inviter.id }).save()
    await UserActivationTokenFactory.merge({ userId: user.id }).create()
    const before = await User.findOrFail(user.id)

    await renew(user, admin)

    const after = await User.findOrFail(user.id)
    assert.isNotNull(after.activationLinkRenewedAt)
    assert.equal(after.activationLinkRenewedByUserId, admin.id)
    assert.equal(after.accessStatus, 'PENDING')
    assert.isNull(after.password)
    assert.equal(after.firstName, before.firstName)
    assert.equal(after.lastName, before.lastName)
    assert.equal(after.email, before.email)
    assert.equal(after.role, before.role)
    assert.equal(after.invitedAt?.toISO(), before.invitedAt?.toISO())
    assert.equal(after.invitedByUserId, inviter.id)
    assert.isNull(after.activatedAt)
    assert.isNull(after.cancelledAt)
    assert.isNull(after.deactivatedAt)
    assert.isNull(after.reactivatedAt)
    assert.isNull(after.passwordResetAt)
    assert.isNull(after.passwordRenewalRequiredAt)
  })

  test('a later renewal replaces both the link and the recorded renewal', async ({ assert }) => {
    const first = await organizationAdmin()
    const second = await organizationAdmin()
    const { user } = await pendingUserHoldingLink()

    await renew(user, first)
    const { activationLink } = await renew(user, second)

    const tokens = await tokensOf(user)
    assert.lengthOf(tokens, 1, 'repeated renewals still leave one live link')
    assert.equal(tokens[0].hash, digestOf(activationLink.url), 'the live link is the last issued')
    const renewed = await User.findOrFail(user.id)
    assert.equal(renewed.activationLinkRenewedByUserId, second.id)
  })

  test('refuses an identifier that names no user', async ({ assert }) => {
    const admin = await organizationAdmin()
    const useCase = await app.container.make(RenewActivationLinkUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          targetUserId: '00000000-0000-4000-8000-000000000000',
          actorUserId: admin.id,
          renewedAt: DateTime.now(),
        }),
      UserNotFoundException.message,
    )
  })

  test('refuses a user who is not pending, naming the status they hold', async ({ assert }) => {
    const admin = await organizationAdmin()

    for (const state of ['active', 'deactivated', 'cancelled'] as const) {
      const target = await UserFactory.apply(state).create()
      const token = await UserActivationTokenFactory.merge({ userId: target.id }).create()

      try {
        await renew(target, admin)
        assert.fail(`a ${state} user should have been refused`)
      } catch (error) {
        assert.instanceOf(error, UserNotPendingException)
        assert.deepEqual((error as UserNotPendingException).meta, {
          accessStatus: target.accessStatus,
        })
      }

      const tokens = await tokensOf(target)
      assert.lengthOf(tokens, 1, 'a refused renewal neither deletes nor issues a link')
      assert.equal(tokens[0].hash, token.hash)
      assert.isNull((await User.findOrFail(target.id)).activationLinkRenewedAt)
    }
  })

  test('refuses an administrator naming themselves, as an active user', async ({ assert }) => {
    const admin = await organizationAdmin()

    try {
      await renew(admin, admin)
      assert.fail('an administrator is never a pending target')
    } catch (error) {
      assert.instanceOf(error, UserNotPendingException)
      assert.deepEqual((error as UserNotPendingException).meta, { accessStatus: 'ACTIVE' })
    }

    assert.lengthOf(await tokensOf(admin), 0)
  })

  test('a renewal that fails midway leaves the previous link exactly as it was', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const { user } = await pendingUserHoldingLink()
    // As stored, rather than the factory's in-memory instance, whose sub-second precision the
    // column does not keep.
    const [previous] = await tokensOf(user)
    // A digest already held by someone else: the insert of the new link violates the unique index
    // *after* the renewal was recorded and the previous link deleted, so only a rollback of the whole
    // transaction can leave the previous link standing.
    const { token: someoneElses } = await pendingUserHoldingLink()
    app.container.swap(ActivationLinkIssuer, () => ({
      issue: () => ({
        url: `${env.get('WEB_ORIGIN')}/activate/colliding`,
        hash: someoneElses.hash,
        expiresAt: DateTime.now().plus({ days: 7 }),
      }),
    }))

    await assert.rejects(() => renew(user, admin))

    const tokens = await tokensOf(user)
    assert.lengthOf(tokens, 1)
    assert.equal(tokens[0].hash, previous.hash, 'the previous link still works')
    assert.equal(tokens[0].expiresAt.toMillis(), previous.expiresAt.toMillis())
    assert.isNull((await User.findOrFail(user.id)).activationLinkRenewedAt)

    app.container.restore(ActivationLinkIssuer)
    const { activationLink } = await renew(user, admin)

    const retried = await tokensOf(user)
    assert.lengthOf(retried, 1, 'a retry once the problem is gone issues exactly one link')
    assert.equal(retried[0].hash, digestOf(activationLink.url))
  })

  test('refuses a user who stopped being pending since the view was loaded', async ({ assert }) => {
    const admin = await organizationAdmin()
    const { user } = await pendingUserHoldingLink()
    // What an acceptance does to the row: the user becomes active and their link is consumed.
    await user.merge({ accessStatus: 'ACTIVE', activatedAt: DateTime.now() }).save()
    await UserActivationToken.query().where('userId', user.id).delete()

    try {
      await renew(user, admin)
      assert.fail('a user who is no longer pending must not be handed a link')
    } catch (error) {
      assert.instanceOf(error, UserNotPendingException)
      assert.deepEqual((error as UserNotPendingException).meta, { accessStatus: 'ACTIVE' })
    }

    assert.lengthOf(await tokensOf(user), 0)
  })
})
