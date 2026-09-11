import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import type User from '#models/user'
import UpdateUserIdentityUseCase from '#users/identity/update_user_identity_use_case'
import ActivationLinkReissuer, {
  type ReissueActivationLinkResult,
} from '#users/shared/activation_link_reissuer'
import type {
  ApplyUserIdentityCommand,
  ApplyUserIdentityResult,
} from '#users/shared/repositories/user_repository'
import UserRepository from '#users/shared/repositories/user_repository'
import {
  ActivationLinkUnavailableException,
  DuplicateUserEmailException,
  SelfIdentityUpdateException,
  UserNotFoundException,
} from '#users/shared/user_exceptions'

type RepositoryStub = {
  target: User | null
  result?: ApplyUserIdentityResult
}

const swapCollaborators = (
  stub: RepositoryStub,
  issue: () => Promise<ReissueActivationLinkResult>,
) => {
  const applied: ApplyUserIdentityCommand[] = []
  const issued: string[] = []

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
  app.container.swap(
    ActivationLinkReissuer,
    () =>
      ({
        reissueForCorrectedEmail: (command: { email: string }) => {
          issued.push(command.email)

          return issue()
        },
      }) as unknown as ActivationLinkReissuer,
  )

  return { applied, issued }
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

test.group('UpdateUserIdentityUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => {
    app.container.restore(UserRepository)
    app.container.restore(ActivationLinkReissuer)
  })

  test('applies a correction to an active user', async ({ assert }) => {
    const target = await UserFactory.apply('active').create()
    const { applied, issued } = swapCollaborators({ target }, () =>
      Promise.resolve({ kind: 'REISSUED' }),
    )

    await (await app.container.make(UpdateUserIdentityUseCase)).handle(inputFor(target))

    assert.lengthOf(applied, 1)
    assert.equal(applied[0].firstName, 'Camille')
    assert.lengthOf(issued, 0)
  })

  test('trims the submitted identity before applying it', async ({ assert }) => {
    const target = await UserFactory.apply('active').create()
    const { applied } = swapCollaborators({ target }, () => Promise.resolve({ kind: 'REISSUED' }))

    await (await app.container.make(UpdateUserIdentityUseCase)).handle(
      inputFor(target, { firstName: '  Camille  ', email: ' camille.renard@example.com ' }),
    )

    assert.equal(applied[0].firstName, 'Camille')
    assert.equal(applied[0].email, 'camille.renard@example.com')
  })

  test('writes nothing when the submitted identity is the stored one', async ({ assert }) => {
    const target = await UserFactory.apply('active')
      .merge({ firstName: 'Camille', lastName: 'Renard', email: 'camille.renard@example.com' })
      .create()
    const { applied, issued } = swapCollaborators({ target }, () =>
      Promise.resolve({ kind: 'REISSUED' }),
    )

    const user = await (await app.container.make(UpdateUserIdentityUseCase)).handle(
      inputFor(target),
    )

    assert.equal(user.id, target.id)
    assert.lengthOf(applied, 0)
    assert.lengthOf(issued, 0)
  })

  test('refuses an administrator correcting themselves', async ({ assert }) => {
    const target = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const { applied } = swapCollaborators({ target }, () => Promise.resolve({ kind: 'REISSUED' }))

    await assert.rejects(
      () =>
        (app.container.make(UpdateUserIdentityUseCase) as Promise<UpdateUserIdentityUseCase>).then(
          (useCase) => useCase.handle(inputFor(target, { requestedByUserId: target.id })),
        ),
      SelfIdentityUpdateException.message,
    )
    assert.lengthOf(applied, 0)
  })

  test('refuses an unknown target', async ({ assert }) => {
    const { applied } = swapCollaborators({ target: null }, () =>
      Promise.resolve({ kind: 'REISSUED' }),
    )
    const absent = await UserFactory.apply('active').make()

    await assert.rejects(
      () =>
        (app.container.make(UpdateUserIdentityUseCase) as Promise<UpdateUserIdentityUseCase>).then(
          (useCase) => useCase.handle(inputFor(absent)),
        ),
      UserNotFoundException.message,
    )
    assert.lengthOf(applied, 0)
  })

  test('raises a conflict when the address belongs to another user', async ({ assert }) => {
    const target = await UserFactory.apply('active').create()
    swapCollaborators({ target, result: { kind: 'EMAIL_TAKEN' } }, () =>
      Promise.resolve({ kind: 'REISSUED' }),
    )

    await assert.rejects(
      () =>
        (app.container.make(UpdateUserIdentityUseCase) as Promise<UpdateUserIdentityUseCase>).then(
          (useCase) => useCase.handle(inputFor(target)),
        ),
      DuplicateUserEmailException.message,
    )
  })

  test('issues a fresh activation link when a pending user changes mailbox', async ({ assert }) => {
    const target = await UserFactory.apply('invited').create()
    const { applied, issued } = swapCollaborators({ target }, () =>
      Promise.resolve({ kind: 'REISSUED' }),
    )

    await (await app.container.make(UpdateUserIdentityUseCase)).handle(inputFor(target))

    assert.deepEqual(issued, ['camille.renard@example.com'])
    assert.lengthOf(applied, 1)
  })

  test('leaves a pending user activation link alone when only the name changes', async ({
    assert,
  }) => {
    const target = await UserFactory.apply('invited')
      .merge({ email: 'camille.renard@example.com' })
      .create()
    const { applied, issued } = swapCollaborators({ target }, () =>
      Promise.resolve({ kind: 'REISSUED' }),
    )

    await (await app.container.make(UpdateUserIdentityUseCase)).handle(inputFor(target))

    assert.lengthOf(issued, 0)
    assert.lengthOf(applied, 1)
  })

  test('treats a re-cased address as the same mailbox for a pending user', async ({ assert }) => {
    const target = await UserFactory.apply('invited')
      .merge({ email: 'Camille.Renard@Example.com' })
      .create()
    const { applied, issued } = swapCollaborators({ target }, () =>
      Promise.resolve({ kind: 'REISSUED' }),
    )

    await (await app.container.make(UpdateUserIdentityUseCase)).handle(inputFor(target))

    assert.lengthOf(issued, 0)
    assert.lengthOf(applied, 1)
  })

  test('fails the whole correction when no activation link can be issued', async ({ assert }) => {
    const target = await UserFactory.apply('invited').create()
    const { applied } = swapCollaborators({ target }, () =>
      Promise.resolve({ kind: 'UNAVAILABLE' }),
    )

    await assert.rejects(
      () =>
        (app.container.make(UpdateUserIdentityUseCase) as Promise<UpdateUserIdentityUseCase>).then(
          (useCase) => useCase.handle(inputFor(target)),
        ),
      ActivationLinkUnavailableException.message,
    )
    assert.lengthOf(applied, 0)
  })

  test('never asks for an activation link for a user who is not pending', async ({ assert }) => {
    for (const state of ['active', 'deactivated', 'cancelled'] as const) {
      const target = await UserFactory.apply(state).create()
      const { issued } = swapCollaborators({ target }, () =>
        Promise.resolve({ kind: 'UNAVAILABLE' }),
      )

      await (await app.container.make(UpdateUserIdentityUseCase)).handle(
        inputFor(target, { email: `camille.${target.id}@example.com` }),
      )

      assert.lengthOf(issued, 0)
    }
  })
})
