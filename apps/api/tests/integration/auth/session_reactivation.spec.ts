import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { USER_FACTORY_PASSWORD, UserFactory } from '#database/factories/user_factory'

const REACTIVATION_SESSION_KEY = 'user_reactivated_at'

/**
 * The rule `session_reactivation.ts` adds to what makes a session count, in isolation: the users
 * here carry a `reactivated_at` straight from the factory, so the rule is proven before any command
 * can produce one. `tests/integration/users/reactivation/sessions.spec.ts` proves the same thing
 * through the real deactivation and reactivation.
 *
 * `loginAs` puts nothing in the session but the user, which is exactly what a browser that signed in
 * before the reactivation holds — so for a reactivated user it is the stale session, not a
 * shortcut to a valid one.
 */
test.group('Auth session opened before a reactivation', () => {
  test('keeps counting the session of a user who was never reactivated', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('active').create()

    const response = await client.get('/api/v1/auth/me').loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.id, user.id)
  })

  test('refuses a session carrying no reactivation for a reactivated user, and forgets it', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('reactivated').create()

    const response = await client.get('/api/v1/auth/me').loginAs(user)

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    response.assertSessionMissing('auth_web')

    const next = await client.get('/api/v1/auth/me').withSession(response.session())

    next.assertStatus(401)
  })

  test('refuses a session opened under an earlier reactivation', async ({ assert, client }) => {
    const user = await UserFactory.apply('reactivated').create()
    const earlier = Date.now() - 3 * 24 * 60 * 60 * 1000

    const response = await client
      .get('/api/v1/auth/me')
      .withSession({ auth_web: user.id, [REACTIVATION_SESSION_KEY]: earlier })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('counts a session opened by signing in after the reactivation', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('reactivated').create()

    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: USER_FACTORY_PASSWORD })

    login.assertStatus(200)

    const me = await client.get('/api/v1/auth/me').withSession(login.session())

    me.assertStatus(200)
    assert.equal(me.body().data.id, user.id)
  })

  test('counts a session restored from a remembered connection made after the reactivation', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('reactivated').create()

    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: USER_FACTORY_PASSWORD, rememberMe: true })

    login.assertStatus(200)
    const remembered = login.cookie('remember_web')

    if (!remembered) {
      throw new Error('Expected a remembered connection cookie')
    }

    // A browser reopened later: no session left, only the remembered connection.
    const restored = await client
      .get('/api/v1/auth/me')
      .encryptedCookie('remember_web', remembered.value)

    restored.assertStatus(200)
    assert.equal(restored.body().data.id, user.id)

    const next = await client.get('/api/v1/auth/me').withSession(restored.session())

    next.assertStatus(200)
  })

  test('refuses a remembered connection that outlived a reactivation', async ({ client }) => {
    const user = await UserFactory.apply('active').create()

    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: USER_FACTORY_PASSWORD, rememberMe: true })

    login.assertStatus(200)
    const remembered = login.cookie('remember_web')

    if (!remembered) {
      throw new Error('Expected a remembered connection cookie')
    }

    // A reactivation that leaves the connection standing: `reactivateDeactivated` revokes every one
    // of them, so both rows are written by hand here to model the write that one day forgets to.
    // The connection is aged rather than the reactivation dated ahead, so the order of the two is
    // unambiguous however fast the test runs. Each column is written in the shape its owner writes:
    // a SQL string for the Lucid model's timestamp, a `Date` for the token provider's own.
    await db
      .from('remember_me_tokens')
      .where('tokenable_id', user.id)
      .update({ created_at: new Date(Date.now() - 60 * 60 * 1000) })
    await db
      .from('users')
      .where('id', user.id)
      .update({ reactivated_at: DateTime.now().toSQL({ includeOffset: false }) })

    const restored = await client
      .get('/api/v1/auth/me')
      .encryptedCookie('remember_web', remembered.value)

    restored.assertStatus(401)
  })
})
