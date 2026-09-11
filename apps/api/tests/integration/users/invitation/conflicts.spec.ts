import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import UserActivationToken from '#models/user_activation_token'

const anInvitation = {
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'claire.martin@portflow.test',
  role: 'OPERATIONS_LEAD',
}

const STATES = [
  ['invited', 'PENDING'],
  ['active', 'ACTIVE'],
  ['deactivated', 'DEACTIVATED'],
  ['cancelled', 'CANCELLED'],
] as const

test.group('POST /api/v1/users conflicts', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('refuses an email already held and names its access status', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    for (const [state, accessStatus] of STATES) {
      const holder = await UserFactory.apply(state)
        .merge({ email: `held-${state}@portflow.test` })
        .create()

      const response = await client
        .post('/api/v1/users')
        .json({ ...anInvitation, email: holder.email })
        .loginAs(admin)

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_USER_EMAIL_CONFLICT')
      assert.deepEqual(response.body().error.meta, { accessStatus })

      const users = await User.query().whereRaw('LOWER(email) = ?', [holder.email.toLowerCase()])
      assert.lengthOf(users, 1)
      assert.equal(users[0].accessStatus, holder.accessStatus)
      assert.equal(users[0].role, holder.role)
      assert.equal(users[0].firstName, holder.firstName)
      assert.lengthOf(await UserActivationToken.query().where('userId', holder.id), 0)
    }
  })

  test('recognizes a padded, differently cased email as the same person', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const holder = await UserFactory.apply('invited')
      .merge({ email: 'held.case@portflow.test' })
      .create()

    const response = await client
      .post('/api/v1/users')
      .json({ ...anInvitation, email: '  HELD.CASE@Portflow.test  ' })
      .loginAs(admin)

    response.assertStatus(409)
    assert.deepEqual(response.body().error.meta, { accessStatus: 'PENDING' })
    assert.lengthOf(await User.query().whereRaw('LOWER(email) = ?', [holder.email]), 1)
  })

  test('never exposes an activation link in a refusal', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    await UserFactory.apply('invited').merge({ email: anInvitation.email }).create()

    const response = await client.post('/api/v1/users').json(anInvitation).loginAs(admin)

    response.assertStatus(409)
    assert.notInclude(JSON.stringify(response.body()), 'activate')
  })

  test('creates at most one pending user when the same email is invited twice', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    const first = await client.post('/api/v1/users').json(anInvitation).loginAs(admin)
    const second = await client.post('/api/v1/users').json(anInvitation).loginAs(admin)

    assert.deepEqual(
      [first.status(), second.status()].sort(),
      [201, 409],
      'exactly one invitation is granted',
    )

    const users = await User.query().whereRaw('LOWER(email) = ?', [anInvitation.email])
    assert.lengthOf(users, 1)
    assert.lengthOf(await UserActivationToken.query().where('userId', users[0].id), 1)
  })
})
