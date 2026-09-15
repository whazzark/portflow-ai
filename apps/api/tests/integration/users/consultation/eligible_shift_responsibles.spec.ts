import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'

test.group('Eligible shift responsibles HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated and non-active requests', async ({ client }) => {
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()

    const unauthenticated = await client.get('/api/v1/users/eligible-shift-responsibles')
    const nonActive = await client.get('/api/v1/users/eligible-shift-responsibles').loginAs(pending)

    unauthenticated.assertStatus(401)
    nonActive.assertStatus(401)
  })

  test('rejects an observer', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client.get('/api/v1/users/eligible-shift-responsibles').loginAs(observer)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('lists active operations leads and admins for every preparing role', async ({
    assert,
    client,
  }) => {
    const lead = await UserFactory.apply('active')
      .merge({ role: 'OPERATIONS_LEAD', firstName: 'Léa', lastName: 'Martin' })
      .create()
    const operationsAdmin = await UserFactory.apply('active')
      .merge({ role: 'OPERATIONS_ADMIN', firstName: 'Thomas', lastName: 'Bernard' })
      .create()
    const organizationAdmin = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN', firstName: 'Claire', lastName: 'Bernard' })
      .create()
    const ineligible = [
      await UserFactory.apply('active').merge({ role: 'OBSERVER', lastName: 'Aaron' }).create(),
      await UserFactory.apply('deactivated').merge({ role: 'OPERATIONS_LEAD' }).create(),
      await UserFactory.apply('invited').merge({ role: 'OPERATIONS_LEAD' }).create(),
      await UserFactory.apply('cancelled').merge({ role: 'OPERATIONS_LEAD' }).create(),
    ]
    const arranged = new Set(
      [lead, operationsAdmin, organizationAdmin, ...ineligible].map((user) => user.id),
    )

    for (const actor of [lead, operationsAdmin, organizationAdmin]) {
      const response = await client.get('/api/v1/users/eligible-shift-responsibles').loginAs(actor)

      response.assertStatus(200)
      // Only the users arranged here are compared, so users other suites left behind do not matter.
      const listed = response.body().data.filter((user: { id: string }) => arranged.has(user.id))
      assert.deepEqual(listed, [
        { id: organizationAdmin.id, firstName: 'Claire', lastName: 'Bernard' },
        { id: operationsAdmin.id, firstName: 'Thomas', lastName: 'Bernard' },
        { id: lead.id, firstName: 'Léa', lastName: 'Martin' },
      ])
    }
  })
})
