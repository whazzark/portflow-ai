import { test } from '@japa/runner'

import { USER_FACTORY_PASSWORD, UserFactory } from '#database/factories/user_factory'

test.group('Auth me', () => {
  test('rejects unauthenticated access', async ({ assert, client }) => {
    const response = await client.get('/auth/me')

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects a session when its user is no longer active', async ({ assert, client }) => {
    const activeUser = await UserFactory.apply('active').create()
    const loginResponse = await client
      .post('/auth/login')
      .json({ email: activeUser.email, password: USER_FACTORY_PASSWORD })

    loginResponse.assertStatus(200)
    loginResponse.assertCookie('adonis-session')

    activeUser.accessStatus = 'DEACTIVATED'
    await activeUser.save()

    const unauthenticatedResponse = await client.get('/auth/me')
    const sessionCookie = loginResponse.cookie('adonis-session')
    const response = await client.get('/auth/me').cookie('adonis-session', sessionCookie!.value)

    unauthenticatedResponse.assertStatus(401)
    response.assertStatus(401)
    assert.deepEqual(response.body(), unauthenticatedResponse.body())
  })

  for (const accessStatus of ['PENDING', 'CANCELLED'] as const) {
    test(`rejects a session for a ${accessStatus} user`, async ({ assert, client }) => {
      const activeUser = await UserFactory.apply('active').create()
      activeUser.accessStatus = accessStatus
      await activeUser.save()

      const response = await client.get('/auth/me').loginAs(activeUser)

      response.assertStatus(401)
      assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    })
  }

  test('returns the current authenticated user', async ({ assert, client }) => {
    const activeUser = await UserFactory.apply('active').create()

    const response = await client.get('/auth/me').loginAs(activeUser)

    response.assertStatus(200)
    assert.equal(response.body().data.id, activeUser.id)
    assert.isUndefined(response.body().data.password)
  })

  test('restores a remembered connection after its session disappears', async ({
    assert,
    client,
  }) => {
    const activeUser = await UserFactory.apply('active').create()
    const loginResponse = await client
      .post('/auth/login')
      .json({ email: activeUser.email, password: USER_FACTORY_PASSWORD, rememberMe: true })

    const response = await client
      .get('/auth/me')
      .encryptedCookie('remember_web', loginResponse.cookie('remember_web')!.value)

    response.assertStatus(200)
    assert.equal(response.body().data.id, activeUser.id)
    response.assertCookie('adonis-session')
    assert.notEqual(
      response.cookie('remember_web')?.value,
      loginResponse.cookie('remember_web')?.value,
    )
  })

  test('rejects a remembered session after its absolute expiration', async ({ assert, client }) => {
    const activeUser = await UserFactory.apply('active').create()

    const response = await client.get('/auth/me').withSession({
      auth_web: activeUser.id,
      remembered_connection_expires_at: Date.now() - 1,
    })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })
})
