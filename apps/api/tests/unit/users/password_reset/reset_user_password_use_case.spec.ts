import app from '@adonisjs/core/services/app'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { USER_FACTORY_PASSWORD, UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import {
  PasswordResetSelfForbiddenException,
  UserNotActiveException,
  UserNotFoundException,
} from '#users/password_reset/password_reset_exceptions'
import ResetUserPasswordUseCase from '#users/password_reset/reset_user_password_use_case'

function resetUserPasswordUseCase() {
  return app.container.make(ResetUserPasswordUseCase)
}

test.group('Reset user password use case', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('records the renewal requirement and the attributed reset event', async ({ assert }) => {
    const administrator = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const target = await UserFactory.apply('active').create()
    const resetAt = DateTime.now()

    const useCase = await resetUserPasswordUseCase()
    await useCase.handle({ targetUserId: target.id, actorUserId: administrator.id, resetAt })

    const reset = await User.findOrFail(target.id)
    assert.isNotNull(reset.passwordRenewalRequiredAt)
    assert.isNotNull(reset.passwordResetAt)
    assert.equal(reset.passwordResetByUserId, administrator.id)
  })

  test('keeps the password itself unchanged, because the reset hands over no credential', async ({
    assert,
  }) => {
    const administrator = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const target = await UserFactory.apply('active').create()

    const useCase = await resetUserPasswordUseCase()
    await useCase.handle({
      targetUserId: target.id,
      actorUserId: administrator.id,
      resetAt: DateTime.now(),
    })

    const reset = await User.findOrFail(target.id)
    assert.isTrue(await hash.verify(reset.password ?? '', USER_FACTORY_PASSWORD))
  })

  test('keeps identity, email, role, access status, and every lifecycle event unchanged', async ({
    assert,
  }) => {
    const administrator = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const target = await UserFactory.apply('active').create()
    // Read back rather than reused from memory: both dialects store these timestamps at second
    // precision, so an in-memory `DateTime` carries milliseconds the row never had.
    const before = await User.findOrFail(target.id)

    const useCase = await resetUserPasswordUseCase()
    await useCase.handle({
      targetUserId: target.id,
      actorUserId: administrator.id,
      resetAt: DateTime.now(),
    })

    const reset = await User.findOrFail(target.id)
    assert.equal(reset.id, before.id)
    assert.equal(reset.email, before.email)
    assert.equal(reset.firstName, before.firstName)
    assert.equal(reset.lastName, before.lastName)
    assert.equal(reset.role, before.role)
    assert.equal(reset.accessStatus, before.accessStatus)
    for (const timestamp of [
      'invitedAt',
      'activatedAt',
      'cancelledAt',
      'deactivatedAt',
      'reactivatedAt',
    ] as const) {
      assert.deepEqual(reset[timestamp]?.toMillis() ?? null, before[timestamp]?.toMillis() ?? null)
    }
    for (const actor of [
      // biome-ignore lint/security/noSecrets: field name, not a secret
      'invitedByUserId',
      'activatedByUserId',
      'cancelledByUserId',
      'deactivatedByUserId',
      'reactivatedByUserId',
    ] as const) {
      assert.equal(reset[actor], before[actor])
    }
  })

  test('rejects a reset targeting a user who is not active, recording nothing', async ({
    assert,
  }) => {
    const administrator = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()

    for (const state of ['invited', 'deactivated', 'cancelled'] as const) {
      const target = await UserFactory.apply(state).create()

      const useCase = await resetUserPasswordUseCase()
      await assert.rejects(
        () =>
          useCase.handle({
            targetUserId: target.id,
            actorUserId: administrator.id,
            resetAt: DateTime.now(),
          }),
        UserNotActiveException.message,
      )

      const untouched = await User.findOrFail(target.id)
      assert.isNull(untouched.passwordRenewalRequiredAt)
      assert.isNull(untouched.passwordResetAt)
    }
  })

  test('rejects a reset targeting an identifier naming no user', async ({ assert }) => {
    const administrator = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()

    const useCase = await resetUserPasswordUseCase()
    await assert.rejects(
      () =>
        useCase.handle({
          targetUserId: '3f1b0b64-0000-4000-8000-000000000000',
          actorUserId: administrator.id,
          resetAt: DateTime.now(),
        }),
      UserNotFoundException.message,
    )
  })

  // Refused before any database round trip: requiring oneself to renew is a self-service password
  // change under another name, which `#117` placed out of scope.
  test('rejects an administrator resetting their own password', async ({ assert }) => {
    const administrator = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()

    const useCase = await resetUserPasswordUseCase()
    await assert.rejects(
      () =>
        useCase.handle({
          targetUserId: administrator.id,
          actorUserId: administrator.id,
          resetAt: DateTime.now(),
        }),
      PasswordResetSelfForbiddenException.message,
    )

    const untouched = await User.findOrFail(administrator.id)
    assert.isNull(untouched.passwordRenewalRequiredAt)
  })

  test('refreshes the event to the latest administrator when a user is reset twice', async ({
    assert,
  }) => {
    const firstAdministrator = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const secondAdministrator = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const target = await UserFactory.apply('active').create()

    const useCase = await resetUserPasswordUseCase()
    await useCase.handle({
      targetUserId: target.id,
      actorUserId: firstAdministrator.id,
      resetAt: DateTime.now(),
    })
    await useCase.handle({
      targetUserId: target.id,
      actorUserId: secondAdministrator.id,
      resetAt: DateTime.now(),
    })

    // One state, refreshed — never a queue of two renewals to clear.
    const reset = await User.findOrFail(target.id)
    assert.isNotNull(reset.passwordRenewalRequiredAt)
    assert.equal(reset.passwordResetByUserId, secondAdministrator.id)
  })

  test('returns the reset user so the caller serializes the state it just recorded', async ({
    assert,
  }) => {
    const administrator = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const target = await UserFactory.apply('active').create()

    const useCase = await resetUserPasswordUseCase()
    const returned = await useCase.handle({
      targetUserId: target.id,
      actorUserId: administrator.id,
      resetAt: DateTime.now(),
    })

    assert.equal(returned.id, target.id)
    assert.isNotNull(returned.passwordRenewalRequiredAt)
    assert.equal(returned.passwordResetByUserId, administrator.id)
  })
})
