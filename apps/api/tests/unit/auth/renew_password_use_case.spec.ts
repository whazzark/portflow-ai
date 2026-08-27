import app from '@adonisjs/core/services/app'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { PasswordRenewalNotRequiredException } from '#auth/password_renewal/password_renewal_exceptions'
import RenewPasswordUseCase from '#auth/password_renewal/renew_password_use_case'
import { USER_FACTORY_PASSWORD, UserFactory } from '#database/factories/user_factory'
import User from '#models/user'

const NEW_PASSWORD = 'correct-horse-battery-staple'

test.group('Renew password use case', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('records the new password and clears the renewal requirement', async ({ assert }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()

    const renewPasswordUseCase = await app.container.make(RenewPasswordUseCase)
    await renewPasswordUseCase.handle({
      user,
      password: NEW_PASSWORD,
      keptRememberedConnectionId: null,
    })

    const renewed = await User.findOrFail(user.id)
    assert.isNull(renewed.passwordRenewalRequiredAt)
    assert.isTrue(await hash.verify(renewed.password ?? '', NEW_PASSWORD))
    assert.isFalse(await hash.verify(renewed.password ?? '', USER_FACTORY_PASSWORD))
  })

  test('keeps identity, email, role, access status, and every lifecycle timestamp unchanged', async ({
    assert,
  }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()
    // Read back rather than reused from memory: both dialects store these timestamps at second
    // precision, so an in-memory `DateTime` carries milliseconds the row never had.
    const before = await User.findOrFail(user.id)

    const renewPasswordUseCase = await app.container.make(RenewPasswordUseCase)
    await renewPasswordUseCase.handle({
      user,
      password: NEW_PASSWORD,
      keptRememberedConnectionId: null,
    })

    const renewed = await User.findOrFail(user.id)
    assert.equal(renewed.id, before.id)
    assert.equal(renewed.email, before.email)
    assert.equal(renewed.firstName, before.firstName)
    assert.equal(renewed.lastName, before.lastName)
    assert.equal(renewed.role, before.role)
    assert.equal(renewed.accessStatus, before.accessStatus)
    for (const timestamp of [
      'invitedAt',
      'activatedAt',
      'cancelledAt',
      'deactivatedAt',
      'reactivatedAt',
    ] as const) {
      assert.deepEqual(
        renewed[timestamp]?.toMillis() ?? null,
        before[timestamp]?.toMillis() ?? null,
      )
    }
    for (const actor of [
      // biome-ignore lint/security/noSecrets: field name, not a secret
      'invitedByUserId',
      'activatedByUserId',
      'cancelledByUserId',
      'deactivatedByUserId',
      'reactivatedByUserId',
    ] as const) {
      assert.equal(renewed[actor], before[actor])
    }
  })

  test('rejects a renewal for a user owing nothing without touching the stored password', async ({
    assert,
  }) => {
    const user = await UserFactory.apply('active').create()
    const storedPassword = user.password

    const renewPasswordUseCase = await app.container.make(RenewPasswordUseCase)
    await assert.rejects(
      () =>
        renewPasswordUseCase.handle({
          user,
          password: NEW_PASSWORD,
          keptRememberedConnectionId: null,
        }),
      PasswordRenewalNotRequiredException,
    )

    const untouched = await User.findOrFail(user.id)
    assert.equal(untouched.password, storedPassword)
    assert.isNull(untouched.passwordRenewalRequiredAt)
  })
  test('records exactly one password when two renewals are submitted at once', async ({
    assert,
  }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()
    const secondUser = await User.findOrFail(user.id)

    const renewPasswordUseCase = await app.container.make(RenewPasswordUseCase)

    // Two submissions racing over one requirement. There is no lock: the `UPDATE`'s
    // `WHERE password_renewal_required_at IS NOT NULL` is the concurrency control, so whichever
    // statement lands second matches zero rows and is refused.
    const outcomes = await Promise.allSettled([
      renewPasswordUseCase.handle({
        user,
        password: NEW_PASSWORD,
        keptRememberedConnectionId: null,
      }),
      renewPasswordUseCase.handle({
        user: secondUser,
        password: `${NEW_PASSWORD}-other`,
        keptRememberedConnectionId: null,
      }),
    ])

    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled')
    const rejected = outcomes.filter((outcome) => outcome.status === 'rejected')

    assert.lengthOf(fulfilled, 1)
    assert.lengthOf(rejected, 1)
    assert.instanceOf(
      (rejected[0] as PromiseRejectedResult).reason,
      PasswordRenewalNotRequiredException,
    )

    const renewed = await User.findOrFail(user.id)
    assert.isNull(renewed.passwordRenewalRequiredAt)

    const winners = await Promise.all(
      [NEW_PASSWORD, `${NEW_PASSWORD}-other`].map((candidate) =>
        hash.verify(renewed.password ?? '', candidate),
      ),
    )
    assert.deepEqual(winners.filter(Boolean), [true])
  })

  test('records a password with surrounding whitespace exactly as it was typed', async ({
    assert,
  }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()
    const paddedPassword = `  ${NEW_PASSWORD}  `

    const renewPasswordUseCase = await app.container.make(RenewPasswordUseCase)
    await renewPasswordUseCase.handle({
      user,
      password: paddedPassword,
      keptRememberedConnectionId: null,
    })

    // Surrounding whitespace is part of the secret: trimming it on renewal but not at login would
    // lock the user out of the account they just fixed (FR-012).
    const renewed = await User.findOrFail(user.id)
    assert.isTrue(await hash.verify(renewed.password ?? '', paddedPassword))
    assert.isFalse(await hash.verify(renewed.password ?? '', NEW_PASSWORD))
  })
})
