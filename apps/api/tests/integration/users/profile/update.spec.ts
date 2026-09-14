import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import { USER_FACTORY_PASSWORD, UserFactory } from '#database/factories/user_factory'
import type User from '#models/user'

const OWN_IDENTITY_PATH = '/api/v1/me/profile'

/**
 * Read straight from the table rather than through `RememberMeToken`: the guard's token provider
 * writes these rows itself, in a shape the model's date columns refuse to hydrate.
 */
function rememberedConnectionIdsOf(user: User) {
  return db
    .from('remember_me_tokens')
    .where('tokenable_id', user.id)
    .select('id')
    .then((rows: Array<{ id: number }>) => rows.map((row) => Number(row.id)))
}

const namesOnly = (user: User) => ({
  firstName: 'Camille',
  lastName: 'Renard',
  email: user.email,
})

test.group('PATCH /api/v1/me/profile', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('updates the names of the signed-in user and returns the session projection', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client.patch(OWN_IDENTITY_PATH).json(namesOnly(user)).loginAs(user)

    response.assertStatus(200)
    const data = response.body().data
    assert.equal(data.id, user.id)
    assert.equal(data.firstName, 'Camille')
    assert.equal(data.lastName, 'Renard')
    assert.equal(data.email, user.email)
    assert.equal(data.role, 'OBSERVER')
    assert.equal(data.accessStatus, 'ACTIVE')
    assert.isFalse(data.passwordRenewalRequired)
    // The session projection, not the administration one: no resolved lifecycle actors.
    assert.notProperty(data, 'invitedBy')
    assert.notProperty(data, 'activatedBy')
    await user.refresh()
    assert.equal(user.firstName, 'Camille')
    assert.equal(user.lastName, 'Renard')
  })

  test('leaves everything but the identity untouched, remembered connections included', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('active').merge({ role: 'OPERATIONS_LEAD' }).create()
    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: USER_FACTORY_PASSWORD, rememberMe: true })
    login.assertStatus(200)
    const rememberedBefore = await rememberedConnectionIdsOf(user)
    // Read back from storage before capturing: the in-memory factory value carries milliseconds
    // the timestamp columns do not.
    await user.refresh()
    const before = {
      role: user.role,
      accessStatus: user.accessStatus,
      password: user.password,
      passwordRenewalRequiredAt: user.passwordRenewalRequiredAt?.toISO(),
      invitedAt: user.invitedAt?.toISO(),
      activatedAt: user.activatedAt?.toISO(),
    }

    const response = await client.patch(OWN_IDENTITY_PATH).json(namesOnly(user)).loginAs(user)

    response.assertStatus(200)
    await user.refresh()
    assert.equal(user.role, before.role)
    assert.equal(user.accessStatus, before.accessStatus)
    assert.equal(user.password, before.password)
    assert.equal(user.passwordRenewalRequiredAt?.toISO(), before.passwordRenewalRequiredAt)
    assert.equal(user.invitedAt?.toISO(), before.invitedAt)
    assert.equal(user.activatedAt?.toISO(), before.activatedAt)
    assert.isNotEmpty(rememberedBefore)
    assert.deepEqual(await rememberedConnectionIdsOf(user), rememberedBefore)
  })

  test('writes nothing for a submission identical to the stored identity', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('active').create()
    await user.refresh()
    const updatedAtBefore = user.updatedAt?.toISO()

    const response = await client
      .patch(OWN_IDENTITY_PATH)
      .json({ firstName: user.firstName, lastName: user.lastName, email: user.email })
      .loginAs(user)

    response.assertStatus(200)
    await user.refresh()
    assert.equal(user.updatedAt?.toISO(), updatedAtBefore)
  })

  test('is what the session reads back on its next request', async ({ assert, client }) => {
    const user = await UserFactory.apply('active').create()

    await client.patch(OWN_IDENTITY_PATH).json(namesOnly(user)).loginAs(user)
    const me = await client.get('/api/v1/auth/me').loginAs(user)

    me.assertStatus(200)
    assert.equal(me.body().data.firstName, 'Camille')
    assert.equal(me.body().data.lastName, 'Renard')
  })

  test('refuses an address change without the current password, changing nothing', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('active').create()
    const before = { firstName: user.firstName, email: user.email }

    const response = await client
      .patch(OWN_IDENTITY_PATH)
      .json({ firstName: 'Camille', lastName: 'Renard', email: `moved.${user.id}@example.com` })
      .loginAs(user)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_CURRENT_PASSWORD_REQUIRED')
    await user.refresh()
    assert.equal(user.firstName, before.firstName)
    assert.equal(user.email, before.email)
  })

  test('refuses an address change with an incorrect current password', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('active').create()
    const before = { firstName: user.firstName, email: user.email }

    const response = await client
      .patch(OWN_IDENTITY_PATH)
      .json({
        firstName: 'Camille',
        lastName: 'Renard',
        email: `moved.${user.id}@example.com`,
        currentPassword: 'not-the-password',
      })
      .loginAs(user)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_CURRENT_PASSWORD_INCORRECT')
    await user.refresh()
    assert.equal(user.firstName, before.firstName)
    assert.equal(user.email, before.email)
  })

  test('moves the sign-in address once the current password is confirmed', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('active').create()
    const formerAddress = user.email
    const newAddress = `moved.${user.id}@example.com`

    const response = await client
      .patch(OWN_IDENTITY_PATH)
      .json({
        firstName: user.firstName,
        lastName: user.lastName,
        email: newAddress,
        currentPassword: USER_FACTORY_PASSWORD,
      })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.email, newAddress)
    assert.notProperty(response.body().data, 'currentPassword')
    assert.notProperty(response.body().data, 'password')

    // The session is keyed on the user, not the address: it carries on.
    const me = await client.get('/api/v1/auth/me').withSession(response.session())
    me.assertStatus(200)
    assert.equal(me.body().data.email, newAddress)

    const withNewAddress = await client
      .post('/api/v1/auth/login')
      .json({ email: newAddress, password: USER_FACTORY_PASSWORD })
    withNewAddress.assertStatus(200)

    const withFormerAddress = await client
      .post('/api/v1/auth/login')
      .json({ email: formerAddress, password: USER_FACTORY_PASSWORD })
    withFormerAddress.assertStatus(401)
    assert.equal(withFormerAddress.body().error.code, 'E_LOGIN_INVALID_CREDENTIALS')
  })

  test('never exposes credentials in the response', async ({ assert, client }) => {
    const user = await UserFactory.apply('active').create()

    const response = await client.patch(OWN_IDENTITY_PATH).json(namesOnly(user)).loginAs(user)

    response.assertStatus(200)
    assert.notProperty(response.body().data, 'password')
    assert.notProperty(response.body().data, 'currentPassword')
    assert.notProperty(response.body().data, 'passwordRenewalRequiredAt')
  })
})

