import { Secret } from '@adonisjs/core/helpers'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'

import { USER_FACTORY_PASSWORD, UserFactory } from '#database/factories/user_factory'
import User from '#models/user'

const PASSWORD_PATH = '/api/v1/me/password'
const NEW_PASSWORD = 'correct-horse-battery-staple'

const submission = (overrides: Record<string, string> = {}) => ({
  currentPassword: USER_FACTORY_PASSWORD,
  password: NEW_PASSWORD,
  passwordConfirmation: NEW_PASSWORD,
  ...overrides,
})

/** Signs a user in from one more "browser", returning that browser's remembered-connection value. */
async function rememberOnANewBrowser(client: ApiClient, user: User) {
  const response = await client
    .post('/api/v1/auth/login')
    .json({ email: user.email, password: USER_FACTORY_PASSWORD, rememberMe: true })

  response.assertStatus(200)
  const cookie = response.cookie('remember_web')

  if (!cookie) {
    throw new Error('Expected a remembered connection cookie')
  }

  return cookie.value as string
}

function rememberedConnectionIdsOf(user: User) {
  return db
    .from('remember_me_tokens')
    .where('tokenable_id', user.id)
    .select('id')
    .then((rows: Array<{ id: number }>) => rows.map((row) => Number(row.id)))
}

test.group('PATCH /api/v1/me/password', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('replaces the password and signs the user in with the new one', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('active').create()
    const passwordBefore = user.password

    const response = await client.patch(PASSWORD_PATH).json(submission()).loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.id, user.id)
    assert.notProperty(response.body().data, 'password')
    assert.notProperty(response.body().data, 'currentPassword')
    await user.refresh()
    assert.notEqual(user.password, passwordBefore)
    assert.isNull(user.passwordRenewalRequiredAt)

    const withNew = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: NEW_PASSWORD })
    withNew.assertStatus(200)

    const withFormer = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: USER_FACTORY_PASSWORD })
    withFormer.assertStatus(401)
  })

  test('lets every active role change their own password', async ({ assert, client }) => {
    for (const role of [
      'ORGANIZATION_ADMIN',
      'OPERATIONS_ADMIN',
      'OPERATIONS_LEAD',
      'OBSERVER',
    ] as const) {
      const user = await UserFactory.apply('active').merge({ role }).create()
      const passwordBefore = user.password

      const response = await client.patch(PASSWORD_PATH).json(submission()).loginAs(user)

      response.assertStatus(200)
      await user.refresh()
      assert.notEqual(user.password, passwordBefore, role)
    }
  })

  test('refuses an incorrect current password, changing nothing', async ({ assert, client }) => {
    const user = await UserFactory.apply('active').create()
    const passwordBefore = user.password

    const response = await client
      .patch(PASSWORD_PATH)
      .json(submission({ currentPassword: 'not-the-password' }))
      .loginAs(user)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_CURRENT_PASSWORD_INCORRECT')
    await user.refresh()
    assert.equal(user.password, passwordBefore)
  })

  test('refuses a new password identical to the current one', async ({ assert, client }) => {
    const user = await UserFactory.apply('active').create()

    const response = await client
      .patch(PASSWORD_PATH)
      .json(
        submission({
          password: USER_FACTORY_PASSWORD,
          passwordConfirmation: USER_FACTORY_PASSWORD,
        }),
      )
      .loginAs(user)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_PASSWORD_UNCHANGED')
  })

  test('refuses a weak new password and a mismatched confirmation', async ({ assert, client }) => {
    const user = await UserFactory.apply('active').create()
    const passwordBefore = user.password

    const tooShort = await client
      .patch(PASSWORD_PATH)
      .json(submission({ password: 'short', passwordConfirmation: 'short' }))
      .loginAs(user)
    tooShort.assertStatus(422)
    assert.equal(tooShort.body().error.code, 'E_VALIDATION_ERROR')

    const mismatched = await client
      .patch(PASSWORD_PATH)
      .json(submission({ passwordConfirmation: 'something-else-entirely' }))
      .loginAs(user)
    mismatched.assertStatus(422)
    assert.include(
      mismatched.body().error.details.map((detail: { field: string }) => detail.field),
      'passwordConfirmation',
    )

    await user.refresh()
    assert.equal(user.password, passwordBefore)
  })

  test('keeps the connection it was performed from and revokes the others', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('active').create()
    const keptCookie = await rememberOnANewBrowser(client, user)
    await rememberOnANewBrowser(client, user)
    assert.lengthOf(await rememberedConnectionIdsOf(user), 2)
    const kept = await User.rememberMeTokens.verify(new Secret(keptCookie))

    const response = await client
      .patch(PASSWORD_PATH)
      .json(submission())
      .loginAs(user)
      .withEncryptedCookie('remember_web', keptCookie)

    response.assertStatus(200)
    assert.deepEqual(await rememberedConnectionIdsOf(user), [Number(kept?.identifier)])
  })

  test('rejects unauthenticated access', async ({ assert, client }) => {
    const response = await client.patch(PASSWORD_PATH).json(submission())

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('refuses a user who still owes a password renewal', async ({ assert, client }) => {
    // That user renews through `/auth/password-renewal`, which asks for no current password.
    const user = await UserFactory.apply('passwordRenewalRequired').create()

    const response = await client.patch(PASSWORD_PATH).json(submission()).loginAs(user)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_PASSWORD_RENEWAL_REQUIRED')
  })
})
