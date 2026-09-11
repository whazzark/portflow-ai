import { test } from '@japa/runner'

import { REMEMBERED_CONNECTION_EXPIRES_AT_SESSION_KEY } from '#auth/shared/remembered_connection'
import { USER_FACTORY_PASSWORD, UserFactory } from '#database/factories/user_factory'

test.group('Auth login', () => {
  test('logs in an active user and starts a session', async ({ assert, client }) => {
    const activeUser = await UserFactory.apply('active').create()

    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: activeUser.email, password: USER_FACTORY_PASSWORD })

    response.assertStatus(200)
    assert.equal(response.body().data.id, activeUser.id)
    assert.isUndefined(response.body().data.password)
    response.assertSession('auth_web', activeUser.id)
  })

  test('starts a remembered connection when requested', async ({ assert, client }) => {
    const activeUser = await UserFactory.apply('active').create()

    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: activeUser.email, password: USER_FACTORY_PASSWORD, rememberMe: true })

    response.assertStatus(200)
    response.assertCookie('remember_web')
    assert.equal(response.cookie('remember_web')?.maxAge, 60 * 60 * 24 * 30)
  })

  test('keeps a session past the next request whatever expiry an earlier remembered connection left', async ({
    assert,
    client,
  }) => {
    const activeUser = await UserFactory.apply('active').create()

    // What a browser keeps once a remembered connection outlived its fixed expiry: the session is
    // refused and loses its user, but the expiry stays.
    const response = await client
      .post('/api/v1/auth/login')
      .withSession({ [REMEMBERED_CONNECTION_EXPIRES_AT_SESSION_KEY]: Date.now() - 1000 })
      .json({ email: activeUser.email, password: USER_FACTORY_PASSWORD })

    response.assertStatus(200)
    response.assertSessionMissing(REMEMBERED_CONNECTION_EXPIRES_AT_SESSION_KEY)

    const me = await client.get('/api/v1/auth/me').withSession(response.session())

    me.assertStatus(200)
    assert.equal(me.body().data.id, activeUser.id)
  })

  test('rejects invalid credentials without creating a session', async ({ assert, client }) => {
    const activeUser = await UserFactory.apply('active').create()

    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: activeUser.email, password: 'wrong-password' })

    response.assertStatus(401)
    assert.deepEqual(response.body(), {
      error: { code: 'E_LOGIN_INVALID_CREDENTIALS', message: 'Invalid credentials' },
    })
    response.assertSessionMissing('auth_web')
  })

  test('rejects a deactivated user with the same generic error without creating a session', async ({
    assert,
    client,
  }) => {
    const deactivatedUser = await UserFactory.apply('active', 'deactivated').create()

    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: deactivatedUser.email, password: USER_FACTORY_PASSWORD })

    response.assertStatus(401)
    assert.deepEqual(response.body(), {
      error: { code: 'E_LOGIN_INVALID_CREDENTIALS', message: 'Invalid credentials' },
    })
    response.assertSessionMissing('auth_web')
  })

  test('reports that an active user owing a password renewal must choose a new one', async ({
    assert,
    client,
  }) => {
    const confinedUser = await UserFactory.apply('passwordRenewalRequired').create()

    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: confinedUser.email, password: USER_FACTORY_PASSWORD })

    response.assertStatus(200)
    assert.equal(response.body().data.id, confinedUser.id)
    assert.isTrue(response.body().data.passwordRenewalRequired)
    response.assertSession('auth_web', confinedUser.id)
  })

  test('reports that an active user owing no password renewal has nothing to choose', async ({
    assert,
    client,
  }) => {
    const activeUser = await UserFactory.apply('active').create()

    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: activeUser.email, password: USER_FACTORY_PASSWORD })

    response.assertStatus(200)
    assert.isFalse(response.body().data.passwordRenewalRequired)
  })

  test('rejects a malformed login payload with a validation error', async ({ assert, client }) => {
    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: 'not-an-email', password: 'x' })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.isArray(response.body().error.details)
  })
})
