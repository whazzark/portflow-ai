import { test } from '@japa/runner'

import { UserActivationTokenFactory } from '#database/factories/user_activation_token_factory'
import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import UserActivationToken from '#models/user_activation_token'

const organizationAdmin = () =>
  UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

const pendingUserWithLink = async (invitedByUserId: string | null = null) => {
  const user = await UserFactory.apply('invited').merge({ role: 'OPERATIONS_LEAD' }).create()
  // Written after creation rather than merged in: the `invited` state runs after the merged
  // attributes and would put `invitedByUserId` back to null.
  user.invitedByUserId = invitedByUserId
  await user.save()
  await UserActivationTokenFactory.merge({ userId: user.id }).create()

  return user
}

const tokensOf = async (userId: string) =>
  (await UserActivationToken.query().where('userId', userId)).length

const cancelPath = (id: string) => `/api/v1/users/${id}/cancel-invitation`

test.group('POST /api/v1/users/:id/cancel-invitation', () => {
  test('cancels a pending invitation and returns the administration projection', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const inviter = await organizationAdmin()
    const target = await pendingUserWithLink(inviter.id)

    const response = await client
      .post(cancelPath(target.id))
      .json({ comment: 'Hired elsewhere.' })
      .loginAs(admin)

    response.assertStatus(200)
    const body = response.body().data
    assert.equal(body.id, target.id)
    assert.equal(body.accessStatus, 'CANCELLED')
    assert.isNotNull(body.cancelledAt)
    assert.deepEqual(body.cancelledBy, {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
    })
    assert.equal(body.cancellationComment, 'Hired elsewhere.')
    assert.deepEqual(body.invitedBy, {
      id: inviter.id,
      firstName: inviter.firstName,
      lastName: inviter.lastName,
    })
    assert.equal(body.email, target.email)
    assert.equal(body.role, 'OPERATIONS_LEAD')
    // No credential of any kind travels back: the link is gone, and a cancelled user never had a
    // password to disclose.
    assert.isUndefined(body.password)
    assert.isUndefined(body.activationLink)
    assert.notInclude(JSON.stringify(response.body()), '/activate/')
  })

  test('deletes the activation link the invitation handed out', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const target = await pendingUserWithLink()

    await client.post(cancelPath(target.id)).loginAs(admin)

    assert.equal(await tokensOf(target.id), 0)
  })

  test('refuses a login with the email of a cancelled user', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const target = await pendingUserWithLink()

    await client.post(cancelPath(target.id)).loginAs(admin)

    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: target.email, password: 'Password!234' })

    login.assertStatus(401)
    // Indistinguishable from a wrong password: the refusal never says which reason applied.
    assert.deepEqual(login.body(), {
      error: { code: 'E_LOGIN_INVALID_CREDENTIALS', message: 'Invalid credentials' },
    })
  })

  test('stores and returns the comment without its surrounding spaces', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await pendingUserWithLink()

    const response = await client
      .post(cancelPath(target.id))
      .json({ comment: '   Hired elsewhere.   ' })
      .loginAs(admin)

    response.assertStatus(200)
    assert.equal(response.body().data.cancellationComment, 'Hired elsewhere.')
    assert.equal((await User.findOrFail(target.id)).cancellationComment, 'Hired elsewhere.')
  })

  test('accepts a cancellation without a body and records no comment', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await pendingUserWithLink()

    const response = await client.post(cancelPath(target.id)).loginAs(admin)

    response.assertStatus(200)
    assert.isNull(response.body().data.cancellationComment)
  })

  test('accepts a comment of exactly 1,000 characters', async ({ assert, client }) => {
    const admin = await organizationAdmin()
    const target = await pendingUserWithLink()

    const response = await client
      .post(cancelPath(target.id))
      .json({ comment: 'x'.repeat(1000) })
      .loginAs(admin)

    response.assertStatus(200)
    assert.lengthOf(response.body().data.cancellationComment, 1000)
  })

  test('refuses a longer comment and leaves the invitation standing', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const target = await pendingUserWithLink()

    const response = await client
      .post(cancelPath(target.id))
      .json({ comment: 'x'.repeat(1001) })
      .loginAs(admin)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(response.body().error.details[0].field, 'comment')
    assert.equal((await User.findOrFail(target.id)).accessStatus, 'PENDING')
    assert.equal(await tokensOf(target.id), 1)
  })

  test('refuses a malformed id before reaching the database', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client.post(cancelPath('not-a-uuid')).loginAs(admin)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('rejects unauthenticated access', async ({ assert, client }) => {
    const target = await pendingUserWithLink()

    const response = await client.post(cancelPath(target.id))

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    assert.equal((await User.findOrFail(target.id)).accessStatus, 'PENDING')
    assert.equal(await tokensOf(target.id), 1)
  })

  // Authorization runs before the id is validated or the target read, so the denial is the same
  // body whether the id names a pending user, nobody, or is not an id at all (FR-009).
  test('denies the command to every role but an organization admin, whatever the target', async ({
    assert,
    client,
  }) => {
    const target = await pendingUserWithLink()

    for (const role of ['OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const viewer = await UserFactory.apply('active').merge({ role }).create()
      const bodies: unknown[] = []

      for (const id of [target.id, '00000000-0000-4000-8000-999999999999', 'not-a-uuid']) {
        const response = await client
          .post(cancelPath(id))
          .json({ comment: 'x'.repeat(2000) })
          .loginAs(viewer)

        response.assertStatus(403)
        bodies.push(response.body())
      }

      assert.equal((bodies[0] as { error: { code: string } }).error.code, 'E_AUTHORIZATION_FAILURE')
      assert.deepEqual(bodies[1], bodies[0])
      assert.deepEqual(bodies[2], bodies[0])
    }

    assert.equal((await User.findOrFail(target.id)).accessStatus, 'PENDING')
    assert.equal(await tokensOf(target.id), 1)
  })

  // Per the contract: a non-active user holds no session at all (GH-3), so the refusal arrives as
  // an unauthenticated one rather than an authorization failure.
  test('denies the command to an organization admin whose access is not active', async ({
    assert,
    client,
  }) => {
    const viewer = await UserFactory.apply('deactivated')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const target = await pendingUserWithLink()

    const response = await client.post(cancelPath(target.id)).loginAs(viewer)

    response.assertStatus(401)
    assert.equal((await User.findOrFail(target.id)).accessStatus, 'PENDING')
    assert.equal(await tokensOf(target.id), 1)
  })

  test('refuses an unknown user as not found', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client
      .post(cancelPath('00000000-0000-4000-8000-999999999999'))
      .loginAs(admin)

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_USER_NOT_FOUND')
  })

  test('refuses a user who is not pending with a code naming their status', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()

    for (const [state, code] of [
      ['active', 'E_USER_ALREADY_ACTIVATED'],
      ['deactivated', 'E_USER_ALREADY_DEACTIVATED'],
      ['cancelled', 'E_USER_CANCELLED_INVITATION'],
    ] as const) {
      const target = await UserFactory.apply(state).create()
      const before = await User.findOrFail(target.id)

      const response = await client
        .post(cancelPath(target.id))
        .json({ comment: 'Should not be stored.' })
        .loginAs(admin)

      response.assertStatus(409)
      assert.equal(response.body().error.code, code)
      const after = await User.findOrFail(target.id)
      assert.equal(after.accessStatus, before.accessStatus)
      assert.equal(after.cancelledByUserId, before.cancelledByUserId)
      assert.isNull(after.cancellationComment)
    }
  })

  test('refuses the requester own access as already activated', async ({ assert, client }) => {
    const admin = await organizationAdmin()

    const response = await client.post(cancelPath(admin.id)).loginAs(admin)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_USER_ALREADY_ACTIVATED')
    assert.equal((await User.findOrFail(admin.id)).accessStatus, 'ACTIVE')
  })

  test('resolves two concurrent cancellations to exactly one', async ({ assert, client }) => {
    const first = await organizationAdmin()
    const second = await organizationAdmin()
    const target = await pendingUserWithLink()

    const responses = await Promise.all([
      client.post(cancelPath(target.id)).json({ comment: 'From the first.' }).loginAs(first),
      client.post(cancelPath(target.id)).json({ comment: 'From the second.' }).loginAs(second),
    ])

    const statuses = responses.map((response) => response.status()).sort()
    assert.deepEqual(statuses, [200, 409])
    const [winner, loser] = responses[0].status() === 200 ? responses : [...responses].reverse()
    assert.equal(loser.body().error.code, 'E_USER_CANCELLED_INVITATION')

    // The stored event is the winner's, comment included.
    const stored = await User.findOrFail(target.id)
    assert.equal(stored.cancelledByUserId, winner.body().data.cancelledBy.id)
    assert.equal(stored.cancellationComment, winner.body().data.cancellationComment)
    assert.equal(await tokensOf(target.id), 0)
  })

  test('keeps the cancelled user out of the operations admin collection', async ({
    assert,
    client,
  }) => {
    const admin = await organizationAdmin()
    const operationsAdmin = await UserFactory.apply('active')
      .merge({ role: 'OPERATIONS_ADMIN' })
      .create()
    const target = await pendingUserWithLink()

    await client.post(cancelPath(target.id)).loginAs(admin)

    const response = await client.get('/api/v1/users').loginAs(operationsAdmin)

    response.assertStatus(200)
    const ids = (response.body().data as Array<{ id: string }>).map((user) => user.id)
    assert.notInclude(ids, target.id)
    assert.equal((await User.findOrFail(target.id)).accessStatus, 'CANCELLED')
  })
})
