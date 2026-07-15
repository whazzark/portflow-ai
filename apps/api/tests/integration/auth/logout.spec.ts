import { test } from '@japa/runner'

import { USER_FACTORY_PASSWORD, UserFactory } from '#database/factories/user_factory'

test.group('Auth logout', () => {
  test('rejects unauthenticated access', async ({ assert, client }) => {
    const response = await client.post('/auth/logout')

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('clears the session and signs the user out', async ({ client }) => {
    const activeUser = await UserFactory.apply('active').create()

    const response = await client.post('/auth/logout').loginAs(activeUser)

    response.assertStatus(204)
    response.assertSessionMissing('auth_web')
  })

  test('revokes the remembered connection used by the current browser', async ({
    assert,
    client,
  }) => {
    const activeUser = await UserFactory.apply('active').create()
    const loginResponse = await client
      .post('/auth/login')
      .json({ email: activeUser.email, password: USER_FACTORY_PASSWORD, rememberMe: true })
    const rememberedCookie = loginResponse.cookie('remember_web')
    const sessionCookie = loginResponse.cookie('adonis-session')

    if (!rememberedCookie || !sessionCookie) {
      throw new Error('Expected remembered connection and session cookies')
    }

    const logoutResponse = await client
      .post('/auth/logout')
      .cookie('adonis-session', sessionCookie.value)
      .encryptedCookie('remember_web', rememberedCookie.value)

    logoutResponse.assertStatus(204)
    logoutResponse.assertSessionMissing('auth_web')

    const restoredSessionResponse = await client
      .get('/auth/me')
      .encryptedCookie('remember_web', rememberedCookie.value)

    restoredSessionResponse.assertStatus(401)
    assert.equal(restoredSessionResponse.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('keeps another browser remembered connection available after local logout', async ({
    assert,
    client,
  }) => {
    const activeUser = await UserFactory.apply('active').create()
    const firstLoginResponse = await client
      .post('/auth/login')
      .json({ email: activeUser.email, password: USER_FACTORY_PASSWORD, rememberMe: true })
    const secondLoginResponse = await client
      .post('/auth/login')
      .json({ email: activeUser.email, password: USER_FACTORY_PASSWORD, rememberMe: true })
    const firstRememberedCookie = firstLoginResponse.cookie('remember_web')
    const firstSessionCookie = firstLoginResponse.cookie('adonis-session')
    const secondRememberedCookie = secondLoginResponse.cookie('remember_web')

    if (!firstRememberedCookie || !firstSessionCookie || !secondRememberedCookie) {
      throw new Error('Expected remembered connection and session cookies for both browsers')
    }

    const logoutResponse = await client
      .post('/auth/logout')
      .cookie('adonis-session', firstSessionCookie.value)
      .encryptedCookie('remember_web', firstRememberedCookie.value)

    logoutResponse.assertStatus(204)

    const firstBrowserResponse = await client
      .get('/auth/me')
      .encryptedCookie('remember_web', firstRememberedCookie.value)
    const secondBrowserResponse = await client
      .get('/auth/me')
      .encryptedCookie('remember_web', secondRememberedCookie.value)

    firstBrowserResponse.assertStatus(401)
    assert.equal(firstBrowserResponse.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    secondBrowserResponse.assertStatus(200)
    assert.equal(secondBrowserResponse.body().data.id, activeUser.id)
  })
})
