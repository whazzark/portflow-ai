import { createHash, randomUUID } from 'node:crypto'

import type { ApiClient } from '@japa/api-client'
import type { Assert } from '@japa/assert'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import UserActivationToken from '#models/user_activation_token'

const ACCEPT_PATH = '/api/v1/auth/invitation-acceptance'
const PASSWORD = 'correct-horse-battery-staple'

const organizationAdmin = () =>
  UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

const tokensOf = async (userId: string) =>
  (await UserActivationToken.query().where('userId', userId)).length

const restorePath = (id: string) => `/api/v1/users/${id}/restore-invitation`

/** A cancelled user straight from the factory, for the refusals that never reach the write. */
const cancelledUser = () => UserFactory.apply('cancelled').create()

/** Nothing about the target moved: still cancelled, never restored, and holding no link. */
async function assertStillCancelled(assert: Assert, id: string) {
  const stored = await User.findOrFail(id)
  assert.equal(stored.accessStatus, 'CANCELLED')
  assert.isNull(stored.invitationRestoredAt)
  assert.isNull(stored.invitationRestoredByUserId)
  assert.equal(await tokensOf(id), 0)
}

/** The secret an activation link carries — what the invited person presents to accept. */
const secretOf = (url: string) => url.slice(url.lastIndexOf('/') + 1)

/**
 * A cancelled invitation reached through the real endpoints, as an administrator would reach one:
 * invited (the link it handed out is kept as link A), then cancelled with a comment. The email is
 * unique because this suite shares one database across tests.
 */
async function cancelledInvitation(client: ApiClient, admin: User) {
  const invitation = await client
    .post('/api/v1/users')
    .json({
      firstName: 'Claire',
      lastName: 'Martin',
      email: `claire.martin.${randomUUID()}@portflow.test`,
      role: 'OPERATIONS_LEAD',
    })
    .loginAs(admin)
  invitation.assertStatus(201)
  const { user, activationLink } = invitation.body().data

  const cancellation = await client
    .post(`/api/v1/users/${user.id}/cancel-invitation`)
    .json({ comment: 'Start date postponed.' })
    .loginAs(admin)
  cancellation.assertStatus(200)

  return { user: cancellation.body().data, linkA: activationLink.url as string }
}

