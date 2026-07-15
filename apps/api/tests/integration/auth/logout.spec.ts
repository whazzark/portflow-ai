import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'

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
})
