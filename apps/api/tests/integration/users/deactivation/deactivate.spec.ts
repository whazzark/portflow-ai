import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { USER_FACTORY_PASSWORD, UserFactory } from '#database/factories/user_factory'
import User from '#models/user'

const UNKNOWN_ID = '00000000-0000-4000-8000-999999999999'

const organizationAdmin = () =>
  UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

const deactivatePath = (id: string) => `/api/v1/users/${id}/deactivate`

test.group('POST /api/v1/users/:id/deactivate', () => {
  test('deactivates an active user and returns the administration projection', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('active').merge({ role: 'OPERATIONS_LEAD' }).create()

    const response = await client.post(deactivatePath(target.id)).loginAs(admin)

    response.assertStatus(200)
    const body = response.body().data
    assert.equal(body.id, target.id)
    assert.equal(body.accessStatus, 'DEACTIVATED')
    assert.isNotNull(body.deactivatedAt)
    assert.deepEqual(body.deactivatedBy, {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
    })
    assert.equal(body.email, target.email)
    assert.equal(body.role, target.role)
    assert.isUndefined(body.password)
    assert.isUndefined(body.passwordRenewalRequiredAt)
    assert.notInclude(JSON.stringify(response.body()), 'remember')
  })

  // The response is what the workbench caches for this record, so it has to agree with the
  // collection: an actor the deactivation reply left out would blank a lifecycle event that
  // GET /api/v1/users names.
  test('returns the whole access history, not only the event it just recorded', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const inviter = await organizationAdmin()
    const target = await UserFactory.apply('active').create()
    // Written after creation rather than merged in: the `active` state runs after the merged
    // attributes and would put `activatedByUserId` back to null.
    target.invitedAt = DateTime.now()
    target.invitedByUserId = inviter.id
    target.activatedByUserId = inviter.id
    await target.save()

    const response = await client.post(deactivatePath(target.id)).loginAs(admin)

    response.assertStatus(200)
    const body = response.body().data
    const summary = { id: inviter.id, firstName: inviter.firstName, lastName: inviter.lastName }
    assert.deepEqual(body.invitedBy, summary)
    assert.deepEqual(body.activatedBy, summary)
    assert.isNotNull(body.invitedAt)
  })

  test('refuses a login by a user who has just been deactivated', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('active').create()

    await client.post(deactivatePath(target.id)).loginAs(admin)

    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: target.email, password: USER_FACTORY_PASSWORD })

    login.assertStatus(401)
    // Indistinguishable from a wrong password: the refusal never says which reason applied.
    assert.deepEqual(login.body(), {
      error: { code: 'E_LOGIN_INVALID_CREDENTIALS', message: 'Invalid credentials' },
    })
  })

  test('refuses the next request of a session opened before the deactivation', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('active').create()

    const before = await client.get('/api/v1/auth/me').loginAs(target)
    before.assertStatus(200)

    await client.post(deactivatePath(target.id)).loginAs(admin)

    const after = await client.get('/api/v1/auth/me').loginAs(target)
    after.assertStatus(401)
    assert.equal(after.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects unauthenticated access', async ({ assert, client }) => {
    const target = await UserFactory.apply('active').create()

    const response = await client.post(deactivatePath(target.id))

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    assert.equal((await User.findOrFail(target.id)).accessStatus, 'ACTIVE')
  })

  test('denies the command to every role but an organization admin', async ({ assert, client }) => {
    for (const role of ['OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const viewer = await UserFactory.apply('active').merge({ role }).create()
      const target = await UserFactory.apply('active').create()

      const response = await client.post(deactivatePath(target.id)).loginAs(viewer)

      response.assertStatus(403)
      assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
      assert.equal((await User.findOrFail(target.id)).accessStatus, 'ACTIVE')
    }
  })

  // Per the contract: a non-active user holds no session at all (GH-3), so the refusal arrives as
  // an unauthenticated one rather than an authorization failure.
  test('denies the command to a viewer whose access is not active', async ({ assert, client }) => {
    const viewer = await UserFactory.apply('deactivated')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const target = await UserFactory.apply('active').create()

    const response = await client.post(deactivatePath(target.id)).loginAs(viewer)

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    assert.equal((await User.findOrFail(target.id)).accessStatus, 'ACTIVE')
  })

  test('refuses an unauthorized caller without disclosing whether the target exists', async ({
    assert,
    client,
  }) => {
    const viewer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const existing = await UserFactory.apply('active').create()

    const known = await client.post(deactivatePath(existing.id)).loginAs(viewer)
    const unknown = await client.post(deactivatePath(UNKNOWN_ID)).loginAs(viewer)

    assert.equal(known.status(), unknown.status())
    assert.deepEqual(known.body(), unknown.body())
  })

  test('refuses an administrator deactivating their own access', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client.post(deactivatePath(admin.id)).loginAs(admin)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_USER_SELF_DEACTIVATION')
    assert.equal((await User.findOrFail(admin.id)).accessStatus, 'ACTIVE')
  })

  // `vine.string().uuid()` accepts an upper-cased identifier and hands it through unchanged, and
  // PostgreSQL resolves it to the same row as its canonical lower-case spelling. The refusal must
  // therefore survive the spelling, not the comparison that happens to match.
  test('refuses a self-deactivation spelled with an upper-case identifier', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()

    const response = await client.post(deactivatePath(admin.id.toUpperCase())).loginAs(admin)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_USER_SELF_DEACTIVATION')
    assert.equal((await User.findOrFail(admin.id)).accessStatus, 'ACTIVE')
  })

  test('refuses a target that is not active, naming which reason applied', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()

    for (const [state, code] of [
      ['invited', 'E_USER_PENDING_INVITATION'],
      ['cancelled', 'E_USER_CANCELLED_INVITATION'],
      ['deactivated', 'E_USER_ALREADY_DEACTIVATED'],
    ] as const) {
      const target = await UserFactory.apply(state).create()
      const before = await User.findOrFail(target.id)

      const response = await client.post(deactivatePath(target.id)).loginAs(admin)

      response.assertStatus(409)
      assert.equal(response.body().error.code, code)
      const after = await User.findOrFail(target.id)
      assert.equal(after.accessStatus, before.accessStatus)
      assert.deepEqual(after.deactivatedAt?.toISO() ?? null, before.deactivatedAt?.toISO() ?? null)
      assert.equal(after.deactivatedByUserId, before.deactivatedByUserId)
    }
  })

  test('refuses a well-formed identifier that matches no user', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client.post(deactivatePath(UNKNOWN_ID)).loginAs(admin)

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_USER_NOT_FOUND')
  })

  test('rejects a malformed identifier before any user is read', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client.post(deactivatePath('not-a-uuid')).loginAs(admin)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.isArray(response.body().error.details)
  })

  test('lets exactly one of two successive attempts through', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const other = await organizationAdmin()
    const target = await UserFactory.apply('active').create()

    const first = await client.post(deactivatePath(target.id)).loginAs(admin)
    const second = await client.post(deactivatePath(target.id)).loginAs(other)

    first.assertStatus(200)
    second.assertStatus(409)
    assert.equal(second.body().error.code, 'E_USER_ALREADY_DEACTIVATED')
    const target_after = await User.findOrFail(target.id)
    assert.equal(target_after.deactivatedByUserId, admin.id)
    assert.equal(first.body().data.deactivatedAt, target_after.deactivatedAt?.toISO())
  })
})
