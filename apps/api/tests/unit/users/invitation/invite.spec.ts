import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import UserActivationToken from '#models/user_activation_token'
import { EmailAlreadyInUseException } from '#users/invite/invitation_exceptions'
import InviteUserUseCase from '#users/invite/invite_user_use_case'
import UserRepository from '#users/shared/repositories/user_repository'

const anInvitation = {
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'claire.martin@portflow.test',
  role: 'OPERATIONS_LEAD' as const,
}

test.group('InviteUserUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(UserRepository))

  test('creates a pending user without a password', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    const { user } = await (await app.container.make(InviteUserUseCase)).handle({
      ...anInvitation,
      invitedBy: admin,
    })

    await user.refresh()
    assert.equal(user.accessStatus, 'PENDING')
    assert.isNull(user.password)
    assert.equal(user.firstName, 'Claire')
    assert.equal(user.lastName, 'Martin')
    assert.equal(user.email, 'claire.martin@portflow.test')
    assert.equal(user.role, 'OPERATIONS_LEAD')
  })

  test('records the invitation event and no other', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    const { user } = await (await app.container.make(InviteUserUseCase)).handle({
      ...anInvitation,
      invitedBy: admin,
    })

    assert.isNotNull(user.invitedAt)
    assert.equal(user.invitedByUserId, admin.id)
    assert.isNull(user.activatedAt)
    assert.isNull(user.cancelledAt)
    assert.isNull(user.deactivatedAt)
    assert.isNull(user.reactivatedAt)
    assert.isNull(user.passwordRenewalRequiredAt)
  })

  test('issues exactly one activation link for the created user', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    const { user, activationLink } = await (await app.container.make(InviteUserUseCase)).handle({
      ...anInvitation,
      invitedBy: admin,
    })

    const tokens = await UserActivationToken.query().where('userId', user.id)

    assert.lengthOf(tokens, 1)
    assert.isTrue(activationLink.url.includes('/activate/'))
    // The stored trace is a digest, never the secret the administrator was handed.
    assert.isFalse(activationLink.url.includes(tokens[0].hash))
    assert.equal(
      Math.round(activationLink.expiresAt.diff(DateTime.now(), 'days').days),
      7,
      'the link is issued for 7 days',
    )
  })

  test('refuses an email already held, whatever the access status', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    for (const state of ['invited', 'active', 'deactivated', 'cancelled'] as const) {
      const holder = await UserFactory.apply(state)
        .merge({ email: `held-${state}@portflow.test` })
        .create()
      const useCase = await app.container.make(InviteUserUseCase)

      await assert.rejects(
        () => useCase.handle({ ...anInvitation, email: holder.email, invitedBy: admin }),
        EmailAlreadyInUseException.message,
      )

      const users = await User.query().whereRaw('LOWER(email) = ?', [holder.email.toLowerCase()])
      assert.lengthOf(users, 1, 'no second access is created for the same person')
      assert.equal(users[0].accessStatus, holder.accessStatus, 'the existing user is untouched')
      assert.lengthOf(await UserActivationToken.query().where('userId', holder.id), 0)
    }
  })

  test('carries the existing access status so the administrator knows what to do next', async ({
    assert,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const cancelled = await UserFactory.apply('cancelled')
      .merge({ email: 'cancelled.holder@portflow.test' })
      .create()
    const useCase = await app.container.make(InviteUserUseCase)

    try {
      await useCase.handle({ ...anInvitation, email: cancelled.email, invitedBy: admin })
      assert.fail('the invitation should have been refused')
    } catch (error) {
      assert.instanceOf(error, EmailAlreadyInUseException)
      assert.deepEqual((error as EmailAlreadyInUseException).meta, { accessStatus: 'CANCELLED' })
    }
  })

  test('recognizes a padded, differently cased email as the same person', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const holder = await UserFactory.apply('invited')
      .merge({ email: 'held.case@portflow.test' })
      .create()
    const useCase = await app.container.make(InviteUserUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          ...anInvitation,
          email: '  HELD.CASE@Portflow.test  ',
          invitedBy: admin,
        }),
      EmailAlreadyInUseException.message,
    )

    assert.lengthOf(await User.query().whereRaw('LOWER(email) = ?', [holder.email]), 1)
  })

  // What a lost race looks like from the loser's side: its lookup found nothing, the unique index
  // refused the write, and the refusal must still name the winner's status.
  test('refuses an invitation the unique index decides is a duplicate', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const winner = await UserFactory.apply('invited').merge({ email: anInvitation.email }).create()
    let lookups = 0
    app.container.swap(
      UserRepository,
      () =>
        ({
          findByEmail: () => {
            lookups += 1

            return Promise.resolve(lookups === 1 ? null : winner)
          },
          invite: () => Promise.resolve({ kind: 'DUPLICATE_EMAIL' as const }),
        }) as unknown as UserRepository,
    )
    const useCase = await app.container.make(InviteUserUseCase)

    try {
      await useCase.handle({ ...anInvitation, invitedBy: admin })
      assert.fail('the invitation should have been refused')
    } catch (error) {
      assert.instanceOf(error, EmailAlreadyInUseException)
      assert.deepEqual((error as EmailAlreadyInUseException).meta, { accessStatus: 'PENDING' })
    }

    assert.equal(lookups, 2, 'the winner is re-read to name its status')
  })

  test('strips the surrounding spaces of the recorded identity', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    const { user } = await (await app.container.make(InviteUserUseCase)).handle({
      firstName: '  Claire  ',
      lastName: '  Martin  ',
      email: '  Claire.Martin@portflow.test  ',
      role: 'OBSERVER',
      invitedBy: admin,
    })

    assert.equal(user.firstName, 'Claire')
    assert.equal(user.lastName, 'Martin')
    assert.equal(user.email, 'Claire.Martin@portflow.test')
  })

  test('accepts every responsibility level, including another organization admin', async ({
    assert,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const useCase = await app.container.make(InviteUserUseCase)

    for (const role of [
      'ORGANIZATION_ADMIN',
      'OPERATIONS_ADMIN',
      'OPERATIONS_LEAD',
      'OBSERVER',
    ] as const) {
      const { user } = await useCase.handle({
        ...anInvitation,
        email: `${role.toLowerCase()}@portflow.test`,
        role,
        invitedBy: admin,
      })

      assert.equal(user.role, role)
      assert.equal(user.accessStatus, 'PENDING')
    }
  })
})
