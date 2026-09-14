import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'

const UNKNOWN_ID = '00000000-0000-4000-8000-999999999999'

const organizationAdmin = () =>
  UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

const reactivatePath = (id: string) => `/api/v1/users/${id}/reactivate`

test.group('POST /api/v1/users/:id/reactivate', () => {
  test('reactivates a deactivated user and returns the administration projection', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const deactivator = await organizationAdmin()
    const target = await UserFactory.apply('deactivated')
      .merge({ role: 'OPERATIONS_LEAD' })
      .tap((user) => {
        user.deactivatedByUserId = deactivator.id
      })
      .create()

    const response = await client.post(reactivatePath(target.id)).loginAs(admin)

    response.assertStatus(200)
    const body = response.body().data
    assert.equal(body.id, target.id)
    assert.equal(body.accessStatus, 'ACTIVE')
    assert.isNotNull(body.reactivatedAt)
    assert.deepEqual(body.reactivatedBy, {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
    })
    // The deactivation this reverses stays in the history, with its own administrator.
    assert.isNotNull(body.deactivatedAt)
    assert.deepEqual(body.deactivatedBy, {
      id: deactivator.id,
      firstName: deactivator.firstName,
      lastName: deactivator.lastName,
    })
    assert.isTrue(body.passwordRenewalRequired)
    assert.equal(body.email, target.email)
    assert.equal(body.role, 'OPERATIONS_LEAD')
  })

  test('hands over no credential of any kind', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('deactivated').create()

    const response = await client.post(reactivatePath(target.id)).loginAs(admin)

    response.assertStatus(200)
    const body = response.body().data
    assert.isUndefined(body.password)
    assert.isUndefined(body.passwordRenewalRequiredAt)
    assert.isUndefined(response.body().activationLink)
    const serialized = JSON.stringify(response.body())
    assert.notInclude(serialized, 'remember')
    assert.notInclude(serialized, 'token')
  })

  test('refuses every target that is not deactivated with its own reason, changing nothing', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()

    for (const [state, status, code] of [
      ['invited', 409, 'E_USER_PENDING_INVITATION'],
      ['cancelled', 409, 'E_USER_CANCELLED_INVITATION'],
      ['active', 409, 'E_USER_ALREADY_ACTIVE'],
    ] as const) {
      const target = await UserFactory.apply(state).create()
      const before = (await User.findOrFail(target.id)).serialize()

      const response = await client.post(reactivatePath(target.id)).loginAs(admin)

      response.assertStatus(status)
      assert.equal(response.body().error.code, code)
      assert.deepEqual((await User.findOrFail(target.id)).serialize(), before)
    }
  })

  test('lets only the first of two reactivations through, keeping its date and actor', async ({
    assert,
    client,
  }) => {
    const first = await organizationAdmin()
    const second = await organizationAdmin()
    const target = await UserFactory.apply('deactivated').create()

    const winner = await client.post(reactivatePath(target.id)).loginAs(first)
    winner.assertStatus(200)
    const recorded = await User.findOrFail(target.id)

    const loser = await client.post(reactivatePath(target.id)).loginAs(second)

    loser.assertStatus(409)
    assert.equal(loser.body().error.code, 'E_USER_ALREADY_ACTIVE')
    const after = await User.findOrFail(target.id)
    assert.equal(after.reactivatedByUserId, first.id)
    assert.equal(after.reactivatedAt?.toISO(), recorded.reactivatedAt?.toISO())
    assert.isNotNull(after.passwordRenewalRequiredAt)
  })

  test('refuses the administrator naming themselves as already active', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()

    const response = await client.post(reactivatePath(admin.id)).loginAs(admin)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_USER_ALREADY_ACTIVE')
    assert.isNull((await User.findOrFail(admin.id)).passwordRenewalRequiredAt)
  })

  test('refuses an identifier naming no user', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client.post(reactivatePath(UNKNOWN_ID)).loginAs(admin)

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_USER_NOT_FOUND')
  })

  test('rejects unauthenticated access', async ({ assert, client }) => {
    const target = await UserFactory.apply('deactivated').create()

    const response = await client.post(reactivatePath(target.id))

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    assert.equal((await User.findOrFail(target.id)).accessStatus, 'DEACTIVATED')
  })

  // Per the contract: a non-active user holds no session at all (GH-3), so the refusal arrives as
  // an unauthenticated one rather than an authorization failure.
  test('denies the command to a viewer whose access is not active', async ({ assert, client }) => {
    const viewer = await UserFactory.apply('deactivated')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const target = await UserFactory.apply('deactivated').create()

    const response = await client.post(reactivatePath(target.id)).loginAs(viewer)

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    assert.equal((await User.findOrFail(target.id)).accessStatus, 'DEACTIVATED')
  })

  test('denies the command to an administrator confined to their own renewal', async ({
    assert,
    client,
  }) => {
    const viewer = await UserFactory.apply('passwordRenewalRequired')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const target = await UserFactory.apply('deactivated').create()

    const response = await client.post(reactivatePath(target.id)).loginAs(viewer)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_PASSWORD_RENEWAL_REQUIRED')
    assert.equal((await User.findOrFail(target.id)).accessStatus, 'DEACTIVATED')
  })

  test('denies the command to every role but an organization admin', async ({ assert, client }) => {
    for (const role of ['OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const viewer = await UserFactory.apply('active').merge({ role }).create()
      const target = await UserFactory.apply('deactivated').create()

      const response = await client.post(reactivatePath(target.id)).loginAs(viewer)

      response.assertStatus(403)
      assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
      assert.equal((await User.findOrFail(target.id)).accessStatus, 'DEACTIVATED')
    }
  })

  test('refuses an unauthorized caller without disclosing anything about the target', async ({
    assert,
    client,
  }) => {
    const viewer = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const deactivated = await UserFactory.apply('deactivated').create()

    const known = await client.post(reactivatePath(deactivated.id)).loginAs(viewer)
    const unknown = await client.post(reactivatePath(UNKNOWN_ID)).loginAs(viewer)
    const malformed = await client.post(reactivatePath('not-a-uuid')).loginAs(viewer)

    assert.equal(known.status(), 403)
    assert.deepEqual(unknown.body(), known.body())
    assert.equal(unknown.status(), known.status())
    assert.deepEqual(malformed.body(), known.body())
    assert.equal(malformed.status(), known.status())
  })

  test('rejects a malformed identifier before reading any user', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client.post(reactivatePath('not-a-uuid')).loginAs(admin)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.isNotEmpty(response.body().error.details)
  })
})
