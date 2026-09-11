import { createHash } from 'node:crypto'

import testUtils from '@adonisjs/core/services/test_utils'
import type { Assert } from '@japa/assert'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserActivationTokenFactory } from '#database/factories/user_activation_token_factory'
import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import UserActivationToken from '#models/user_activation_token'

const renewalPathFor = (userId: string) => `/api/v1/users/${userId}/activation-link-renewal`

/** The digest the database keeps of the secret a link carries. */
function digestOf(url: string) {
  return createHash('sha256')
    .update(url.slice(url.lastIndexOf('/') + 1))
    .digest('hex')
}

function organizationAdmin() {
  return UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
}

async function pendingUserHoldingLink() {
  const user = await UserFactory.apply('invited').create()
  const token = await UserActivationTokenFactory.merge({ userId: user.id }).create()

  return { user, token }
}

/** The previous link still exists, untouched, and no renewal was recorded. */
async function assertUntouched(
  assert: Assert,
  user: User,
  token: UserActivationToken,
): Promise<void> {
  const tokens = await UserActivationToken.query().where('userId', user.id)
  assert.lengthOf(tokens, 1)
  assert.equal(tokens[0].hash, token.hash)
  assert.isNull((await User.findOrFail(user.id)).activationLinkRenewedAt)
}

