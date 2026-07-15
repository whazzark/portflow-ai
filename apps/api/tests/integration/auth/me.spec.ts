import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'

test.group('Auth me', () => {
  test('rejects unauthenticated access', async ({ assert, client }) => {
    const response = await client.get('/auth/me')

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('returns the current authenticated user', async ({ assert, client }) => {
    const activeUser = await UserFactory.apply('active').create()

    const response = await client.get('/auth/me').loginAs(activeUser)

    response.assertStatus(200)
    assert.equal(response.body().data.id, activeUser.id)
    assert.isUndefined(response.body().data.password)
  })
})
