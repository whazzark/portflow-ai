import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'

import { USER_FACTORY_PASSWORD, UserFactory } from '#database/factories/user_factory'
import type User from '#models/user'

const NEW_PASSWORD = 'correct-horse-battery-staple'

const organizationAdmin = () =>
  UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

const reactivatePath = (id: string) => `/api/v1/users/${id}/reactivate`
const deactivatePath = (id: string) => `/api/v1/users/${id}/deactivate`

/**
 * Read straight from the table rather than through `RememberMeToken`, for the reason
 * `tests/integration/auth/password_renewal.spec.ts` gives.
 */
async function rememberedConnectionsOf(user: User) {
  return (await db.from('remember_me_tokens').where('tokenable_id', user.id)).length
}

/** Someone who once held access: `active` gives them the factory password, `deactivated` retires it. */
const formerlyActiveUser = () => UserFactory.apply('active', 'deactivated').create()

/** Signs a user in the real way, returning the response that carries the session it opened. */
async function signIn(client: ApiClient, user: User, rememberMe = false) {
  const response = await client
    .post('/api/v1/auth/login')
    .json({ email: user.email, password: USER_FACTORY_PASSWORD, rememberMe })

  response.assertStatus(200)

  return response
}

/**
 * The user side of the reactivation, through the real commands: what a returning user can and
 * cannot do with the browsers they held before, and with a fresh sign-in.
 */
test.group('Reactivated user sessions', () => {
  test('lets the user sign back in with their previous password, straight to the renewal step', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await formerlyActiveUser()

    ;(await client.post(reactivatePath(target.id)).loginAs(admin)).assertStatus(200)

    const login = await signIn(client, target)
    assert.isTrue(login.body().data.passwordRenewalRequired)

    const me = await client.get('/api/v1/auth/me').withSession(login.session())
    me.assertStatus(200)
    assert.isTrue(me.body().data.passwordRenewalRequired)

    const confined = await client.get('/api/v1/customers').withSession(login.session())
    confined.assertStatus(403)
    assert.equal(confined.body().error.code, 'E_PASSWORD_RENEWAL_REQUIRED')
  })

  test('opens the application in the same session once the new password is chosen', async ({
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await formerlyActiveUser()

    ;(await client.post(reactivatePath(target.id)).loginAs(admin)).assertStatus(200)

    const login = await signIn(client, target)
    const renewal = await client
      .post('/api/v1/auth/password-renewal')
      .withSession(login.session())
      .json({ password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD })

    renewal.assertStatus(200)

    const customers = await client.get('/api/v1/customers').withSession(renewal.session())
    customers.assertStatus(200)
  })

  test('grants nothing to a session opened before the deactivation, not even the renewal step', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('active').create()

    const before = await signIn(client, target)
    ;(await client.post(deactivatePath(target.id)).loginAs(admin)).assertStatus(200)
    ;(await client.post(reactivatePath(target.id)).loginAs(admin)).assertStatus(200)

    const revived = await client.get('/api/v1/auth/me').withSession(before.session())
    revived.assertStatus(401)
    assert.equal(revived.body().error.code, 'E_UNAUTHORIZED_ACCESS')

    const renewal = await client
      .post('/api/v1/auth/password-renewal')
      .withSession(revived.session())
      .json({ password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD })
    renewal.assertStatus(401)
  })

  test('restores nothing from a remembered connection made before the deactivation', async ({
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('active').create()

    const before = await signIn(client, target, true)
    const remembered = before.cookie('remember_web')

    if (!remembered) {
      throw new Error('Expected a remembered connection cookie')
    }

    ;(await client.post(deactivatePath(target.id)).loginAs(admin)).assertStatus(200)
    ;(await client.post(reactivatePath(target.id)).loginAs(admin)).assertStatus(200)

    const restored = await client
      .get('/api/v1/auth/me')
      .encryptedCookie('remember_web', remembered.value)
    restored.assertStatus(401)
  })

  test('leaves every other user sessions and remembered connections standing', async ({
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('active').create()
    const bystander = await UserFactory.apply('active').create()

    const bystanderSession = await signIn(client, bystander)
    const bystanderRemembered = (await signIn(client, bystander, true)).cookie('remember_web')

    if (!bystanderRemembered) {
      throw new Error('Expected a remembered connection cookie')
    }

    ;(await client.post(deactivatePath(target.id)).loginAs(admin)).assertStatus(200)
    ;(await client.post(reactivatePath(target.id)).loginAs(admin)).assertStatus(200)

    ;(await client.get('/api/v1/auth/me').withSession(bystanderSession.session())).assertStatus(200)
    ;(
      await client.get('/api/v1/auth/me').encryptedCookie('remember_web', bystanderRemembered.value)
    ).assertStatus(200)
  })

  test('leaves the user sessions and connections as they were when the reactivation is refused', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await formerlyActiveUser()

    ;(await client.post(reactivatePath(target.id)).loginAs(admin)).assertStatus(200)
    const current = await signIn(client, target, true)
    const tokensBefore = await rememberedConnectionsOf(target)

    const refused = await client.post(reactivatePath(target.id)).loginAs(admin)
    refused.assertStatus(409)

    ;(await client.get('/api/v1/auth/me').withSession(current.session())).assertStatus(200)
    assert.equal(await rememberedConnectionsOf(target), tokensBefore)
    assert.isAbove(tokensBefore, 0)
  })

  test('refuses a session from an earlier active period after a second reactivation', async ({
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await formerlyActiveUser()

    ;(await client.post(reactivatePath(target.id)).loginAs(admin)).assertStatus(200)
    const firstPeriod = await signIn(client, target)
    ;(await client.get('/api/v1/auth/me').withSession(firstPeriod.session())).assertStatus(200)

    ;(await client.post(deactivatePath(target.id)).loginAs(admin)).assertStatus(200)
    ;(await client.post(reactivatePath(target.id)).loginAs(admin)).assertStatus(200)

    ;(await client.get('/api/v1/auth/me').withSession(firstPeriod.session())).assertStatus(401)
    const secondPeriod = await signIn(client, target)
    ;(await client.get('/api/v1/auth/me').withSession(secondPeriod.session())).assertStatus(200)
  })
})