test.group('POST /api/v1/users/:id/activation-link-renewal', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated renewal requests', async ({ assert, client }) => {
    const { user, token } = await pendingUserHoldingLink()

    const response = await client.post(renewalPathFor(user.id))

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    await assertUntouched(assert, user, token)
  })

  test('denies the renewal to every role but an organization admin', async ({ assert, client }) => {
    const { user, token } = await pendingUserHoldingLink()

    for (const role of ['OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const viewer = await UserFactory.apply('active').merge({ role }).create()

      const response = await client.post(renewalPathFor(user.id)).loginAs(viewer)

      response.assertStatus(403)
      assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
    }

    await assertUntouched(assert, user, token)
  })

  test('authorizes before validating, so a refused viewer learns nothing from the identifier', async ({
    assert,
    client,
  }) => {
    const viewer = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    const response = await client.post(renewalPathFor('not-a-uuid')).loginAs(viewer)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('refuses an administrator who owes their own password renewal', async ({
    assert,
    client,
  }) => {
    const confined = await UserFactory.apply('passwordRenewalRequired')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const { user, token } = await pendingUserHoldingLink()

    const response = await client.post(renewalPathFor(user.id)).loginAs(confined)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_PASSWORD_RENEWAL_REQUIRED')
    await assertUntouched(assert, user, token)
  })

  test('rejects an identifier that is not a UUID', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client.post(renewalPathFor('not-a-uuid')).loginAs(admin)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('answers 404 for an identifier that names no user', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client
      .post(renewalPathFor('00000000-0000-4000-8000-000000000000'))
      .loginAs(admin)

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_USER_NOT_FOUND')
  })

  test('refuses a user who is not pending, naming the status they hold', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()

    for (const state of ['active', 'deactivated', 'cancelled'] as const) {
      const target = await UserFactory.apply(state).create()
      const token = await UserActivationTokenFactory.merge({ userId: target.id }).create()

      const response = await client.post(renewalPathFor(target.id)).loginAs(admin)

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_USER_NOT_PENDING')
      assert.deepEqual(response.body().error.meta, { accessStatus: target.accessStatus })
      await assertUntouched(assert, target, token)
    }
  })

  test('returns the renewed pending user and the new activation link, once', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const { user } = await pendingUserHoldingLink()

    const response = await client.post(renewalPathFor(user.id)).loginAs(admin)

    response.assertStatus(200)
    assert.deepEqual(Object.keys(response.body()), ['data'])

    const { user: renewed, activationLink } = response.body().data
    assert.equal(renewed.id, user.id)
    assert.equal(renewed.accessStatus, 'PENDING')
    assert.isString(renewed.activationLinkRenewedAt)
    assert.deepEqual(renewed.activationLinkRenewedBy, {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
    })
    assert.notProperty(renewed, 'password')
    assert.deepEqual(Object.keys(activationLink).sort(), ['expiresAt', 'url'])
    assert.isTrue(activationLink.url.includes('/activate/'))
    assert.notInclude(JSON.stringify(response.body()), '"hash"')
  })

  test('projects the new link’s expiry on the renewed user', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const { user } = await pendingUserHoldingLink()

    const response = await client.post(renewalPathFor(user.id)).loginAs(admin)

    response.assertStatus(200)
    const { user: renewed, activationLink } = response.body().data
    // To the second: the column keeps whole seconds on SQLite, the issued expiry carries milliseconds.
    assert.equal(
      DateTime.fromISO(renewed.activationLinkExpiresAt).toUnixInteger(),
      DateTime.fromISO(activationLink.expiresAt).toUnixInteger(),
    )
  })

  test('leaves the last issued link as the only one, attributed to its administrator', async ({
    assert,
    client,
  }) => {
    const first = await organizationAdmin()
    const second = await organizationAdmin()
    const { user } = await pendingUserHoldingLink()

    await client.post(renewalPathFor(user.id)).loginAs(first)
    await client.post(renewalPathFor(user.id)).loginAs(second)
    const last = await client.post(renewalPathFor(user.id)).loginAs(second)

    const tokens = await UserActivationToken.query().where('userId', user.id)
    assert.lengthOf(tokens, 1)
    assert.equal(tokens[0].hash, digestOf(last.body().data.activationLink.url))
    assert.equal((await User.findOrFail(user.id)).activationLinkRenewedByUserId, second.id)
  })

  // Under SQLite and the suite's global transaction, the two requests' transactions are savepoints
  // that knex runs one after the other, so this proves the outcome of overlapping renewals rather
  // than the PostgreSQL row lock itself. The lock was exercised against PostgreSQL by hand — eight
  // concurrent renewals, one surviving link, its administrator and dates recorded (see tasks T052).
  test('leaves exactly one live link when renewals overlap', async ({ assert, client }) => {
    const firstAdministrator = await organizationAdmin()
    const secondAdministrator = await organizationAdmin()
    const { user } = await pendingUserHoldingLink()

    const responses = await Promise.all([
      client.post(renewalPathFor(user.id)).loginAs(firstAdministrator),
      client.post(renewalPathFor(user.id)).loginAs(secondAdministrator),
    ])

    for (const response of responses) {
      response.assertStatus(200)
    }

    const tokens = await UserActivationToken.query().where('userId', user.id)
    assert.lengthOf(tokens, 1, 'two renewals never leave two working links')
    // Whichever won, the surviving link and the recorded renewal agree: the administrator named in
    // the history is the one who was handed the link that works.
    const survivor = responses.find(
      (response) => digestOf(response.body().data.activationLink.url) === tokens[0].hash,
    )
    assert.exists(survivor, 'the surviving link is one of the two handed out')
    assert.equal(
      (await User.findOrFail(user.id)).activationLinkRenewedByUserId,
      survivor?.body().data.user.activationLinkRenewedBy.id,
    )
  })

  test('never exposes the renewed link through the user collection', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const { user } = await pendingUserHoldingLink()

    const renewal = await client.post(renewalPathFor(user.id)).loginAs(admin)
    const { activationLink } = renewal.body().data
    const secret = activationLink.url.slice(activationLink.url.lastIndexOf('/') + 1)

    const collection = await client.get('/api/v1/users').loginAs(admin)

    collection.assertStatus(200)
    const payload = JSON.stringify(collection.body())
    assert.notInclude(payload, activationLink.url)
    assert.notInclude(payload, secret)
    assert.notInclude(payload, '"hash"')
  })
})
