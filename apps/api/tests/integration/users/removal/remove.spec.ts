import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { DischargeFactory } from '#database/factories/discharge_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { ShiftFactory } from '#database/factories/shift_factory'
import { UserActivationTokenFactory } from '#database/factories/user_activation_token_factory'
import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import UserActivationToken from '#models/user_activation_token'

const UNKNOWN_ID = '00000000-0000-4000-8000-999999999999'

const organizationAdmin = () =>
  UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

const removePath = (id: string) => `/api/v1/users/${id}`

test.group('DELETE /api/v1/users/:id', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('removes a pending and a cancelled user with an empty 204', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    for (const state of ['invited', 'cancelled'] as const) {
      const target = await UserFactory.apply(state).create()
      await UserActivationTokenFactory.merge({ userId: target.id }).create()

      const response = await client.delete(removePath(target.id)).loginAs(admin)

      response.assertStatus(204)
      assert.isEmpty(response.text())
      assert.isNull(await User.find(target.id))
      assert.isNull(await UserActivationToken.findBy('userId', target.id))
    }
  })

  test('no longer lists the removed user in the collection', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('invited').create()

    await client.delete(removePath(target.id)).loginAs(admin)
    const response = await client.get('/api/v1/users').loginAs(admin)

    response.assertStatus(200)
    const ids = response.body().data.map((user: { id: string }) => user.id)
    assert.notInclude(ids, target.id)
    assert.include(ids, admin.id)
  })

  test('frees the email for a new invitation, whatever its casing or padding', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('invited')
      .merge({ email: 'jane.doe@portflow.test' })
      .create()

    await client.delete(removePath(target.id)).loginAs(admin)
    const response = await client
      .post('/api/v1/users')
      .json({
        firstName: 'Jane',
        lastName: 'Doe',
        email: '  Jane.Doe@Portflow.test ',
        role: 'OPERATIONS_LEAD',
      })
      .loginAs(admin)

    response.assertStatus(201)
    const { user } = response.body().data
    assert.notEqual(user.id, target.id)
    assert.equal(user.email, 'Jane.Doe@Portflow.test')
    assert.equal(user.accessStatus, 'PENDING')
  })

  test('refuses an active user and names deactivation', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('active').create()

    const response = await client.delete(removePath(target.id)).loginAs(admin)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_USER_ACTIVE_CANNOT_BE_REMOVED')
    assert.match(response.body().error.message, /deactivate/)
    assert.equal((await User.findOrFail(target.id)).accessStatus, 'ACTIVE')
  })

  // The requester is active by construction, so their own record is refused by the status rule.
  test('refuses the requesting organization admin their own record', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client.delete(removePath(admin.id)).loginAs(admin)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_USER_ACTIVE_CANNOT_BE_REMOVED')
    assert.isNotNull(await User.find(admin.id))
  })

  test('refuses a deactivated user, who is kept', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('deactivated').create()

    const response = await client.delete(removePath(target.id)).loginAs(admin)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_USER_DEACTIVATED_CANNOT_BE_REMOVED')
    assert.equal((await User.findOrFail(target.id)).accessStatus, 'DEACTIVATED')
  })

  test('refuses a user an operational record names', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('invited').create()
    const dock = await DockFactory.create()
    const discharge = await DischargeFactory.merge({ dockId: dock.id }).create()
    await ShiftFactory.merge({ dischargeId: discharge.id, responsibleUserId: target.id }).create()

    const response = await client.delete(removePath(target.id)).loginAs(admin)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_USER_REFERENCED_CANNOT_BE_REMOVED')
    assert.isNotNull(await User.find(target.id))
  })

  test('refuses an identifier naming no user', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client.delete(removePath(UNKNOWN_ID)).loginAs(admin)

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_USER_NOT_FOUND')
  })

  test('answers a second removal of the same user as naming no user', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('invited').create()

    const first = await client.delete(removePath(target.id)).loginAs(admin)
    const second = await client.delete(removePath(target.id)).loginAs(admin)

    first.assertStatus(204)
    second.assertStatus(404)
    assert.equal(second.body().error.code, 'E_USER_NOT_FOUND')
  })

  test('rejects unauthenticated access', async ({ assert, client }) => {
    const target = await UserFactory.apply('invited').create()

    const response = await client.delete(removePath(target.id))

    response.assertStatus(401)
    assert.isNotNull(await User.find(target.id))
  })

  test('denies every role but organization admin', async ({ assert, client }) => {
    for (const role of ['OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const viewer = await UserFactory.apply('active').merge({ role }).create()
      const target = await UserFactory.apply('invited').create()

      const response = await client.delete(removePath(target.id)).loginAs(viewer)

      response.assertStatus(403)
      assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
      assert.isNotNull(await User.find(target.id))
    }
  })

  test('denies a viewer whose access status is not active', async ({ assert, client }) => {
    for (const state of ['invited', 'cancelled', 'deactivated'] as const) {
      const viewer = await UserFactory.apply(state).merge({ role: 'ORGANIZATION_ADMIN' }).create()
      const target = await UserFactory.apply('invited').create()

      const response = await client.delete(removePath(target.id)).loginAs(viewer)

      response.assertStatus(401)
      assert.isNotNull(await User.find(target.id))
    }
  })

  /**
   * FR-015: a viewer who may not remove users learns nothing from the refusal — not whether a
   * pending, cancelled, or active user exists, not which is which, and not even whether the
   * identifier is well-formed, because the policy runs before validation and before any read.
   */
  test('denies an unauthorized viewer identically whatever the id names', async ({
    assert,
    client,
  }) => {
    const viewer = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const pending = await UserFactory.apply('invited').create()
    const cancelled = await UserFactory.apply('cancelled').create()
    const active = await UserFactory.apply('active').create()

    const outcomes = []
    for (const id of [pending.id, cancelled.id, active.id, UNKNOWN_ID, 'not-a-uuid']) {
      const response = await client.delete(removePath(id)).loginAs(viewer)

      outcomes.push({ status: response.status(), body: response.body() })
    }

    const [first, ...rest] = outcomes
    assert.equal(first.status, 403)
    for (const outcome of rest) {
      assert.deepEqual(outcome, first)
    }
    assert.lengthOf(await User.query().whereIn('id', [pending.id, cancelled.id, active.id]), 3)
  })

  test('rejects a malformed identifier before any user is read', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client.delete(removePath('not-a-uuid')).loginAs(admin)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })
})
