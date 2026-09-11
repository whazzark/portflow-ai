import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'

import { USER_FACTORY_PASSWORD, UserFactory } from '#database/factories/user_factory'
import type User from '#models/user'

const resetPathFor = (userId: string) => `/api/v1/users/${userId}/password-reset`

function organizationAdmin() {
  return UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
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
function rememberedConnectionCountOf(user: User) {
  return db
    .from('remember_me_tokens')
    .where('tokenable_id', user.id)
    .count('* as total')
    .then((rows: Array<{ total: number | string }>) => Number(rows[0]?.total ?? 0))
}

test.group('POST /api/v1/users/:id/password-reset', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated reset requests', async ({ assert, client }) => {
    const target = await UserFactory.apply('active').create()

    const response = await client.post(resetPathFor(target.id))

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('denies the reset to every role but an organization admin', async ({ assert, client }) => {
    const target = await UserFactory.apply('active').create()

    for (const role of ['OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const viewer = await UserFactory.apply('active').merge({ role }).create()

      const response = await client.post(resetPathFor(target.id)).loginAs(viewer)

      response.assertStatus(403)
      assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
    }

    const untouched = await target.refresh()
    assert.isNull(untouched.passwordRenewalRequiredAt)
    assert.isNull(untouched.passwordResetAt)
  })

  // The requester owes their own renewal: the route sits inside the group carrying
  // `passwordRenewalCompleted`, so the confinement refuses this before the controller runs.
  test('denies the reset to an administrator confined to their own password renewal', async ({
    assert,
    client,
  }) => {
    const confined = await UserFactory.apply('passwordRenewalRequired')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const target = await UserFactory.apply('active').create()

    const response = await client.post(resetPathFor(target.id)).loginAs(confined)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_PASSWORD_RENEWAL_REQUIRED')

    const untouched = await target.refresh()
    assert.isNull(untouched.passwordRenewalRequiredAt)
  })

  test('records the requirement and the attributed reset event, disclosing no credential', async ({
    assert,
    client,
  }) => {
    const administrator = await organizationAdmin()
    const target = await UserFactory.apply('active').create()

    const response = await client.post(resetPathFor(target.id)).loginAs(administrator)

    response.assertStatus(200)
    assert.deepEqual(Object.keys(response.body()), ['data'])

    const { data } = response.body()
    assert.equal(data.id, target.id)
    assert.equal(data.email, target.email)
    assert.equal(data.role, target.role)
    assert.equal(data.accessStatus, 'ACTIVE')
    assert.isTrue(data.passwordRenewalRequired)
    assert.isNotNull(data.passwordResetAt)
    assert.equal(data.passwordResetBy.id, administrator.id)
    assert.equal(data.passwordResetBy.firstName, administrator.firstName)

    // Nothing a credential could be reconstructed from, and not the raw requirement timestamp
    // either — the interface needs one bit, and it gets one bit.
    assert.isUndefined(data.password)
    assert.isUndefined(data.passwordRenewalRequiredAt)
    assert.notProperty(data.passwordResetBy, 'password')
  })

  test('leaves the target able to sign in with the password they already hold', async ({
    assert,
    client,
  }) => {
    const administrator = await organizationAdmin()
    const target = await UserFactory.apply('active').create()

    await client.post(resetPathFor(target.id)).loginAs(administrator)

    // The reset hands over no credential and changes no password: the target authenticates exactly
    // as before, and meets the renewal step instead of the application.
    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: target.email, password: USER_FACTORY_PASSWORD })

    login.assertStatus(200)
    assert.isTrue(login.body().data.passwordRenewalRequired)
  })

  test('confines the target to the renewal step from their next request, without signing them out', async ({
    assert,
    client,
  }) => {
    const administrator = await organizationAdmin()
    const target = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    // Reaches the application before the reset.
    const before = await client.get('/api/v1/users').loginAs(target)
    before.assertStatus(200)

    await client.post(resetPathFor(target.id)).loginAs(administrator)

    const after = await client.get('/api/v1/users').loginAs(target)

    // `403`, not `401`: the session is valid and must not be terminated.
    after.assertStatus(403)
    assert.equal(after.body().error.code, 'E_PASSWORD_RENEWAL_REQUIRED')
  })

  test('refuses a reset targeting a user who is not active', async ({ assert, client }) => {
    const administrator = await organizationAdmin()

    for (const state of ['invited', 'deactivated', 'cancelled'] as const) {
      const target = await UserFactory.apply(state).create()

      const response = await client.post(resetPathFor(target.id)).loginAs(administrator)

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_USER_NOT_ACTIVE')

      const untouched = await target.refresh()
      assert.isNull(untouched.passwordRenewalRequiredAt)
      assert.isNull(untouched.passwordResetAt)
    }
  })

  test('refuses a reset targeting an identifier naming no user', async ({ assert, client }) => {
    const administrator = await organizationAdmin()

    const response = await client
      .post(resetPathFor('3f1b0b64-0000-4000-8000-000000000000'))
      .loginAs(administrator)

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_USER_NOT_FOUND')
  })

  test('rejects a malformed identifier before any user is read', async ({ assert, client }) => {
    const administrator = await organizationAdmin()

    const response = await client.post(resetPathFor('not-a-uuid')).loginAs(administrator)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.isArray(response.body().error.details)
  })

  test('refuses an administrator resetting their own password', async ({ assert, client }) => {
    const administrator = await organizationAdmin()

    const response = await client.post(resetPathFor(administrator.id)).loginAs(administrator)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_USER_PASSWORD_RESET_SELF')

    const untouched = await administrator.refresh()
    assert.isNull(untouched.passwordRenewalRequiredAt)
  })

  // PostgreSQL resolves an upper-cased identifier to the same row as its canonical lower-case
  // spelling, so the refusal must survive the spelling, not the comparison that happens to match.
  test('refuses a self-reset spelled with an upper-case identifier', async ({ assert, client }) => {
    const administrator = await organizationAdmin()

    const response = await client
      .post(resetPathFor(administrator.id.toUpperCase()))
      .loginAs(administrator)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_USER_PASSWORD_RESET_SELF')

    const untouched = await administrator.refresh()
    assert.isNull(untouched.passwordRenewalRequiredAt)
  })

  test('revokes every remembered connection the target holds, and only theirs', async ({
    assert,
    client,
  }) => {
    const administrator = await organizationAdmin()
    const target = await UserFactory.apply('active').create()
    const bystander = await UserFactory.apply('active').create()

    await rememberOnANewBrowser(client, target)
    await rememberOnANewBrowser(client, target)
    await rememberOnANewBrowser(client, bystander)

    assert.equal(await rememberedConnectionCountOf(target), 2)

    await client.post(resetPathFor(target.id)).loginAs(administrator)

    // The 30-day restore window on the password being replaced, closed. No connection is spared:
    // the administrator is not the target, so there is none to spare.
    assert.equal(await rememberedConnectionCountOf(target), 0)
    assert.equal(await rememberedConnectionCountOf(bystander), 1)
  })

  test('revokes nothing when the reset is refused', async ({ assert, client }) => {
    const administrator = await organizationAdmin()
    const deactivated = await UserFactory.apply('deactivated').create()

    await db.table('remember_me_tokens').insert({
      tokenable_id: deactivated.id,
      hash: 'refused-reset-hash',
      created_at: new Date(),
      updated_at: new Date(),
      expires_at: new Date(Date.now() + 86_400_000),
    })

    const response = await client.post(resetPathFor(deactivated.id)).loginAs(administrator)

    response.assertStatus(409)
    assert.equal(await rememberedConnectionCountOf(deactivated), 1)
  })

  test('leaves exactly one outstanding requirement when the same user is reset twice', async ({
    assert,
    client,
  }) => {
    const firstAdministrator = await organizationAdmin()
    const secondAdministrator = await organizationAdmin()
    const target = await UserFactory.apply('active').create()

    await client.post(resetPathFor(target.id)).loginAs(firstAdministrator)
    const second = await client.post(resetPathFor(target.id)).loginAs(secondAdministrator)

    second.assertStatus(200)

    // One state, refreshed — not a queue of two renewals the user would have to clear twice.
    const reset = await target.refresh()
    assert.isNotNull(reset.passwordRenewalRequiredAt)
    assert.equal(reset.passwordResetByUserId, secondAdministrator.id)
    assert.equal(second.body().data.passwordResetBy.id, secondAdministrator.id)
  })

  test('leaves exactly one outstanding requirement under concurrent resets', async ({
    assert,
    client,
  }) => {
    const firstAdministrator = await organizationAdmin()
    const secondAdministrator = await organizationAdmin()
    const target = await UserFactory.apply('active').create()

    const [first, second] = await Promise.all([
      client.post(resetPathFor(target.id)).loginAs(firstAdministrator),
      client.post(resetPathFor(target.id)).loginAs(secondAdministrator),
    ])

    first.assertStatus(200)
    second.assertStatus(200)

    const reset = await target.refresh()
    assert.isNotNull(reset.passwordRenewalRequiredAt)
    assert.oneOf(reset.passwordResetByUserId, [firstAdministrator.id, secondAdministrator.id])
    // Whichever won, the event and the state agree — never one administrator's date beside
    // another's identity.
    assert.deepEqual(
      reset.passwordResetAt?.toMillis() ?? null,
      reset.passwordRenewalRequiredAt?.toMillis() ?? null,
    )
  })

  test('presents the reset in the user collection to an organization admin only', async ({
    assert,
    client,
  }) => {
    const administrator = await organizationAdmin()
    const operationsAdmin = await UserFactory.apply('active')
      .merge({ role: 'OPERATIONS_ADMIN' })
      .create()
    const target = await UserFactory.apply('active').create()

    await client.post(resetPathFor(target.id)).loginAs(administrator)

    const toAdministrator = await client.get('/api/v1/users').loginAs(administrator)
    const seenByAdministrator = toAdministrator
      .body()
      .data.find((user: { id: string }) => user.id === target.id)

    assert.isTrue(seenByAdministrator.passwordRenewalRequired)
    assert.isNotNull(seenByAdministrator.passwordResetAt)
    assert.equal(seenByAdministrator.passwordResetBy.id, administrator.id)

    const toOperationsAdmin = await client.get('/api/v1/users').loginAs(operationsAdmin)
    const seenByOperationsAdmin = toOperationsAdmin
      .body()
      .data.find((user: { id: string }) => user.id === target.id)

    // Withheld keys are absent, not null — the rule `#4` established for every lifecycle actor.
    assert.notProperty(seenByOperationsAdmin, 'passwordResetAt')
    assert.notProperty(seenByOperationsAdmin, 'passwordResetBy')
    assert.notProperty(seenByOperationsAdmin, 'passwordRenewalRequired')
  })
})
