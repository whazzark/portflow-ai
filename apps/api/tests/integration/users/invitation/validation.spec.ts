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

const REFUSED_PAYLOADS: Array<[string, Record<string, unknown>, string]> = [
  ['a missing first name', { ...anInvitation, firstName: undefined }, 'firstName'],
  ['a blank last name', { ...anInvitation, lastName: '   ' }, 'lastName'],
  ['a missing email', { ...anInvitation, email: undefined }, 'email'],
  ['a malformed email', { ...anInvitation, email: 'claire.martin' }, 'email'],
  ['an over-long first name', { ...anInvitation, firstName: 'a'.repeat(256) }, 'firstName'],
  ['a missing role', { ...anInvitation, role: undefined }, 'role'],
  ['an unknown role', { ...anInvitation, role: 'SUPER_ADMIN' }, 'role'],
]

test.group('POST /api/v1/users validation', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('refuses an invitation whose identity or role cannot be trusted', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    for (const [description, payload, field] of REFUSED_PAYLOADS) {
      const response = await client.post('/api/v1/users').json(payload).loginAs(admin)

      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_VALIDATION_ERROR', description)
      assert.include(
        (response.body().error.details as Array<{ field: string }>).map((detail) => detail.field),
        field,
        `${description} is reported on its own field`,
      )
    }

    assert.lengthOf(await User.query().whereRaw('LOWER(email) = ?', [anInvitation.email]), 0)
  })

  test('records the identity without its surrounding spaces', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    const response = await client
      .post('/api/v1/users')
      .json({
        firstName: '  Claire  ',
        lastName: '  Martin  ',
        email: '  Claire.Martin@portflow.test  ',
        role: 'OBSERVER',
      })
      .loginAs(admin)

    response.assertStatus(201)

    const { user } = response.body().data

    assert.equal(user.firstName, 'Claire')
    assert.equal(user.lastName, 'Martin')
    // The casing the administrator typed is preserved; only the comparison is case-insensitive.
    assert.equal(user.email, 'Claire.Martin@portflow.test')
  })
})