test.group('POST /api/v1/users/:id/restore-invitation', () => {
  test('restores a cancelled invitation and hands out a new link in the invitation envelope', async ({
    assert,
    client,
  }) => {
    const inviter = await organizationAdmin()
    const admin = await organizationAdmin()
    const { user: cancelled } = await cancelledInvitation(client, inviter)

    const response = await client
      .post(restorePath(cancelled.id))
      .json({ comment: 'Start date confirmed.' })
      .loginAs(admin)

    response.assertStatus(200)
    const { user, activationLink } = response.body().data
    assert.equal(user.id, cancelled.id)
    assert.equal(user.accessStatus, 'PENDING')
    assert.isNotNull(user.invitationRestoredAt)
    assert.deepEqual(user.invitationRestoredBy, {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
    })
    assert.equal(user.invitationRestorationComment, 'Start date confirmed.')
    // The invitation and the cancellation it reverses are those the user held while cancelled.
    assert.equal(user.invitedAt, cancelled.invitedAt)
    assert.deepEqual(user.invitedBy, cancelled.invitedBy)
    assert.equal(user.cancelledAt, cancelled.cancelledAt)
    assert.deepEqual(user.cancelledBy, cancelled.cancelledBy)
    assert.equal(user.cancellationComment, 'Start date postponed.')
    assert.equal(user.email, cancelled.email)
    assert.equal(user.role, 'OPERATIONS_LEAD')
    assert.isUndefined(user.password)

    assert.isTrue(activationLink.url.includes('/activate/'))
    // To the second: the column keeps whole seconds, the issued expiry carries milliseconds.
    assert.equal(
      DateTime.fromISO(user.activationLinkExpiresAt).toUnixInteger(),
      DateTime.fromISO(activationLink.expiresAt).toUnixInteger(),
    )
    assert.approximately(
      DateTime.fromISO(activationLink.expiresAt).diff(DateTime.now(), 'hours').hours,
      24 * 7,
      1,
    )
    assert.equal(await tokensOf(cancelled.id), 1)
  })

  test('leaves the restored user unable to sign in until they accept', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const { user } = await cancelledInvitation(client, admin)

    await client.post(restorePath(user.id)).loginAs(admin)
    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: 'Password!234' })

    login.assertStatus(401)
    // Indistinguishable from a wrong password: the refusal never says which reason applied.
    assert.deepEqual(login.body(), {
      error: { code: 'E_LOGIN_INVALID_CREDENTIALS', message: 'Invalid credentials' },
    })
  })

  test('keeps the link from before the cancellation dead, and lets the new one activate', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const { user, linkA } = await cancelledInvitation(client, admin)

    const restoration = await client.post(restorePath(user.id)).loginAs(admin)
    restoration.assertStatus(200)
    const linkB = restoration.body().data.activationLink.url as string

    // GH-8 accepts any live link of a pending user, which the restored user is again: link A must
    // not have survived to come back to life.
    const withLinkA = await client
      .post(ACCEPT_PATH)
      .json({ token: secretOf(linkA), password: PASSWORD, passwordConfirmation: PASSWORD })
    withLinkA.assertStatus(404)
    assert.equal(withLinkA.body().error.code, 'E_ACTIVATION_LINK_UNUSABLE')

    const withLinkB = await client
      .post(ACCEPT_PATH)
      .json({ token: secretOf(linkB), password: PASSWORD, passwordConfirmation: PASSWORD })
    withLinkB.assertStatus(200)
    assert.equal(withLinkB.body().data.id, user.id)
    assert.equal(withLinkB.body().data.accessStatus, 'ACTIVE')
    withLinkB.assertSession('auth_web', user.id)
  })

  test('stores and returns the comment without its surrounding spaces', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await cancelledUser()

    const response = await client
      .post(restorePath(target.id))
      .json({ comment: '  Start date confirmed.  ' })
      .loginAs(admin)

    response.assertStatus(200)
    assert.equal(response.body().data.user.invitationRestorationComment, 'Start date confirmed.')
    assert.equal(
      (await User.findOrFail(target.id)).invitationRestorationComment,
      'Start date confirmed.',
    )
  })

  test('accepts a restoration without a body and records no comment', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await cancelledUser()

    const response = await client.post(restorePath(target.id)).loginAs(admin)

    response.assertStatus(200)
    assert.isNull(response.body().data.user.invitationRestorationComment)
  })

  test('accepts a comment of exactly 1,000 characters', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const target = await cancelledUser()

    const response = await client
      .post(restorePath(target.id))
      .json({ comment: 'x'.repeat(1000) })
      .loginAs(admin)

    response.assertStatus(200)
    assert.lengthOf(response.body().data.user.invitationRestorationComment, 1000)
  })

  test('refuses a longer comment and leaves the invitation cancelled', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await cancelledUser()

    const response = await client
      .post(restorePath(target.id))
      .json({ comment: 'x'.repeat(1001) })
      .loginAs(admin)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(response.body().error.details[0].field, 'comment')
    await assertStillCancelled(assert, target.id)
  })

  test('keeps only the latest restoration, comment included, across a second cancellation', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const { user } = await cancelledInvitation(client, admin)

    const first = await client
      .post(restorePath(user.id))
      .json({ comment: 'First restoration.' })
      .loginAs(admin)
    first.assertStatus(200)
    const recancelled = await client
      .post(`/api/v1/users/${user.id}/cancel-invitation`)
      .json({ comment: 'Postponed again.' })
      .loginAs(admin)
    recancelled.assertStatus(200)
    // The restoration stays recorded while the user is cancelled again: nothing clears it.
    assert.equal(recancelled.body().data.invitationRestorationComment, 'First restoration.')

    const second = await client.post(restorePath(user.id)).loginAs(admin)

    second.assertStatus(200)
    const restored = second.body().data.user
    assert.isNull(restored.invitationRestorationComment)
    assert.isAtLeast(
      DateTime.fromISO(restored.invitationRestoredAt).toUnixInteger(),
      DateTime.fromISO(first.body().data.user.invitationRestoredAt).toUnixInteger(),
    )
    assert.equal(restored.cancellationComment, 'Postponed again.')
    assert.equal(restored.cancelledAt, recancelled.body().data.cancelledAt)
    assert.equal(await tokensOf(user.id), 1)
  })

  test('rejects unauthenticated access', async ({ assert, client }) => {
    const target = await cancelledUser()

    const response = await client.post(restorePath(target.id))

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    await assertStillCancelled(assert, target.id)
  })

  // Authorization runs before the id is validated or the target read, so the denial is the same
  // body whether the id names a cancelled user, nobody, or is not an id at all (FR-013).
  test('denies the command to every role but an organization admin, whatever the target', async ({
    assert,
    client,
  }) => {
    const target = await cancelledUser()

    for (const role of ['OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const viewer = await UserFactory.apply('active').merge({ role }).create()
      const bodies: unknown[] = []

      for (const id of [target.id, '00000000-0000-4000-8000-999999999999', 'not-a-uuid']) {
        const response = await client
          .post(restorePath(id))
          .json({ comment: 'x'.repeat(2000) })
          .loginAs(viewer)

        response.assertStatus(403)
        bodies.push(response.body())
      }

      assert.equal((bodies[0] as { error: { code: string } }).error.code, 'E_AUTHORIZATION_FAILURE')
      assert.deepEqual(bodies[1], bodies[0])
      assert.deepEqual(bodies[2], bodies[0])
    }

    await assertStillCancelled(assert, target.id)
  })

  // A non-active user holds no session at all (GH-3), so the refusal arrives as an unauthenticated
  // one rather than an authorization failure.
  test('denies the command to an organization admin whose access is not active', async ({
    assert,
    client,
  }) => {
    const viewer = await UserFactory.apply('deactivated')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const target = await cancelledUser()

    const response = await client.post(restorePath(target.id)).loginAs(viewer)

    response.assertStatus(401)
    await assertStillCancelled(assert, target.id)
  })

  test('refuses an administrator who owes their own password renewal', async ({
    assert,
    client,
  }) => {
    const confined = await UserFactory.apply('passwordRenewalRequired')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const target = await cancelledUser()

    const response = await client.post(restorePath(target.id)).loginAs(confined)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_PASSWORD_RENEWAL_REQUIRED')
    await assertStillCancelled(assert, target.id)
  })

  test('refuses an unknown user as not found', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client
      .post(restorePath('00000000-0000-4000-8000-999999999999'))
      .loginAs(admin)

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_USER_NOT_FOUND')
  })

  test('refuses a user who is not cancelled with the status they hold, and issues nothing', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()

    for (const [state, accessStatus] of [
      ['active', 'ACTIVE'],
      ['deactivated', 'DEACTIVATED'],
    ] as const) {
      const target = await UserFactory.apply(state).create()

      const response = await client.post(restorePath(target.id)).loginAs(admin)

      response.assertStatus(409)
      assert.deepEqual(response.body(), {
        error: {
          code: 'E_USER_NOT_CANCELLED',
          message: 'Only a cancelled invitation can be restored',
          meta: { accessStatus },
        },
      })
      assert.equal((await User.findOrFail(target.id)).accessStatus, accessStatus)
      assert.equal(await tokensOf(target.id), 0)
    }
  })

  test('refuses the requester’s own access as not cancelled', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client.post(restorePath(admin.id)).loginAs(admin)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_USER_NOT_CANCELLED')
    assert.deepEqual(response.body().error.meta, { accessStatus: 'ACTIVE' })
  })

  test('refuses a pending invitation and leaves the link it already handed out working', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const invitation = await client
      .post('/api/v1/users')
      .json({
        firstName: 'Claire',
        lastName: 'Martin',
        email: `claire.martin.${randomUUID()}@portflow.test`,
        role: 'OPERATIONS_LEAD',
      })
      .loginAs(admin)
    const { user, activationLink } = invitation.body().data

    const response = await client.post(restorePath(user.id)).loginAs(admin)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_USER_NOT_CANCELLED')
    assert.deepEqual(response.body().error.meta, { accessStatus: 'PENDING' })
    assert.isUndefined(response.body().data)
    assert.notInclude(JSON.stringify(response.body()), '/activate/')

    // The refused restoration issued nothing, so the invitation's own link still activates.
    const accepted = await client.post(ACCEPT_PATH).json({
      token: secretOf(activationLink.url),
      password: PASSWORD,
      passwordConfirmation: PASSWORD,
    })
    accepted.assertStatus(200)
    assert.equal(accepted.body().data.accessStatus, 'ACTIVE')
  })

  test('resolves two concurrent restorations to exactly one, with one link', async ({
    assert,
    client,
  }) => {
    const first = await organizationAdmin()
    const second = await organizationAdmin()
    const target = await cancelledUser()

    const responses = await Promise.all([
      client.post(restorePath(target.id)).json({ comment: 'From the first.' }).loginAs(first),
      client.post(restorePath(target.id)).json({ comment: 'From the second.' }).loginAs(second),
    ])

    const statuses = responses.map((response) => response.status()).sort()
    assert.deepEqual(statuses, [200, 409])
    const [winner, loser] = responses[0].status() === 200 ? responses : [...responses].reverse()
    assert.equal(loser.body().error.code, 'E_USER_NOT_CANCELLED')
    assert.deepEqual(loser.body().error.meta, { accessStatus: 'PENDING' })
    assert.notInclude(JSON.stringify(loser.body()), '/activate/')

    // The stored event is the winner's, comment included, and so is the one link.
    const stored = await User.findOrFail(target.id)
    const won = winner.body().data
    assert.equal(stored.invitationRestoredByUserId, won.user.invitationRestoredBy.id)
    assert.equal(stored.invitationRestorationComment, won.user.invitationRestorationComment)
    const tokens = await UserActivationToken.query().where('userId', target.id)
    assert.lengthOf(tokens, 1)
    assert.equal(
      tokens[0].hash,
      createHash('sha256').update(secretOf(won.activationLink.url)).digest('hex'),
    )
  })

  test('keeps the restored user out of an operations admin’s collection', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const operationsAdmin = await UserFactory.apply('active')
      .merge({ role: 'OPERATIONS_ADMIN' })
      .create()
    const { user } = await cancelledInvitation(client, admin)
    await client.post(restorePath(user.id)).loginAs(admin)

    const response = await client.get('/api/v1/users').loginAs(operationsAdmin)

    response.assertStatus(200)
    const ids = (response.body().data as Array<{ id: string }>).map((row) => row.id)
    assert.notInclude(ids, user.id)
  })
})
