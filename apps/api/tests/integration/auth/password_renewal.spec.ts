import { Secret } from '@adonisjs/core/helpers'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { USER_FACTORY_PASSWORD, UserFactory } from '#database/factories/user_factory'
import User from '#models/user'

const NEW_PASSWORD = 'correct-horse-battery-staple'
const RENEWAL_PATH = '/api/v1/auth/password-renewal'

const INVALID_CREDENTIALS_BODY = {
  error: { code: 'E_LOGIN_INVALID_CREDENTIALS', message: 'Invalid credentials' },
}

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

test.group('Auth password renewal', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('renews the password, clears the requirement, and reports it in the response', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()

    const response = await client
      .post(RENEWAL_PATH)
      .json({ password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD })
      .loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(Object.keys(response.body()), ['data'])
    assert.equal(response.body().data.id, user.id)
    assert.equal(response.body().data.email, user.email)
    assert.equal(response.body().data.role, user.role)
    assert.equal(response.body().data.accessStatus, 'ACTIVE')
    assert.isFalse(response.body().data.passwordRenewalRequired)
    assert.isUndefined(response.body().data.password)
    assert.isUndefined(response.body().data.passwordRenewalRequiredAt)

    const renewed = await User.findOrFail(user.id)
    assert.isNull(renewed.passwordRenewalRequiredAt)
    assert.isTrue(await hash.verify(renewed.password ?? '', NEW_PASSWORD))
  })

  test('keeps the renewing session valid and lets it reach a business endpoint immediately', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()

    const loginResponse = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: USER_FACTORY_PASSWORD })

    loginResponse.assertStatus(200)
    assert.isTrue(loginResponse.body().data.passwordRenewalRequired)
    loginResponse.assertSession('auth_web', user.id)

    // The session opened by that login, carried by hand: the test harness gives each request its
    // own session store, so continuity is expressed as the session *state* the login produced.
    const renewalResponse = await client
      .post(RENEWAL_PATH)
      .withSession({ auth_web: user.id })
      .json({ password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD })

    renewalResponse.assertStatus(200)
    // FR-014: the renewal must not terminate the session it was performed from.
    renewalResponse.assertSession('auth_web', user.id)

    const businessResponse = await client
      .get('/api/v1/customers')
      .withSession({ auth_web: user.id })

    businessResponse.assertStatus(200)
  })

  test('accepts the new password at the next login and rejects the replaced one', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()

    const renewalResponse = await client
      .post(RENEWAL_PATH)
      .json({ password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD })
      .loginAs(user)

    renewalResponse.assertStatus(200)

    const newPasswordResponse = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: NEW_PASSWORD })

    newPasswordResponse.assertStatus(200)
    assert.isFalse(newPasswordResponse.body().data.passwordRenewalRequired)

    const replacedPasswordResponse = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: USER_FACTORY_PASSWORD })

    replacedPasswordResponse.assertStatus(401)
    assert.deepEqual(replacedPasswordResponse.body(), INVALID_CREDENTIALS_BODY)
    replacedPasswordResponse.assertSessionMissing('auth_web')
  })
  test('confines a session restored from a remembered connection exactly as a fresh sign-in', async ({
    assert,
    client,
  }) => {
    // The remembered connection is established *before* the requirement exists, which is the case
    // US2-3 describes: a browser that was trusted under the credential now being replaced.
    const user = await UserFactory.apply('active').create()

    const loginResponse = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: USER_FACTORY_PASSWORD, rememberMe: true })

    loginResponse.assertStatus(200)
    assert.isFalse(loginResponse.body().data.passwordRenewalRequired)

    const rememberedCookie = loginResponse.cookie('remember_web')

    if (!rememberedCookie) {
      throw new Error('Expected a remembered connection cookie')
    }

    user.passwordRenewalRequiredAt = DateTime.now()
    await user.save()

    const restoredResponse = await client
      .get('/api/v1/customers')
      .encryptedCookie('remember_web', rememberedCookie.value)

    restoredResponse.assertStatus(403)
    assert.equal(restoredResponse.body().error.code, 'E_PASSWORD_RENEWAL_REQUIRED')
  })

  test('confines a live session from its next request without signing the user out', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('active').create()

    const beforeResponse = await client.get('/api/v1/customers').withSession({ auth_web: user.id })
    beforeResponse.assertStatus(200)

    user.passwordRenewalRequiredAt = DateTime.now()
    await user.save()

    const afterResponse = await client.get('/api/v1/customers').withSession({ auth_web: user.id })

    afterResponse.assertStatus(403)
    assert.equal(afterResponse.body().error.code, 'E_PASSWORD_RENEWAL_REQUIRED')
    // FR-005: confined, not terminated — the session still identifies the user.
    afterResponse.assertSession('auth_web', user.id)

    const meResponse = await client.get('/api/v1/auth/me').withSession({ auth_web: user.id })
    meResponse.assertStatus(200)
    assert.isTrue(meResponse.body().data.passwordRenewalRequired)
  })

  test('lets a confined session sign out and leaves the requirement standing for the next sign-in', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()

    const logoutResponse = await client.post('/api/v1/auth/logout').loginAs(user)
    logoutResponse.assertStatus(204)

    const loginResponse = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: USER_FACTORY_PASSWORD })

    loginResponse.assertStatus(200)
    assert.isTrue(loginResponse.body().data.passwordRenewalRequired)

    const stillOwing = await User.findOrFail(user.id)
    assert.isNotNull(stillOwing.passwordRenewalRequiredAt)
  })

  test('refuses a renewal from a session whose user was deactivated while confined', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()
    const storedPassword = user.password

    user.accessStatus = 'DEACTIVATED'
    user.deactivatedAt = DateTime.now()
    await user.save()

    const response = await client
      .post(RENEWAL_PATH)
      .json({ password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD })
      .withSession({ auth_web: user.id })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')

    const untouched = await User.findOrFail(user.id)
    assert.equal(untouched.password, storedPassword)
    assert.isNotNull(untouched.passwordRenewalRequiredAt)
  })

  test('leaves a second user owing no renewal entirely unaffected', async ({ assert, client }) => {
    const confinedUser = await UserFactory.apply('passwordRenewalRequired').create()
    const unconfinedUser = await UserFactory.apply('active').create()

    const confinedResponse = await client.get('/api/v1/customers').loginAs(confinedUser)
    const unconfinedResponse = await client.get('/api/v1/customers').loginAs(unconfinedUser)

    confinedResponse.assertStatus(403)
    unconfinedResponse.assertStatus(200)

    const renewalResponse = await client
      .post(RENEWAL_PATH)
      .json({ password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD })
      .loginAs(confinedUser)
    renewalResponse.assertStatus(200)

    const unaffected = await User.findOrFail(unconfinedUser.id)
    assert.equal(unaffected.password, unconfinedUser.password)
    assert.isNull(unaffected.passwordRenewalRequiredAt)
    assert.isTrue((await client.get('/api/v1/customers').loginAs(unconfinedUser)).status() === 200)
  })
  test('revokes the other remembered connections and keeps the one it was performed from', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()
    const otherUser = await UserFactory.apply('passwordRenewalRequired').create()

    const renewingBrowser = await rememberOnANewBrowser(client, user)
    const otherBrowser = await rememberOnANewBrowser(client, user)
    const otherUserBrowser = await rememberOnANewBrowser(client, otherUser)

    assert.lengthOf(await rememberedConnectionIdsOf(user), 2)
    assert.lengthOf(await rememberedConnectionIdsOf(otherUser), 1)

    const renewingConnection = await User.rememberMeTokens.verify(new Secret(renewingBrowser))

    if (!renewingConnection) {
      throw new Error('Expected the renewing browser to hold a valid remembered connection')
    }

    // An established session *plus* the cookie: the guard does not recycle the token on this
    // request, so the renewal can identify which connection to spare.
    const response = await client
      .post(RENEWAL_PATH)
      .withSession({ auth_web: user.id })
      .encryptedCookie('remember_web', renewingBrowser)
      .json({ password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD })

    response.assertStatus(200)

    assert.deepEqual(await rememberedConnectionIdsOf(user), [Number(renewingConnection.identifier)])
    assert.lengthOf(await rememberedConnectionIdsOf(otherUser), 1)

    // US3-3: the renewing browser still restores after a restart…
    const restoredResponse = await client
      .get('/api/v1/auth/me')
      .encryptedCookie('remember_web', renewingBrowser)
    restoredResponse.assertStatus(200)
    assert.equal(restoredResponse.body().data.id, user.id)

    // …and US3-1: the other one must sign in again.
    const revokedResponse = await client
      .get('/api/v1/auth/me')
      .encryptedCookie('remember_web', otherBrowser)
    revokedResponse.assertStatus(401)

    // US3-4: nobody else's connections were touched.
    const otherUserResponse = await client
      .get('/api/v1/auth/me')
      .encryptedCookie('remember_web', otherUserBrowser)
    // `auth.me` is exempt from the confinement, so a restored connection answers here — which is
    // exactly what proves it was not revoked.
    otherUserResponse.assertStatus(200)
    assert.equal(otherUserResponse.body().data.id, otherUser.id)
  })

  test('revokes nothing when the renewal is refused', async ({ assert, client }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()

    const renewingBrowser = await rememberOnANewBrowser(client, user)
    await rememberOnANewBrowser(client, user)

    const before = await rememberedConnectionIdsOf(user)
    assert.lengthOf(before, 2)

    const response = await client
      .post(RENEWAL_PATH)
      .withSession({ auth_web: user.id })
      .encryptedCookie('remember_web', renewingBrowser)
      .json({ password: 'short', passwordConfirmation: 'short' })

    response.assertStatus(422)
    assert.deepEqual(await rememberedConnectionIdsOf(user), before)
  })

  test('revokes every connection, including the fresh one, when the renewal restores the session', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()

    const onlyBrowser = await rememberOnANewBrowser(client, user)
    assert.lengthOf(await rememberedConnectionIdsOf(user), 1)

    // The documented edge (research D8): with no established session, the guard restores from the
    // cookie and *recycles* the token before the controller can identify it, so `verify()` finds
    // nothing and every connection is revoked — including the replacement this request just
    // received. It over-revokes, which is the safe direction, and the session survives, so the user
    // is not signed out mid-renewal. Only a client whose *first* request is the renewal can reach
    // it; the web shell always calls `auth.me` first.
    const response = await client
      .post(RENEWAL_PATH)
      .encryptedCookie('remember_web', onlyBrowser)
      .json({ password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD })

    response.assertStatus(200)
    assert.isFalse(response.body().data.passwordRenewalRequired)
    response.assertSession('auth_web', user.id)

    assert.lengthOf(await rememberedConnectionIdsOf(user), 0)
  })
  test('refuses a password that breaks the length or confirmation rules and writes nothing', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()
    const storedPassword = user.password

    const refusals = [
      { label: 'too short', password: 'short-pass', passwordConfirmation: 'short-pass' },
      {
        label: 'too long',
        password: 'a'.repeat(129),
        passwordConfirmation: 'a'.repeat(129),
      },
      { label: 'empty', password: '', passwordConfirmation: '' },
      {
        label: 'mismatched confirmation',
        password: NEW_PASSWORD,
        passwordConfirmation: `${NEW_PASSWORD}-typo`,
      },
    ]

    for (const refusal of refusals) {
      const response = await client
        .post(RENEWAL_PATH)
        .json({ password: refusal.password, passwordConfirmation: refusal.passwordConfirmation })
        .loginAs(user)

      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_VALIDATION_ERROR', refusal.label)
      assert.isArray(response.body().error.details, refusal.label)

      const untouched = await User.findOrFail(user.id)
      assert.equal(untouched.password, storedPassword, refusal.label)
      assert.isNotNull(untouched.passwordRenewalRequiredAt, refusal.label)
    }
  })

  test('reports a mismatched confirmation against the confirmation field', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()

    const response = await client
      .post(RENEWAL_PATH)
      .json({ password: NEW_PASSWORD, passwordConfirmation: `${NEW_PASSWORD}-typo` })
      .loginAs(user)

    response.assertStatus(422)
    // VineJS's `confirmed` rule reports against the *other* field, which is what carries the message
    // to the confirmation input through the delivered `applyValidationError` path.
    const [detail] = response.body().error.details
    assert.equal(detail.field, 'passwordConfirmation')
    assert.equal(detail.rule, 'confirmed')
  })

  test('refuses a new password identical to the one being replaced', async ({ assert, client }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()
    const storedPassword = user.password

    const response = await client
      .post(RENEWAL_PATH)
      .json({ password: USER_FACTORY_PASSWORD, passwordConfirmation: USER_FACTORY_PASSWORD })
      .loginAs(user)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_PASSWORD_RENEWAL_UNCHANGED')

    const untouched = await User.findOrFail(user.id)
    assert.equal(untouched.password, storedPassword)
    assert.isNotNull(untouched.passwordRenewalRequiredAt)
  })

  test('refuses a renewal submitted on an expired session and leaves the requirement standing', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()
    const storedPassword = user.password

    const response = await client
      .post(RENEWAL_PATH)
      .json({ password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD })
      .withSession({ auth_web: user.id, remembered_connection_expires_at: Date.now() - 1 })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')

    const untouched = await User.findOrFail(user.id)
    assert.equal(untouched.password, storedPassword)
    assert.isNotNull(untouched.passwordRenewalRequiredAt)
  })

  test('refuses an unauthenticated renewal without revealing anything about any user', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('passwordRenewalRequired').create()

    const response = await client
      .post(RENEWAL_PATH)
      .json({ password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD })

    response.assertStatus(401)
    assert.deepEqual(response.body(), {
      error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Unauthorized access' },
    })

    const untouched = await User.findOrFail(user.id)
    assert.isNotNull(untouched.passwordRenewalRequiredAt)
  })

  test('refuses a renewal from a session owing nothing', async ({ assert, client }) => {
    const user = await UserFactory.apply('active').create()

    const response = await client
      .post(RENEWAL_PATH)
      .json({ password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD })
      .loginAs(user)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_PASSWORD_RENEWAL_NOT_REQUIRED')

    const untouched = await User.findOrFail(user.id)
    assert.equal(untouched.password, user.password)
  })
})
