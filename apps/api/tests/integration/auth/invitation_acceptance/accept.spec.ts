import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiResponse } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'

import { issueActivationLink } from '../../../support/activation_links.ts'

const PREVIEW_PATH = '/api/v1/auth/invitation-acceptance/preview'
const ACCEPT_PATH = '/api/v1/auth/invitation-acceptance'
const PASSWORD = 'correct-horse-battery-staple'

const tokenRowsOf = async (userId: string) =>
  (await db.from('user_activation_tokens').where('user_id', userId)).length

/** FR-020: the secret goes in, and never comes back out. */
function assertTokenAbsent(
  assert: { notInclude: (haystack: string, needle: string) => void },
  response: ApiResponse,
  token: string,
) {
  assert.notInclude(JSON.stringify(response.body()), token)
}

test.group('Invitation acceptance', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('previews whose access a usable link activates, and nothing more', async ({
    assert,
    client,
  }) => {
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)

    const response = await client.post(PREVIEW_PATH).json({ token })

    response.assertStatus(200)
    assert.deepEqual(response.body(), {
      data: { firstName: pending.firstName, lastName: pending.lastName, email: pending.email },
    })
    assertTokenAbsent(assert, response, token)
  })

  test('changes nothing when the link is only previewed', async ({ assert, client }) => {
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)

    await client.post(PREVIEW_PATH).json({ token })
    const again = await client.post(PREVIEW_PATH).json({ token })

    again.assertStatus(200)
    assert.equal(await tokenRowsOf(pending.id), 1)

    const untouched = await User.findOrFail(pending.id)
    assert.equal(untouched.accessStatus, 'PENDING')
    assert.isNull(untouched.password)
  })

  test('activates the access, opens a temporary session, and consumes the link', async ({
    assert,
    client,
  }) => {
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)

    const response = await client
      .post(ACCEPT_PATH)
      .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })

    response.assertStatus(200)
    assert.deepEqual(Object.keys(response.body()), ['data'])
    assert.equal(response.body().data.id, pending.id)
    assert.equal(response.body().data.email, pending.email)
    assert.equal(response.body().data.role, pending.role)
    assert.equal(response.body().data.accessStatus, 'ACTIVE')
    assert.equal(response.body().data.activatedByUserId, pending.id)
    assert.isNotNull(response.body().data.activatedAt)
    assert.isFalse(response.body().data.passwordRenewalRequired)
    assert.isUndefined(response.body().data.password)
    assertTokenAbsent(assert, response, token)

    response.assertSession('auth_web', pending.id)
    assert.equal(await tokenRowsOf(pending.id), 0)

    // A temporary session only. The guard answers a non-remembered login with a *clearing*
    // `remember_web` cookie, so what matters is that no remembered connection exists and that any
    // such cookie carries nothing.
    const rememberedConnections = await db
      .from('remember_me_tokens')
      .where('tokenable_id', pending.id)
    assert.lengthOf(rememberedConnections, 0)
    assert.isNotOk(response.cookie('remember_web')?.value)

    const activated = await User.findOrFail(pending.id)
    assert.isTrue(await hash.verify(activated.password ?? '', PASSWORD))
  })

  test('lets the activated user log in with the password they chose', async ({ client }) => {
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)

    await client
      .post(ACCEPT_PATH)
      .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })

    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: pending.email, password: PASSWORD })

    login.assertStatus(200)
    login.assertSession('auth_web', pending.id)
  })

  test('shows the organization admin an active user with a self-attributed activation', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    // Merged rather than `apply('invited')`, whose state resets the inviter to null.
    const pending = await UserFactory.merge({
      invitedAt: DateTime.now(),
      invitedByUserId: admin.id,
    }).create()
    const { token } = await issueActivationLink(pending)

    await client
      .post(ACCEPT_PATH)
      .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })

    const response = await client.get('/api/v1/users').loginAs(admin)

    response.assertStatus(200)
    const listed = response.body().data.find((user: { id: string }) => user.id === pending.id)
    assert.equal(listed.accessStatus, 'ACTIVE')
    assert.equal(listed.activatedBy.id, pending.id)
    assert.equal(listed.invitedBy.id, admin.id)
  })

  test('refuses the same link once it has been used', async ({ assert, client }) => {
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)

    await client
      .post(ACCEPT_PATH)
      .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })

    const preview = await client.post(PREVIEW_PATH).json({ token })
    const accept = await client
      .post(ACCEPT_PATH)
      .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })

    preview.assertStatus(404)
    accept.assertStatus(404)
    assertTokenAbsent(assert, preview, token)
    assertTokenAbsent(assert, accept, token)
  })
})
