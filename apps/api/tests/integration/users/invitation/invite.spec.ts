import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import UserActivationToken from '#models/user_activation_token'

const anInvitation = {
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'claire.martin@portflow.test',
  role: 'OPERATIONS_LEAD',
}

const anOrganizationAdmin = () =>
  UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

test.group('POST /api/v1/users', (group) => {
  // Each test invites the same email, which is exactly the collision the endpoint refuses: the
  // rollback is what keeps one test's pending user out of the next test's organization.
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('creates a pending user and returns its activation link once', async ({
    assert,
    client,
  }) => {
    const admin = await anOrganizationAdmin()

    const response = await client.post('/api/v1/users').json(anInvitation).loginAs(admin)

    response.assertStatus(201)

    const { user, activationLink } = response.body().data

    assert.equal(user.firstName, 'Claire')
    assert.equal(user.lastName, 'Martin')
    assert.equal(user.email, 'claire.martin@portflow.test')
    assert.equal(user.role, 'OPERATIONS_LEAD')
    assert.equal(user.accessStatus, 'PENDING')
    assert.isNotNull(user.invitedAt)
    assert.equal(user.invitedBy.id, admin.id)
    assert.isNull(user.activatedAt)
    assert.isNull(user.cancelledAt)
    // Present and null, not absent: the projection an organization admin receives carries the
    // cancellation comment key on every user, the one just invited included.
    assert.isNull(user.cancellationComment)
    assert.isNull(user.deactivatedAt)
    assert.isNull(user.reactivatedAt)
    assert.isNull(user.passwordResetAt)
    assert.isUndefined(user.password)

    assert.isTrue(activationLink.url.includes('/activate/'))
    assert.approximately(
      DateTime.fromISO(activationLink.expiresAt).diff(DateTime.now(), 'hours').hours,
      24 * 7,
      1,
    )
  })

  test('persists exactly one activation token, as a digest', async ({ assert, client }) => {
    const admin = await anOrganizationAdmin()

    const response = await client.post('/api/v1/users').json(anInvitation).loginAs(admin)

    const { user, activationLink } = response.body().data
    const tokens = await UserActivationToken.query().where('userId', user.id)
    const secret = activationLink.url.slice(activationLink.url.lastIndexOf('/') + 1)

    assert.lengthOf(tokens, 1)
    assert.notEqual(tokens[0].hash, secret)
    assert.isTrue(DateTime.isDateTime(tokens[0].expiresAt))
  })

  test('never exposes the activation link through the user collection', async ({
    assert,
    client,
  }) => {
    const admin = await anOrganizationAdmin()
    const invitation = await client.post('/api/v1/users').json(anInvitation).loginAs(admin)
    const { user, activationLink } = invitation.body().data
    const secret = activationLink.url.slice(activationLink.url.lastIndexOf('/') + 1)

    const collection = await client.get('/api/v1/users').loginAs(admin)

    collection.assertStatus(200)

    const payload = JSON.stringify(collection.body())
    const invited = collection.body().data.find((entry: { id: string }) => entry.id === user.id)

    assert.isDefined(invited, 'the pending user is listed')
    assert.equal(invited.accessStatus, 'PENDING')
    assert.notInclude(payload, secret)
    assert.notInclude(payload, 'activationLink')
    // On the key rather than a `'password'` substring, which `passwordRenewalRequired` and the
    // password reset event (`#17`) would trip without carrying any secret.
    assert.notProperty(invited, 'password')
  })
})
