import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'

const organizationAdmin = () =>
  UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

test.group('PATCH /api/v1/users/:id/role', () => {
  test('changes an eligible user role and returns the administration projection', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const inviter = await UserFactory.apply('active').create()
    const user = await UserFactory.apply('invited').merge({ role: 'OBSERVER' }).create()
    // The factory's `invited` state clears the inviter, so it is recorded after creation.
    user.invitedByUserId = inviter.id
    await user.save()

    const response = await client
      .patch(`/api/v1/users/${user.id}/role`)
      .loginAs(admin)
      .json({ role: 'OPERATIONS_LEAD' })

    response.assertStatus(200)
    const data = response.body().data
    assert.equal(data.id, user.id)
    assert.equal(data.role, 'OPERATIONS_LEAD')
    assert.equal(data.accessStatus, 'PENDING')
    assert.equal(data.email, user.email)
    // The access history comes back too: the only caller that reaches this endpoint is an
    // organization admin, which is exactly the viewer that projection is for.
    assert.equal(data.invitedBy.id, inviter.id)
    assert.isNotNull(data.invitedAt)

    await user.refresh()
    assert.equal(user.role, 'OPERATIONS_LEAD')
  })

  test('changes the role of a user in every eligible access status', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    for (const [state, accessStatus] of [
      ['invited', 'PENDING'],
      ['active', 'ACTIVE'],
      ['cancelled', 'CANCELLED'],
    ] as const) {
      const user = await UserFactory.apply(state).merge({ role: 'OBSERVER' }).create()

      const response = await client
        .patch(`/api/v1/users/${user.id}/role`)
        .loginAs(admin)
        .json({ role: 'OPERATIONS_ADMIN' })

      response.assertStatus(200)
      assert.equal(response.body().data.role, 'OPERATIONS_ADMIN')
      assert.equal(response.body().data.accessStatus, accessStatus)
    }
  })

  test('accepts the role the user already holds', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const user = await UserFactory.apply('active').merge({ role: 'OPERATIONS_LEAD' }).create()

    const response = await client
      .patch(`/api/v1/users/${user.id}/role`)
      .loginAs(admin)
      .json({ role: 'OPERATIONS_LEAD' })

    response.assertStatus(200)
    assert.equal(response.body().data.role, 'OPERATIONS_LEAD')
  })

  test('never exposes credentials or password material', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client
      .patch(`/api/v1/users/${user.id}/role`)
      .loginAs(admin)
      .json({ role: 'OBSERVER' })

    response.assertStatus(200)
    assert.notProperty(response.body().data, 'password')
    assert.notProperty(response.body().data, 'passwordRenewalRequiredAt')
  })
  test('refuses a deactivated target and names reactivation', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const user = await UserFactory.apply('deactivated').merge({ role: 'OBSERVER' }).create()

    const response = await client
      .patch(`/api/v1/users/${user.id}/role`)
      .loginAs(admin)
      .json({ role: 'ORGANIZATION_ADMIN' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_USER_DEACTIVATED_CANNOT_CHANGE_ROLE')
    assert.include(response.body().error.message, 'reactivate')

    await user.refresh()
    assert.equal(user.role, 'OBSERVER')
    assert.equal(user.accessStatus, 'DEACTIVATED')
  })

  test('refuses an identifier naming no user', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client
      .patch('/api/v1/users/00000000-0000-4000-8000-000000000000/role')
      .loginAs(admin)
      .json({ role: 'OBSERVER' })

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_USER_NOT_FOUND')
  })

  test('rejects a malformed identifier before any user is read', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client
      .patch('/api/v1/users/not-a-uuid/role')
      .loginAs(admin)
      .json({ role: 'OBSERVER' })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(response.body().error.details[0].field, 'params.id')
  })

  test('refuses a role outside the four the domain defines', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    for (const role of ['CUSTOMER', 'organization_admin', '', null]) {
      const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

      const response = await client
        .patch(`/api/v1/users/${user.id}/role`)
        .loginAs(admin)
        .json({ role })

      response.assertStatus(422)
      await user.refresh()
      assert.equal(user.role, 'OBSERVER')
    }
  })

  test('refuses a request carrying no role at all', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client.patch(`/api/v1/users/${user.id}/role`).loginAs(admin).json({})

    response.assertStatus(422)
    await user.refresh()
    assert.equal(user.role, 'OBSERVER')
  })
  test('rejects an unauthenticated role change', async ({ assert, client }) => {
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client.patch(`/api/v1/users/${user.id}/role`).json({
      role: 'ORGANIZATION_ADMIN',
    })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    await user.refresh()
    assert.equal(user.role, 'OBSERVER')
  })

  test('denies every role but organization admin', async ({ assert, client }) => {
    for (const role of ['OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const viewer = await UserFactory.apply('active').merge({ role }).create()
      const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

      const response = await client
        .patch(`/api/v1/users/${user.id}/role`)
        .loginAs(viewer)
        .json({ role: 'ORGANIZATION_ADMIN' })

      response.assertStatus(403)
      assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
      await user.refresh()
      assert.equal(user.role, 'OBSERVER')
    }
  })

  /**
   * The whole point of authorizing before the target is read: an operations admin may consult
   * active users only, and must not be able to learn from a refusal that a pending, cancelled, or
   * deactivated user exists — nor tell any of them apart from an id naming nobody.
   */
  test('denies an unauthorized viewer identically whatever the id names', async ({
    assert,
    client,
  }) => {
    const viewer = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const pending = await UserFactory.apply('invited').create()
    const cancelled = await UserFactory.apply('cancelled').create()
    const deactivated = await UserFactory.apply('deactivated').create()
    const unknownId = '00000000-0000-4000-8000-000000000000'

    const outcomes = []
    for (const id of [pending.id, cancelled.id, deactivated.id, unknownId]) {
      const response = await client
        .patch(`/api/v1/users/${id}/role`)
        .loginAs(viewer)
        .json({ role: 'OBSERVER' })

      outcomes.push({ status: response.status(), body: response.body() })
    }

    const [first, ...rest] = outcomes
    assert.equal(first.status, 403)
    for (const outcome of rest) {
      assert.deepEqual(outcome, first)
    }
  })

  test('denies a viewer whose access status is not active', async ({ assert, client }) => {
    for (const state of ['invited', 'cancelled', 'deactivated'] as const) {
      const viewer = await UserFactory.apply(state).merge({ role: 'ORGANIZATION_ADMIN' }).create()
      const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

      const response = await client
        .patch(`/api/v1/users/${user.id}/role`)
        .loginAs(viewer)
        .json({ role: 'ORGANIZATION_ADMIN' })

      assert.notEqual(response.status(), 200)
      await user.refresh()
      assert.equal(user.role, 'OBSERVER')
    }
  })
  /**
   * US4 / FR-010: nothing was built for this. Bouncer resolves policies against the row on every
   * request, so the moment it changes, the next request is judged by the new role. These tests are
   * what makes that a guarantee rather than an assumption about the framework.
   */
  test('judges the target next request by their new role, without signing them out', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    // The consultation their current role allows.
    const before = await client.get('/api/v1/users').loginAs(target)
    before.assertStatus(200)

    const change = await client
      .patch(`/api/v1/users/${target.id}/role`)
      .loginAs(admin)
      .json({ role: 'OBSERVER' })
    change.assertStatus(200)

    // The very same session, now refused what the old role allowed.
    const after = await client.get('/api/v1/users').loginAs(target)
    after.assertStatus(403)
    assert.equal(after.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('reports the new role on the target own session', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    await client
      .patch(`/api/v1/users/${target.id}/role`)
      .loginAs(admin)
      .json({ role: 'OPERATIONS_LEAD' })

    const session = await client.get('/api/v1/auth/me').loginAs(target)

    session.assertStatus(200)
    assert.equal(session.body().data.role, 'OPERATIONS_LEAD')
    assert.equal(session.body().data.id, target.id)
  })

  test('records no password renewal requirement on the target', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    await client.patch(`/api/v1/users/${target.id}/role`).loginAs(admin).json({ role: 'OBSERVER' })

    await target.refresh()
    assert.isNull(target.passwordRenewalRequiredAt)
    assert.equal(target.accessStatus, 'ACTIVE')
  })
})
