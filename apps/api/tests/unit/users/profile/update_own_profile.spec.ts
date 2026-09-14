import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { PasswordRenewalRequiredException } from '#auth/password_renewal/password_renewal_exceptions'
import { USER_FACTORY_PASSWORD, UserFactory } from '#database/factories/user_factory'
import type User from '#models/user'
import {
  CurrentPasswordIncorrectException,
  CurrentPasswordRequiredException,
  OwnProfileUnavailableException,
} from '#users/profile/own_profile_exceptions'
import UpdateOwnProfileUseCase, {
  type UpdateOwnProfileInput,
} from '#users/profile/update_own_profile_use_case'
import type {
  ApplyUserIdentityCommand,
  ApplyUserIdentityResult,
} from '#users/shared/repositories/user_repository'
import UserRepository from '#users/shared/repositories/user_repository'
import {
  DuplicateUserEmailException,
  InvalidUserIdentityException,
} from '#users/shared/user_exceptions'

type RepositoryStub = {
  /** The row the locked read returns — the session user unless a test says otherwise. */
  locked: User | null
  result?: ApplyUserIdentityResult
}

const swapRepository = (stub: RepositoryStub) => {
  const applied: ApplyUserIdentityCommand[] = []
  const locks: string[] = []

  app.container.swap(
    UserRepository,
    () =>
      ({
        findByIdForUpdate: (id: string) => {
          locks.push(id)

          return Promise.resolve(stub.locked)
        },
        applyIdentity: (command: ApplyUserIdentityCommand) => {
          applied.push(command)

          return Promise.resolve(
            stub.result ?? ({ kind: 'UPDATED', user: stub.locked } as ApplyUserIdentityResult),
          )
        },
      }) as unknown as UserRepository,
  )

  return { applied, locks }
}

const inputFor = (
  user: User,
  overrides: Partial<Omit<UpdateOwnProfileInput, 'user' | 'changedAt'>> = {},
): UpdateOwnProfileInput => ({
  user,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  changedAt: DateTime.now(),
  ...overrides,
})

const handle = async (input: UpdateOwnProfileInput) => {
  const useCase = await app.container.make(UpdateOwnProfileUseCase)

  return useCase.handle(input)
}

// biome-ignore lint/security/noSecrets: use-case name, not a secret
test.group('UpdateOwnProfileUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => {
    app.container.restore(UserRepository)
  })

  test('applies a names-only change to the signed-in user, trimmed', async ({ assert }) => {
    const user = await UserFactory.apply('active').create()
    const { applied, locks } = swapRepository({ locked: user })

    const updated = await handle(
      inputFor(user, { firstName: '  Camille  ', lastName: ' Renard ', email: ` ${user.email} ` }),
    )

    assert.deepEqual(locks, [user.id])
    assert.lengthOf(applied, 1)
    assert.equal(applied[0].id, user.id)
    assert.equal(applied[0].firstName, 'Camille')
    assert.equal(applied[0].lastName, 'Renard')
    assert.equal(applied[0].email, user.email)
    assert.equal(updated.id, user.id)
  })

  test('writes nothing when the submitted identity is the stored one', async ({ assert }) => {
    const user = await UserFactory.apply('active').create()
    const { applied } = swapRepository({ locked: user })

    const updated = await handle(inputFor(user))

    assert.equal(updated.id, user.id)
    assert.lengthOf(applied, 0)
  })

  test('applies a re-cased first name as a change', async ({ assert }) => {
    const user = await UserFactory.apply('active').merge({ firstName: 'camille' }).create()
    const { applied } = swapRepository({ locked: user })

    await handle(inputFor(user, { firstName: 'Camille' }))

    assert.lengthOf(applied, 1)
    assert.equal(applied[0].firstName, 'Camille')
  })
})

// biome-ignore lint/security/noSecrets: use-case name, not a secret
test.group('UpdateOwnProfileUseCase — refusals', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => {
    app.container.restore(UserRepository)
  })

  test('raises a conflict when the address belongs to another user', async ({ assert }) => {
    const user = await UserFactory.apply('active').create()
    swapRepository({ locked: user, result: { kind: 'EMAIL_TAKEN' } })

    await assert.rejects(
      () =>
        handle(
          inputFor(user, {
            email: 'held.by.someone.else@example.com',
            currentPassword: USER_FACTORY_PASSWORD,
          }),
        ),
      DuplicateUserEmailException.message,
    )
  })

  test('refuses a blank name before taking any lock', async ({ assert }) => {
    const user = await UserFactory.apply('active').create()
    const { locks } = swapRepository({ locked: user })

    await assert.rejects(
      () => handle(inputFor(user, { lastName: '   ' })),
      InvalidUserIdentityException.message,
    )
    assert.lengthOf(locks, 0)
  })
})

