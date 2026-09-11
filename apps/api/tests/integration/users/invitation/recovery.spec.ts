import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import type { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import UserActivationToken from '#models/user_activation_token'
import ActivationLinkIssuer from '#users/shared/activation_link_issuer'

const anInvitation = {
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'claire.martin@portflow.test',
  role: 'OPERATIONS_LEAD',
}

test.group('POST /api/v1/users recovery', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(ActivationLinkIssuer))

  /**
   * The token row is the second statement of the write. Making it fail is what proves the first one
   * does not survive alone: an invitation either grants an access with its link, or grants nothing.
   */
  test('leaves neither a user nor a link when the write fails', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    app.container.swap(
      ActivationLinkIssuer,
      () =>
        ({
          issue: () => ({
            url: 'http://localhost:3000/activate/never-handed-out',
            hash: 'a-digest',
            // Refused by the table: the insert fails inside the transaction.
            expiresAt: null as unknown as DateTime,
          }),
        }) as unknown as ActivationLinkIssuer,
    )

    const response = await client.post('/api/v1/users').json(anInvitation).loginAs(admin)

    assert.isAbove(response.status(), 399)
    assert.lengthOf(await User.query().whereRaw('LOWER(email) = ?', [anInvitation.email]), 0)
    assert.lengthOf(await UserActivationToken.query().where('hash', 'a-digest'), 0)
  })

  test('grants exactly one access when the invitation is retried after a failure', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    app.container.swap(
      ActivationLinkIssuer,
      () =>
        ({
          issue: () => ({
            url: 'http://localhost:3000/activate/never-handed-out',
            hash: 'a-digest',
            expiresAt: null as unknown as DateTime,
          }),
        }) as unknown as ActivationLinkIssuer,
    )

    await client.post('/api/v1/users').json(anInvitation).loginAs(admin)

    app.container.restore(ActivationLinkIssuer)
    const retry = await client.post('/api/v1/users').json(anInvitation).loginAs(admin)

    retry.assertStatus(201)

    const users = await User.query().whereRaw('LOWER(email) = ?', [anInvitation.email])

    assert.lengthOf(users, 1)
    assert.lengthOf(await UserActivationToken.query().where('userId', users[0].id), 1)
  })
})
