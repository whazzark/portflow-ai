import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import type User from '#models/user'
import UpdateUserIdentityUseCase from '#users/identity/update_user_identity_use_case'
import type {
  ApplyUserIdentityCommand,
  ApplyUserIdentityResult,
} from '#users/shared/repositories/user_repository'
import UserRepository from '#users/shared/repositories/user_repository'
import {
  DuplicateUserEmailException,
  PendingUserEmailChangeException,
  SelfIdentityUpdateException,
  UserNotFoundException,
} from '#users/shared/user_exceptions'

type RepositoryStub = {
  target: User | null
  result?: ApplyUserIdentityResult
}

const swapRepository = (stub: RepositoryStub) => {
  const applied: ApplyUserIdentityCommand[] = []

  app.container.swap(
    UserRepository,
    () =>
      ({
        findByIdForUpdate: () => Promise.resolve(stub.target),
        applyIdentity: (command: ApplyUserIdentityCommand) => {
          applied.push(command)

          return Promise.resolve(
            stub.result ?? ({ kind: 'UPDATED', user: stub.target } as ApplyUserIdentityResult),
          )
        },
      }) as unknown as UserRepository,
  )

  return { applied }
}

const inputFor = (target: User, overrides: Partial<Record<string, string>> = {}) => ({
  targetUserId: target.id,
  requestedByUserId: '11111111-1111-4111-8111-111111111111',
  firstName: 'Camille',
  lastName: 'Renard',
  email: 'camille.renard@example.com',
  changedAt: DateTime.now(),
  ...overrides,
})

const handle = (input: ReturnType<typeof inputFor>) =>
  (app.container.make(UpdateUserIdentityUseCase) as Promise<UpdateUserIdentityUseCase>).then(
    (useCase) => useCase.handle(input),
  )

test.group('UpdateUserIdentityUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => {
    app.container.restore(UserRepository)
  })

  test('applies a correction to an active user', async ({ assert }) => {
    const target = await UserFactory.apply('active').create()
    const { applied } = swapRepository({ target })

    await handle(inputFor(target))

    assert.lengthOf(applied, 1)
    assert.equal(applied[0].firstName, 'Camille')
  })

  test('trims the submitted identity before applying it', async ({ assert }) => {
    const target = await UserFactory.apply('active').create()
    const { applied } = swapRepository({ target })

    await handle(
      inputFor(target, { firstName: '  Camille  ', email: ' camille.renard@example.com ' }),
    )

    assert.equal(applied[0].firstName, 'Camille')
    assert.equal(applied[0].email, 'camille.renard@example.com')
  })

  test('writes nothing when the submitted identity is the stored one', async ({ assert }) => {
    const target = await UserFactory.apply('active')
      .merge({ firstName: 'Camille', lastName: 'Renard', email: 'camille.renard@example.com' })
      .create()
    const { applied } = swapRepository({ target })

    const user = await handle(inputFor(target))

    assert.equal(user.id, target.id)
    assert.lengthOf(applied, 0)
  })

  test('refuses an administrator correcting themselves', async ({ assert }) => {
    const target = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const { applied } = swapRepository({ target })

    await assert.rejects(
      () => handle(inputFor(target, { requestedByUserId: target.id })),
      SelfIdentityUpdateException.message,
    )
    assert.lengthOf(applied, 0)
  })

  test('refuses an unknown target', async ({ assert }) => {
    const { applied } = swapRepository({ target: null })
    const absent = await UserFactory.apply('active').make()

    await assert.rejects(() => handle(inputFor(absent)), UserNotFoundException.message)
    assert.lengthOf(applied, 0)
  })

  test('raises a conflict when the address belongs to another user', async ({ assert }) => {
    const target = await UserFactory.apply('active').create()
    swapRepository({ target, result: { kind: 'EMAIL_TAKEN' } })

    await assert.rejects(() => handle(inputFor(target)), DuplicateUserEmailException.message)
  })

  test('refuses to change the mailbox of a pending user, writing nothing', async ({ assert }) => {
    const target = await UserFactory.apply('invited').create()
    const { applied } = swapRepository({ target })

    await assert.rejects(() => handle(inputFor(target)), PendingUserEmailChangeException.message)
    assert.lengthOf(applied, 0)
  })

  test('corrects the name of a pending user whose address stays the same', async ({ assert }) => {
    const target = await UserFactory.apply('invited')
      .merge({ email: 'camille.renard@example.com' })
      .create()
    const { applied } = swapRepository({ target })

    await handle(inputFor(target))

    assert.lengthOf(applied, 1)
  })

  test('treats a re-cased address as the same mailbox for a pending user', async ({ assert }) => {
    const target = await UserFactory.apply('invited')
      .merge({ email: 'Camille.Renard@Example.com' })
      .create()
    const { applied } = swapRepository({ target })

    await handle(inputFor(target))

    assert.lengthOf(applied, 1)
  })

  test('lets a user who is not pending change mailbox', async ({ assert }) => {
    for (const state of ['active', 'deactivated', 'cancelled'] as const) {
      const target = await UserFactory.apply(state).create()
      const { applied } = swapRepository({ target })

      await handle(inputFor(target, { email: `camille.${target.id}@example.com` }))

      assert.lengthOf(applied, 1)
    }
  })
})
