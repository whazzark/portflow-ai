import router from '@adonisjs/core/services/router'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'

/**
 * The whole of FR-006's exemption list. Everything else under `/api/v1` is confined by *placement*
 * — it lives in the group carrying `middleware.passwordRenewalCompleted()` — and this sweep is what
 * proves it, by reading the router the application actually loaded rather than a list kept by hand.
 *
 * A route added to the small `/api/v1/auth` group is not in this set, so the sweep requests it and
 * fails: exempting an endpoint has to be written down here, deliberately.
 */
const EXEMPT_ROUTE_NAMES = new Set(['auth.me', 'auth.logout', 'auth.password_renewal'])

/**
 * Reached without a session at all, so there is nothing to confine. Named rather than skipped by a
 * pattern, for the same reason as the set above: a second unauthenticated `/api/v1` route has to be
 * declared here before this sweep will pass.
 */
const UNAUTHENTICATED_ROUTE_NAMES = new Set(['auth.login'])

const ARBITRARY_UUID = '00000000-0000-4000-8000-000000000000'

type RegisteredRoute = { pattern: string; name: string; methods: string[] }

function registeredApiRoutes(): RegisteredRoute[] {
  // The same API `node ace list:routes` reads, keyed by domain.
  const byDomain = router.toJSON() as Record<string, RegisteredRoute[]>

  return Object.values(byDomain)
    .flat()
    .filter((route) => route.pattern.startsWith('/api/v1'))
}

function confinedRoutes(): Array<{ pattern: string; name: string; method: string }> {
  return registeredApiRoutes()
    .filter(
      (route) =>
        !EXEMPT_ROUTE_NAMES.has(route.name) && !UNAUTHENTICATED_ROUTE_NAMES.has(route.name),
    )
    .flatMap((route) =>
      route.methods
        // HEAD is registered alongside every GET and exercises the same handler.
        .filter((method) => method !== 'HEAD')
        .map((method) => ({ pattern: route.pattern, name: route.name, method })),
    )
}

function fillPathParameters(pattern: string) {
  return pattern.replace(/:[^/]+/g, ARBITRARY_UUID)
}

test.group('Auth password renewal confinement', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('registers every exempt route, so the exemption list cannot drift out of the router', ({
    assert,
  }) => {
    const registeredNames = new Set(registeredApiRoutes().map((route) => route.name))

    for (const name of [...EXEMPT_ROUTE_NAMES, ...UNAUTHENTICATED_ROUTE_NAMES]) {
      assert.isTrue(registeredNames.has(name), `Expected ${name} to be a registered /api/v1 route`)
    }
  })

  test('refuses every business endpoint for a confined session', async ({ assert, client }) => {
    const confinedUser = await UserFactory.apply('passwordRenewalRequired').create()
    const routes = confinedRoutes()

    assert.isAbove(routes.length, 0, 'Expected at least one confined /api/v1 route')

    for (const route of routes) {
      const response = await client
        .request(fillPathParameters(route.pattern), route.method)
        .loginAs(confinedUser)

      assert.equal(
        response.status(),
        403,
        `Expected ${route.method} ${route.pattern} (${route.name}) to be refused for a confined session`,
      )
      assert.equal(
        response.body().error.code,
        'E_PASSWORD_RENEWAL_REQUIRED',
        `Expected ${route.method} ${route.pattern} (${route.name}) to report the renewal requirement`,
      )
    }
  })

  test('allows every exempt route for a confined session', async ({ assert, client }) => {
    const confinedUser = await UserFactory.apply('passwordRenewalRequired').create()

    const meResponse = await client.get('/api/v1/auth/me').loginAs(confinedUser)
    meResponse.assertStatus(200)
    assert.isTrue(meResponse.body().data.passwordRenewalRequired)

    const renewalResponse = await client
      .post('/api/v1/auth/password-renewal')
      .json({
        password: 'correct-horse-battery-staple',
        passwordConfirmation: 'correct-horse-battery-staple',
      })
      .loginAs(confinedUser)
    renewalResponse.assertStatus(200)

    const stillConfinedUser = await UserFactory.apply('passwordRenewalRequired').create()
    const logoutResponse = await client.post('/api/v1/auth/logout').loginAs(stillConfinedUser)
    logoutResponse.assertStatus(204)
  })

  test('discloses no more about an existing record than about one that does not exist', async ({
    assert,
    client,
  }) => {
    const confinedUser = await UserFactory.apply('passwordRenewalRequired').create()
    const existingCustomer = await CustomerFactory.create()

    // The middleware runs before any lookup, so a confined request cannot be turned into a 404 that
    // tells the caller which ids are real — FR-006's "no business data is disclosed", including the
    // existence of a record.
    const existingResponse = await client
      .patch(`/api/v1/customers/${existingCustomer.id}`)
      .json({ code: 'CHANGED01', companyName: 'Changed Company' })
      .loginAs(confinedUser)
    const missingResponse = await client
      .patch(`/api/v1/customers/${ARBITRARY_UUID}`)
      .json({ code: 'CHANGED01', companyName: 'Changed Company' })
      .loginAs(confinedUser)

    existingResponse.assertStatus(403)
    missingResponse.assertStatus(403)
    assert.deepEqual(existingResponse.body(), missingResponse.body())

    await existingCustomer.refresh()
    assert.notEqual(existingCustomer.code, 'CHANGED01')
  })
})
