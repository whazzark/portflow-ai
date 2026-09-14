import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import ChangeUserRoleUseCase from '#users/role_change/change_user_role_use_case'
import {
  SelfRoleChangeException,
  UserDeactivatedCannotChangeRoleException,
  UserNotFoundException,
} from '#users/shared/user_exceptions'

import { untouchedFields } from '../../../support/user_snapshots.ts'

const changeRole = async () => app.container.make(ChangeUserRoleUseCase)

/**
 * The administrator asking, for every test that is not about asking for oneself. It names no user:
 * the use case compares it with the target and reads nothing else from it.
 */
const REQUESTER_ID = '00000000-0000-4000-8000-00000000a0a0'

// biome-ignore lint/security/noSecrets: use case name, not a secret
test.group('ChangeUserRoleUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('changes the role of an eligible user whatever their access status', async ({ assert }) => {
    for (const state of ['invited', 'active', 'cancelled'] as const) {
      const user = await UserFactory.apply(state).merge({ role: 'OBSERVER' }).create()

      const changed = await (await changeRole()).handle({
        requestedByUserId: REQUESTER_ID,
        userId: user.id,
        role: 'OPERATIONS_LEAD',
      })

      assert.equal(changed.role, 'OPERATIONS_LEAD')
      await user.refresh()
      assert.equal(user.role, 'OPERATIONS_LEAD')
    }
  })

  test('leaves the access status untouched', async ({ assert }) => {
    for (const [state, accessStatus] of [
      ['invited', 'PENDING'],
      ['active', 'ACTIVE'],
      ['cancelled', 'CANCELLED'],
    ] as const) {
      const user = await UserFactory.apply(state).merge({ role: 'OBSERVER' }).create()

      await (await changeRole()).handle({
        requestedByUserId: REQUESTER_ID,
        userId: user.id,
        role: 'ORGANIZATION_ADMIN',
      })

      await user.refresh()
      assert.equal(user.accessStatus, accessStatus)
    }
  })

  // FR-006: a resubmit is not a failure, and with no history to pollute there is nothing to guard
  // against beyond leaving the row alone.
  test('accepts the role the user already holds without changing anything', async ({ assert }) => {
    const user = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    await user.refresh()
    const before = untouchedFields(user)

    const changed = await (await changeRole()).handle({
      requestedByUserId: REQUESTER_ID,
      userId: user.id,
      role: 'OPERATIONS_ADMIN',
    })

    assert.equal(changed.role, 'OPERATIONS_ADMIN')
    await user.refresh()
    assert.deepEqual(untouchedFields(user), before)
  })

  test('moves nothing but the role', async ({ assert }) => {
    const inviter = await UserFactory.apply('active').create()
    const user = await UserFactory.apply('invited').merge({ role: 'OBSERVER' }).create()
    user.invitedByUserId = inviter.id
    await user.save()
    // Snapshotted from the persisted row: the in-memory model keeps a sub-second precision the
    // timestamp columns do not, so comparing the two would fail on the rounding alone.
    await user.refresh()
    const before = untouchedFields(user)

    await (await changeRole()).handle({
      requestedByUserId: REQUESTER_ID,
      userId: user.id,
      role: 'ORGANIZATION_ADMIN',
    })

    await user.refresh()
    assert.deepEqual(untouchedFields(user), before)
    assert.equal(user.role, 'ORGANIZATION_ADMIN')
  })

  // FR-016: the change is untraced by design. No column, anywhere on the row, records that it
  // happened — this test is what makes reopening that decision a deliberate act.
  test('records no trace of the change', async ({ assert }) => {
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    await (await changeRole()).handle({
      requestedByUserId: REQUESTER_ID,
      userId: user.id,
      role: 'OPERATIONS_LEAD',
    })

    const row = await User.query().where('id', user.id).firstOrFail()
    const recorded = Object.keys(row.$attributes).filter((column) =>
      /role.*(changed|by|at)|previous/i.test(column),
    )
    assert.isEmpty(recorded)
  })

  test('returns the user with the lifecycle actors resolved', async ({ assert }) => {
    const inviter = await UserFactory.apply('active').create()
    const user = await UserFactory.apply('invited').create()
    user.invitedByUserId = inviter.id
    await user.save()

    const changed = await (await changeRole()).handle({
      requestedByUserId: REQUESTER_ID,
      userId: user.id,
      role: 'OBSERVER',
    })

    assert.equal(changed.invitedBy.id, inviter.id)
  })
  test('refuses a deactivated user', async ({ assert }) => {
    const user = await UserFactory.apply('deactivated').merge({ role: 'OBSERVER' }).create()

    await assert.rejects(
      async () =>
        (await changeRole()).handle({
          requestedByUserId: REQUESTER_ID,
          userId: user.id,
          role: 'ORGANIZATION_ADMIN',
        }),
      UserDeactivatedCannotChangeRoleException.message,
    )

    await user.refresh()
    assert.equal(user.role, 'OBSERVER')
  })

  test('refuses an identifier naming no user', async ({ assert }) => {
    await assert.rejects(
      async () =>
        (await changeRole()).handle({
          requestedByUserId: REQUESTER_ID,
          userId: '00000000-0000-4000-8000-000000000000',
          role: 'OBSERVER',
        }),
      UserNotFoundException.message,
    )
  })

  /**
   * The guard is evaluated when the write runs, not against the state an administrator was shown.
   * A read-then-write would accept this change; the conditional `UPDATE` refuses it.
   */
  test('refuses a user deactivated after their record was read', async ({ assert }) => {
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const asDisplayed = { id: user.id, accessStatus: user.accessStatus }
    assert.equal(asDisplayed.accessStatus, 'ACTIVE')

    user.accessStatus = 'DEACTIVATED'
    await user.save()

    await assert.rejects(
      async () =>
        (await changeRole()).handle({
          requestedByUserId: REQUESTER_ID,
          userId: asDisplayed.id,
          role: 'OPERATIONS_LEAD',
        }),
      UserDeactivatedCannotChangeRoleException.message,
    )

    await user.refresh()
    assert.equal(user.role, 'OBSERVER')
  })

  test('leaves a refused user completely untouched', async ({ assert }) => {
    const user = await UserFactory.apply('deactivated').merge({ role: 'OBSERVER' }).create()
    await user.refresh()
    const before = untouchedFields(user)

    await assert.rejects(async () =>
      (await changeRole()).handle({
        requestedByUserId: REQUESTER_ID,
        userId: user.id,
        role: 'ORGANIZATION_ADMIN',
      }),
    )

    await user.refresh()
    assert.deepEqual(untouchedFields(user), before)
    assert.equal(user.role, 'OBSERVER')
  })

  // GH-29 FR-001: the target is refused, not the role — even the one already held, which GH-28's
  // unchanged-success rule would otherwise have answered with a 200.
  test('refuses an administrator changing their own role, whatever the role', async ({
    assert,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    await admin.refresh()
    const before = untouchedFields(admin)

    for (const role of [
      'ORGANIZATION_ADMIN',
      'OPERATIONS_ADMIN',
      'OPERATIONS_LEAD',
      'OBSERVER',
    ] as const) {
      await assert.rejects(
        async () =>
          (await changeRole()).handle({ requestedByUserId: admin.id, userId: admin.id, role }),
        SelfRoleChangeException.message,
      )
    }

    await admin.refresh()
    assert.deepEqual(untouchedFields(admin), before)
    assert.equal(admin.role, 'ORGANIZATION_ADMIN')
  })

  // GH-29 FR-002: PostgreSQL matches an upper-cased UUID against the stored lower-case row, so a
  // case-sensitive comparison would let this request through.
  test('refuses a self-role change whose identifier is upper-cased', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    await assert.rejects(
      async () =>
        (await changeRole()).handle({
          requestedByUserId: admin.id,
          userId: admin.id.toUpperCase(),
          role: 'OBSERVER',
        }),
      SelfRoleChangeException.message,
    )

    await admin.refresh()
    assert.equal(admin.role, 'ORGANIZATION_ADMIN')
  })

  // The target is read, locked, and written under the one spelling `users.id` stores, so an
  // upper-cased identifier names the same user in every statement — on SQLite as on PostgreSQL.
  test('changes the role of a user named with an upper-cased identifier', async ({ assert }) => {
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const changed = await (await changeRole()).handle({
      requestedByUserId: REQUESTER_ID,
      userId: user.id.toUpperCase(),
      role: 'OPERATIONS_LEAD',
    })

    assert.equal(changed.id, user.id)
    await user.refresh()
    assert.equal(user.role, 'OPERATIONS_LEAD')
  })

  // Decided from the request alone: were the target read first, this identifier would be a 404.
  test('refuses a self-role change before reading anything', async ({ assert }) => {
    const nobody = '00000000-0000-4000-8000-00000000b0b0'

    await assert.rejects(
      async () =>
        (await changeRole()).handle({
          requestedByUserId: nobody,
          userId: nobody,
          role: 'OBSERVER',
        }),
      SelfRoleChangeException.message,
    )
  })
})
