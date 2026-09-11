import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import ChangeUserRoleUseCase from '#users/role_change/change_user_role_use_case'
import {
  UserDeactivatedCannotChangeRoleException,
  UserNotFoundException,
} from '#users/shared/user_exceptions'

const changeRole = async () => app.container.make(ChangeUserRoleUseCase)

/** Everything about a user this feature must leave exactly as it found it (FR-005, FR-016). */
const untouchedFields = (user: User) => ({
  accessStatus: user.accessStatus,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  password: user.password,
  invitedAt: user.invitedAt?.toISO() ?? null,
  invitedByUserId: user.invitedByUserId,
  activatedAt: user.activatedAt?.toISO() ?? null,
  activatedByUserId: user.activatedByUserId,
  cancelledAt: user.cancelledAt?.toISO() ?? null,
  cancelledByUserId: user.cancelledByUserId,
  deactivatedAt: user.deactivatedAt?.toISO() ?? null,
  deactivatedByUserId: user.deactivatedByUserId,
  reactivatedAt: user.reactivatedAt?.toISO() ?? null,
  reactivatedByUserId: user.reactivatedByUserId,
  passwordRenewalRequiredAt: user.passwordRenewalRequiredAt?.toISO() ?? null,
})

// biome-ignore lint/security/noSecrets: use case name, not a secret
test.group('ChangeUserRoleUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('changes the role of an eligible user whatever their access status', async ({ assert }) => {
    for (const state of ['invited', 'active', 'cancelled'] as const) {
      const user = await UserFactory.apply(state).merge({ role: 'OBSERVER' }).create()

      const changed = await (await changeRole()).handle({
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

      await (await changeRole()).handle({ userId: user.id, role: 'ORGANIZATION_ADMIN' })

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

    await (await changeRole()).handle({ userId: user.id, role: 'ORGANIZATION_ADMIN' })

    await user.refresh()
    assert.deepEqual(untouchedFields(user), before)
    assert.equal(user.role, 'ORGANIZATION_ADMIN')
  })

  // FR-016: the change is untraced by design. No column, anywhere on the row, records that it
  // happened — this test is what makes reopening that decision a deliberate act.
  test('records no trace of the change', async ({ assert }) => {
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    await (await changeRole()).handle({ userId: user.id, role: 'OPERATIONS_LEAD' })

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

    const changed = await (await changeRole()).handle({ userId: user.id, role: 'OBSERVER' })

    assert.equal(changed.invitedBy.id, inviter.id)
  })
  test('refuses a deactivated user', async ({ assert }) => {
    const user = await UserFactory.apply('deactivated').merge({ role: 'OBSERVER' }).create()

    await assert.rejects(
      async () => (await changeRole()).handle({ userId: user.id, role: 'ORGANIZATION_ADMIN' }),
      UserDeactivatedCannotChangeRoleException.message,
    )

    await user.refresh()
    assert.equal(user.role, 'OBSERVER')
  })

  test('refuses an identifier naming no user', async ({ assert }) => {
    await assert.rejects(
      async () =>
        (await changeRole()).handle({
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
      async () => (await changeRole()).handle({ userId: asDisplayed.id, role: 'OPERATIONS_LEAD' }),
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
      (await changeRole()).handle({ userId: user.id, role: 'ORGANIZATION_ADMIN' }),
    )

    await user.refresh()
    assert.deepEqual(untouchedFields(user), before)
    assert.equal(user.role, 'OBSERVER')
  })
})