test.group('PATCH /api/v1/me/profile authorization', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('lets every active role update themselves', async ({ assert, client }) => {
    for (const role of [
      'ORGANIZATION_ADMIN',
      'OPERATIONS_ADMIN',
      'OPERATIONS_LEAD',
      'OBSERVER',
    ] as const) {
      const user = await UserFactory.apply('active').merge({ role }).create()

      const response = await client.patch(OWN_IDENTITY_PATH).json(namesOnly(user)).loginAs(user)

      response.assertStatus(200)
      await user.refresh()
      assert.equal(user.firstName, 'Camille', role)
    }
  })

  test('rejects unauthenticated access', async ({ assert, client }) => {
    const response = await client
      .patch(OWN_IDENTITY_PATH)
      .json({ firstName: 'Camille', lastName: 'Renard', email: 'camille.renard@example.com' })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects a user whose access is no longer active', async ({ assert, client }) => {
    const user = await UserFactory.apply('deactivated').create()
    const nameBefore = user.firstName

    const response = await client.patch(OWN_IDENTITY_PATH).json(namesOnly(user)).loginAs(user)

    response.assertStatus(401)
    await user.refresh()
    assert.equal(user.firstName, nameBefore)
  })

  test('refuses a user who still owes a password renewal', async ({ assert, client }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()
    const nameBefore = user.firstName

    const response = await client.patch(OWN_IDENTITY_PATH).json(namesOnly(user)).loginAs(user)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_PASSWORD_RENEWAL_REQUIRED')
    await user.refresh()
    assert.equal(user.firstName, nameBefore)
  })

  test('can never be pointed at another user', async ({ assert, client }) => {
    const user = await UserFactory.apply('active').create()
    const other = await UserFactory.apply('active').create()
    const otherBefore = { firstName: other.firstName, email: other.email }

    const response = await client
      .patch(OWN_IDENTITY_PATH)
      .json({ ...namesOnly(user), id: other.id, userId: other.id, targetUserId: other.id })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.id, user.id)
    await user.refresh()
    await other.refresh()
    assert.equal(user.firstName, 'Camille')
    assert.equal(other.firstName, otherBefore.firstName)
    assert.equal(other.email, otherBefore.email)
  })
})

