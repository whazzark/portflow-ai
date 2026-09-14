import app from '@adonisjs/core/services/app'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { PasswordRenewalRequiredException } from '#auth/password_renewal/password_renewal_exceptions'
import { USER_FACTORY_PASSWORD, UserFactory } from '#database/factories/user_factory'
import type User from '#models/user'
import ChangeOwnPasswordUseCase, {
  type ChangeOwnPasswordInput,
} from '#users/profile/change_own_password_use_case'
import {
  CurrentPasswordIncorrectException,
  NewPasswordUnchangedException,
  OwnProfileUnavailableException,
} from '#users/profile/own_profile_exceptions'
import type { ApplyOwnPasswordCommand } from '#users/shared/repositories/user_repository'
import UserRepository from '#users/shared/repositories/user_repository'

const NEW_PASSWORD = 'correct-horse-battery-staple'

const swapRepository = (locked: User | null) => {
  const applied: ApplyOwnPasswordCommand[] = []

  app.container.swap(
    UserRepository,
    () =>
      ({
        findByIdForUpdate: () => Promise.resolve(locked),
        applyOwnPassword: (command: ApplyOwnPasswordCommand) => {
          applied.push(command)

          return Promise.resolve(locked as User)
        },
      }) as unknown as UserRepository,
  )

  return { applied }
}

const inputFor = (
  user: User,
  overrides: Partial<Omit<ChangeOwnPasswordInput, 'user'>> = {},
): ChangeOwnPasswordInput => ({
  user,
  currentPassword: USER_FACTORY_PASSWORD,
  password: NEW_PASSWORD,
  keptRememberedConnectionId: null,
  changedAt: DateTime.now(),
  ...overrides,
})

const handle = async (input: ChangeOwnPasswordInput) => {
  const useCase = await app.container.make(ChangeOwnPasswordUseCase)

  return useCase.handle(input)
}

test.group('ChangeOwnPasswordUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => {
    app.container.restore(UserRepository)
  })

  test('replaces the password once the current one is confirmed', async ({ assert }) => {
    const user = await UserFactory.apply('active').create()
    const { applied } = swapRepository(user)

    await handle(inputFor(user))

    assert.lengthOf(applied, 1)
    assert.equal(applied[0].id, user.id)
    // Hashed before the write, never inside it, and never stored in the clear.
    assert.notEqual(applied[0].hashedPassword, NEW_PASSWORD)
    assert.isTrue(await hash.verify(applied[0].hashedPassword, NEW_PASSWORD))
  })

  test('carries the connection this request came from, so it survives', async ({ assert }) => {
    const user = await UserFactory.apply('active').create()
    const { applied } = swapRepository(user)

    await handle(inputFor(user, { keptRememberedConnectionId: 42 }))

    assert.equal(applied[0].keptRememberedConnectionId, 42)
  })

  test('refuses an incorrect current password, writing nothing', async ({ assert }) => {
    const user = await UserFactory.apply('active').create()
    const { applied } = swapRepository(user)

    await assert.rejects(
      () => handle(inputFor(user, { currentPassword: 'not-the-password' })),
      CurrentPasswordIncorrectException.message,
    )
    assert.lengthOf(applied, 0)
  })

  test('refuses a new password identical to the current one', async ({ assert }) => {
    const user = await UserFactory.apply('active').create()
    const { applied } = swapRepository(user)

    await assert.rejects(
      () => handle(inputFor(user, { password: USER_FACTORY_PASSWORD })),
      NewPasswordUnchangedException.message,
    )
    assert.lengthOf(applied, 0)
  })

  test('refuses when the stored password changed since it was verified', async ({ assert }) => {
    const user = await UserFactory.apply('active').create()
    const locked = await UserFactory.apply('active').merge({ id: user.id }).make()
    locked.password = 'a-hash-replaced-since'
    const { applied } = swapRepository(locked)

    await assert.rejects(() => handle(inputFor(user)), CurrentPasswordIncorrectException.message)
    assert.lengthOf(applied, 0)
  })

  test('refuses when the signed-in user stopped being active under the lock', async ({
    assert,
  }) => {
    const user = await UserFactory.apply('active').create()
    const locked = await UserFactory.apply('deactivated').merge({ id: user.id }).make()
    locked.password = user.password
    const { applied } = swapRepository(locked)

    await assert.rejects(() => handle(inputFor(user)), OwnProfileUnavailableException.message)
    assert.lengthOf(applied, 0)
  })

  test('refuses when a password renewal became owed under the lock', async ({ assert }) => {
    const user = await UserFactory.apply('active').create()
    const locked = await UserFactory.apply('passwordRenewalRequired').merge({ id: user.id }).make()
    locked.password = user.password
    const { applied } = swapRepository(locked)

    await assert.rejects(() => handle(inputFor(user)), PasswordRenewalRequiredException.message)
    assert.lengthOf(applied, 0)
  })
})