// biome-ignore lint/security/noSecrets: use-case name, not a secret
test.group('UpdateOwnProfileUseCase — a session that has ended', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => {
    app.container.restore(UserRepository)
  })

  test('refuses when the signed-in user is gone under the lock', async ({ assert }) => {
    const user = await UserFactory.apply('active').create()
    const { applied } = swapRepository({ locked: null })

    await assert.rejects(
      () => handle(inputFor(user, { firstName: 'Camille' })),
      OwnProfileUnavailableException.message,
    )
    assert.lengthOf(applied, 0)
  })

  test('refuses when a password renewal became owed under the lock', async ({ assert }) => {
    // An administrator's reset landed between the renewal gate's read and this lock. It leaves the
    // password hash as it was, so only the requirement itself can tell.
    const user = await UserFactory.apply('active').create()
    const locked = await UserFactory.apply('passwordRenewalRequired')
      .merge({ id: user.id, email: user.email })
      .make()
    const { applied } = swapRepository({ locked })

    await assert.rejects(
      () => handle(inputFor(user, { firstName: 'Camille' })),
      PasswordRenewalRequiredException.message,
    )
    assert.lengthOf(applied, 0)
  })

  test('refuses when the signed-in user stopped being active under the lock', async ({
    assert,
  }) => {
    const user = await UserFactory.apply('active').create()
    const locked = await UserFactory.apply('deactivated')
      .merge({ id: user.id, email: user.email })
      .make()
    const { applied } = swapRepository({ locked })

    await assert.rejects(
      () => handle(inputFor(user, { firstName: 'Camille' })),
      OwnProfileUnavailableException.message,
    )
    assert.lengthOf(applied, 0)
  })
})

// biome-ignore lint/security/noSecrets: use-case name, not a secret
test.group('UpdateOwnProfileUseCase — changing the address', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => {
    app.container.restore(UserRepository)
  })

  const NEW_ADDRESS = 'camille.renard@example.com'

  test('requires the current password, without taking any lock', async ({ assert }) => {
    for (const currentPassword of [undefined, '']) {
      const user = await UserFactory.apply('active').create()
      const { applied, locks } = swapRepository({ locked: user })

      await assert.rejects(
        () => handle(inputFor(user, { email: NEW_ADDRESS, currentPassword })),
        CurrentPasswordRequiredException.message,
      )
      assert.lengthOf(locks, 0)
      assert.lengthOf(applied, 0)
    }
  })

  test('refuses an incorrect current password, without taking any lock', async ({ assert }) => {
    const user = await UserFactory.apply('active').create()
    const { applied, locks } = swapRepository({ locked: user })

    await assert.rejects(
      () => handle(inputFor(user, { email: NEW_ADDRESS, currentPassword: 'not-the-password' })),
      CurrentPasswordIncorrectException.message,
    )
    assert.lengthOf(locks, 0)
    assert.lengthOf(applied, 0)
  })

  test('applies the new address with the correct current password', async ({ assert }) => {
    const user = await UserFactory.apply('active').create()
    const { applied } = swapRepository({ locked: user })

    await handle(inputFor(user, { email: NEW_ADDRESS, currentPassword: USER_FACTORY_PASSWORD }))

    assert.lengthOf(applied, 1)
    assert.equal(applied[0].email, NEW_ADDRESS)
  })

  test('needs no password for an address only re-cased or padded', async ({ assert }) => {
    const user = await UserFactory.apply('active').merge({ email: NEW_ADDRESS }).create()
    const { applied } = swapRepository({ locked: user })

    await handle(inputFor(user, { email: '  Camille.Renard@Example.com ' }))

    assert.lengthOf(applied, 1)
    assert.equal(applied[0].email, 'Camille.Renard@Example.com')
  })

  test('ignores a current password when the address does not move', async ({ assert }) => {
    const user = await UserFactory.apply('active').create()
    const { applied } = swapRepository({ locked: user })

    await handle(inputFor(user, { firstName: 'Camille', currentPassword: 'not-the-password' }))

    assert.lengthOf(applied, 1)
    assert.equal(applied[0].firstName, 'Camille')
  })

  test('refuses an address that moves under the lock without a verified password', async ({
    assert,
  }) => {
    // An administrator moved the address after the session guard read the user: the submission
    // still carries the address the session knew, which is now a change against the stored row.
    const user = await UserFactory.apply('active').create()
    const locked = await UserFactory.apply('active')
      .merge({ id: user.id, email: 'moved.by.an.administrator@example.com' })
      .make()
    const { applied } = swapRepository({ locked })

    await assert.rejects(
      () => handle(inputFor(user, { firstName: 'Camille' })),
      CurrentPasswordRequiredException.message,
    )
    assert.lengthOf(applied, 0)
  })

  test('refuses a verification made against a password hash that has since changed', async ({
    assert,
  }) => {
    const user = await UserFactory.apply('active').create()
    const locked = await UserFactory.apply('active')
      .merge({ id: user.id, email: user.email })
      .make()
    // Set after `make()`: the `active` state writes the factory's hash after any merge.
    locked.password = 'a-hash-renewed-since'
    const { applied } = swapRepository({ locked })

    await assert.rejects(
      () => handle(inputFor(user, { email: NEW_ADDRESS, currentPassword: USER_FACTORY_PASSWORD })),
      CurrentPasswordRequiredException.message,
    )
    assert.lengthOf(applied, 0)
  })
})
