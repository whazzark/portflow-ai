import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'

const anInvitation = {
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'claire.martin@portflow.test',
  role: 'OPERATIONS_LEAD',
}

const assertNothingWasGranted = async (assert: { lengthOf: (a: unknown[], b: number) => void }) => {
  const invited = await User.query().whereRaw('LOWER(email) = ?', [anInvitation.email])

  assert.lengthOf(invited, 0)
}

test.group('POST /api/v1/users authorization', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated invitation', async ({ assert, client }) => {
    const response = await client.post('/api/v1/users').json(anInvitation)

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    await assertNothingWasGranted(assert)
  })

  test('denies invitation to every role but organization admin', async ({ assert, client }) => {
    for (const role of ['OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const viewer = await UserFactory.apply('active').merge({ role }).create()

      const response = await client.post('/api/v1/users').json(anInvitation).loginAs(viewer)

      response.assertStatus(403)
      assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
      await assertNothingWasGranted(assert)
    }
  })

  // A non-active user holds no session at all (GH-3), so the refusal arrives as an unauthenticated
  // one rather than an authorization failure.
  test('denies invitation to a viewer whose access is not active', async ({ assert, client }) => {
    const deactivated = await UserFactory.apply('deactivated')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()

    const response = await client.post('/api/v1/users').json(anInvitation).loginAs(deactivated)

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    await assertNothingWasGranted(assert)
  })

  // Authorization runs before validation: a viewer who may not invite learns nothing about the
  // payload the endpoint expects.
  test('refuses an unauthorized viewer before validating their payload', async ({
    assert,
    client,
  }) => {
    const viewer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client.post('/api/v1/users').json({}).loginAs(viewer)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('lets an organization admin invite any of the four roles', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    for (const role of [
      'ORGANIZATION_ADMIN',
      'OPERATIONS_ADMIN',
      'OPERATIONS_LEAD',
      'OBSERVER',
    ] as const) {
      const response = await client
        .post('/api/v1/users')
        .json({ ...anInvitation, email: `${role.toLowerCase()}@portflow.test`, role })
        .loginAs(admin)

      response.assertStatus(201)
      assert.equal(response.body().data.user.role, role)
    }
  })
})
