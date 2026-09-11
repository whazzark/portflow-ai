import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import { REMEMBERED_CONNECTION_EXPIRES_AT_SESSION_KEY } from '#auth/shared/remembered_connection'
import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'

import { issueActivationLink } from '../../../support/activation_links.ts'

const PREVIEW_PATH = '/api/v1/auth/invitation-acceptance/preview'
const ACCEPT_PATH = '/api/v1/auth/invitation-acceptance'
const PASSWORD = 'correct-horse-battery-staple'

const SESSION_OPEN_BODY = {
  error: {
    code: 'E_INVITATION_ACCEPTANCE_SESSION_OPEN',
    message: 'Log out before activating this access',
  },
}

async function assertStillPendingWithUsableLink(
  assert: { equal: (a: unknown, b: unknown) => void; isNull: (a: unknown) => void },
  userId: string,
) {
  const untouched = await User.findOrFail(userId)
  assert.equal(untouched.accessStatus, 'PENDING')
  assert.isNull(untouched.password)
  assert.equal((await db.from('user_activation_tokens').where('user_id', userId)).length, 1)
}

test.group('Invitation acceptance from a browser holding a session', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('refuses an acceptance from an open session and leaves both the link and the session', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)

    const response = await client
      .post(ACCEPT_PATH)
      .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })
      .loginAs(admin)

    response.assertStatus(409)
    assert.deepEqual(response.body(), SESSION_OPEN_BODY)
    response.assertSession('auth_web', admin.id)
    await assertStillPendingWithUsableLink(assert, pending.id)
  })

  test('refuses an acceptance from a session confined to a password renewal', async ({
    assert,
    client,
  }) => {
    const confined = await UserFactory.apply('passwordRenewalRequired').create()
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)

    const response = await client
      .post(ACCEPT_PATH)
      .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })
      .loginAs(confined)

    response.assertStatus(409)
    assert.deepEqual(response.body(), SESSION_OPEN_BODY)
    await assertStillPendingWithUsableLink(assert, pending.id)
  })

  test('refuses the session before looking at the link, so it learns nothing about it', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').create()

    const response = await client
      .post(ACCEPT_PATH)
      .json({
        token: 'a-link-nobody-ever-issued',
        password: PASSWORD,
        passwordConfirmation: PASSWORD,
      })
      .loginAs(admin)

    response.assertStatus(409)
    assert.deepEqual(response.body(), SESSION_OPEN_BODY)
  })

  test('replaces a session that AuthMiddleware would no longer accept: a deactivated user', async ({
    client,
  }) => {
    const deactivated = await UserFactory.apply('active', 'deactivated').create()
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)

    const response = await client
      .post(ACCEPT_PATH)
      .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })
      .loginAs(deactivated)

    response.assertStatus(200)
    response.assertSession('auth_web', pending.id)
  })

  test('replaces a session whose remembered connection has outlived its fixed expiry', async ({
    client,
  }) => {
    const active = await UserFactory.apply('active').create()
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)

    const response = await client
      .post(ACCEPT_PATH)
      .withSession({
        auth_web: active.id,
        [REMEMBERED_CONNECTION_EXPIRES_AT_SESSION_KEY]: Date.now() - 1000,
      })
      .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })

    response.assertStatus(200)
    response.assertSession('auth_web', pending.id)
  })

  test('previews the link whatever session the browser holds', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').create()
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)

    const response = await client.post(PREVIEW_PATH).json({ token }).loginAs(admin)

    response.assertStatus(200)
    assert.equal(response.body().data.email, pending.email)
  })
})
