import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import ListUsersUseCase from '#users/list/list_users_use_case'
import UserRepository from '#users/shared/repositories/user_repository'

test.group('ListUsersUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(UserRepository))

  test('returns every user whatever their access status for an organization admin', async ({
    assert,
  }) => {
    const viewer = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const users = await UserFactory.createMany(3)
    let listActiveCalled = false
    app.container.swap(
      UserRepository,
      () =>
        ({
          list: async () => users,
          listActive: () => {
            listActiveCalled = true

            return Promise.resolve([])
          },
        }) as unknown as UserRepository,
    )

    const result = await (await app.container.make(ListUsersUseCase)).handle(viewer)

    assert.strictEqual(result.users, users)
    assert.isTrue(result.includeAccessHistory)
    assert.isFalse(listActiveCalled)
  })

  test('restricts an operations admin to the active users', async ({ assert }) => {
    const viewer = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const activeUsers = await UserFactory.apply('active').createMany(2)
    let listCalled = false
    app.container.swap(
      UserRepository,
      () =>
        ({
          list: () => {
            listCalled = true

            return Promise.resolve([])
          },
          listActive: async () => activeUsers,
        }) as unknown as UserRepository,
    )

    const result = await (await app.container.make(ListUsersUseCase)).handle(viewer)

    assert.strictEqual(result.users, activeUsers)
    // The whole-organization read is never reached, so the lifecycle actors are never even loaded,
    // and the access history is withheld for exactly that reason.
    assert.isFalse(result.includeAccessHistory)
    assert.isFalse(listCalled)
  })

  test('preserves an empty repository result', async ({ assert }) => {
    const viewer = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    app.container.swap(
      UserRepository,
      () => ({ list: async () => [], listActive: async () => [] }) as unknown as UserRepository,
    )

    const result = await (await app.container.make(ListUsersUseCase)).handle(viewer)

    assert.isEmpty(result.users)
  })
})