test.group('PATCH /api/v1/me/profile refusals', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('refuses a blank, over-long, or malformed value and names the field', async ({
    assert,
    client,
  }) => {
    const cases = [
      { field: 'firstName', override: { firstName: '   ' } },
      { field: 'lastName', override: { lastName: 'x'.repeat(256) } },
      { field: 'email', override: { email: 'not-an-address' } },
    ]

    for (const { field, override } of cases) {
      const user = await UserFactory.apply('active').create()
      const before = { firstName: user.firstName, lastName: user.lastName, email: user.email }

      const response = await client
        .patch(OWN_IDENTITY_PATH)
        .json({ ...before, ...override })
        .loginAs(user)

      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_VALIDATION_ERROR', field)
      assert.include(
        response.body().error.details.map((detail: { field: string }) => detail.field),
        field,
      )
      await user.refresh()
      assert.deepEqual(
        { firstName: user.firstName, lastName: user.lastName, email: user.email },
        before,
      )
    }
  })

  test('refuses an address another user holds, whatever their status, casing, or padding', async ({
    assert,
    client,
  }) => {
    for (const state of ['active', 'invited', 'deactivated', 'cancelled'] as const) {
      const holder = await UserFactory.apply(state).create()
      const user = await UserFactory.apply('active').create()
      const before = user.email

      const response = await client
        .patch(OWN_IDENTITY_PATH)
        .json({
          firstName: user.firstName,
          lastName: user.lastName,
          email: `  ${holder.email.toUpperCase()}  `,
          currentPassword: USER_FACTORY_PASSWORD,
        })
        .loginAs(user)

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_USER_EMAIL_CONFLICT', state)
      await user.refresh()
      const holderEmail = holder.email
      await holder.refresh()
      assert.equal(user.email, before)
      assert.equal(holder.email, holderEmail)
    }
  })

  test('reveals no conflict to a submission whose password is incorrect', async ({
    assert,
    client,
  }) => {
    const holder = await UserFactory.apply('active').create()
    const user = await UserFactory.apply('active').create()

    const response = await client
      .patch(OWN_IDENTITY_PATH)
      .json({
        firstName: user.firstName,
        lastName: user.lastName,
        email: holder.email,
        currentPassword: 'not-the-password',
      })
      .loginAs(user)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_CURRENT_PASSWORD_INCORRECT')
  })

  test('succeeds once the offending value alone is corrected', async ({ assert, client }) => {
    const holder = await UserFactory.apply('active').create()
    const user = await UserFactory.apply('active').create()
    const submission = {
      firstName: 'Camille',
      lastName: 'Renard',
      email: holder.email,
      currentPassword: USER_FACTORY_PASSWORD,
    }

    const refused = await client.patch(OWN_IDENTITY_PATH).json(submission).loginAs(user)
    refused.assertStatus(409)

    const accepted = await client
      .patch(OWN_IDENTITY_PATH)
      .json({ ...submission, email: `free.${user.id}@example.com` })
      .loginAs(user)

    accepted.assertStatus(200)
    await user.refresh()
    assert.equal(user.firstName, 'Camille')
    assert.equal(user.email, `free.${user.id}@example.com`)
  })
})

test.group('PATCH /api/v1/me/profile after an administrator correction', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('does not restore an address an administrator moved in the meantime', async ({
    assert,
    client,
  }) => {
    const administrator = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const user = await UserFactory.apply('active').create()
    const formerAddress = user.email
    const correctedAddress = `corrected.${user.id}@example.com`

    const correction = await client
      .patch(`/api/v1/users/${user.id}`)
      .json({ firstName: user.firstName, lastName: user.lastName, email: correctedAddress })
      .loginAs(administrator)
    correction.assertStatus(200)

    // The user's form was opened before the correction and still carries the former address.
    const response = await client
      .patch(OWN_IDENTITY_PATH)
      .json({ firstName: 'Camille', lastName: user.lastName, email: formerAddress })
      .loginAs(user)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_CURRENT_PASSWORD_REQUIRED')
    await user.refresh()
    assert.equal(user.email, correctedAddress)
    assert.notEqual(user.firstName, 'Camille')
  })
})
