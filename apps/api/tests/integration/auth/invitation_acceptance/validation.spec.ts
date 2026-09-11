import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'

import { issueActivationLink } from '../../../support/activation_links.ts'

const ACCEPT_PATH = '/api/v1/auth/invitation-acceptance'
const PASSWORD = 'correct-horse-battery-staple'

test.group('Invitation acceptance password rule', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  const refusals = [
    { reason: 'empty', password: '', confirmation: '', field: 'password' },
    {
      reason: '11 characters',
      password: 'a'.repeat(11),
      confirmation: 'a'.repeat(11),
      field: 'password',
    },
    {
      reason: '129 characters',
      password: 'a'.repeat(129),
      confirmation: 'a'.repeat(129),
      field: 'password',
    },
    {
      reason: 'a mismatched confirmation',
      password: PASSWORD,
      confirmation: `${PASSWORD}-typo`,
      field: 'passwordConfirmation',
    },
  ]

  for (const { reason, password, confirmation, field } of refusals) {
    test(`refuses ${reason} on ${field}, keeping the user pending and the link usable`, async ({
      assert,
      client,
    }) => {
      const pending = await UserFactory.apply('invited').create()
      const { token } = await issueActivationLink(pending)

      const refused = await client
        .post(ACCEPT_PATH)
        .json({ token, password, passwordConfirmation: confirmation })

      refused.assertStatus(422)
      assert.equal(refused.body().error.code, 'E_VALIDATION_ERROR')
      assert.include(
        refused.body().error.details.map((detail: { field: string }) => detail.field),
        field,
      )

      const untouched = await User.findOrFail(pending.id)
      assert.equal(untouched.accessStatus, 'PENDING')
      assert.isNull(untouched.password)
      assert.lengthOf(await db.from('user_activation_tokens').where('user_id', pending.id), 1)

      const corrected = await client
        .post(ACCEPT_PATH)
        .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })

      corrected.assertStatus(200)
    })
  }

  /**
   * FR-005 as amended: the bodyparser's default `trimWhitespaces` trims every JSON string before
   * any validator runs — at login, at password renewal, and here alike. Because every entry point
   * trims the same way, a padded password never locks its owner out.
   */
  test('trims surrounding spaces exactly as login does, so a padded password still logs in', async ({
    client,
  }) => {
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)
    const padded = `  ${PASSWORD}  `

    const accepted = await client
      .post(ACCEPT_PATH)
      .json({ token, password: padded, passwordConfirmation: padded })

    accepted.assertStatus(200)

    const withSpaces = await client
      .post('/api/v1/auth/login')
      .json({ email: pending.email, password: padded })
    const withoutSpaces = await client
      .post('/api/v1/auth/login')
      .json({ email: pending.email, password: PASSWORD })

    withSpaces.assertStatus(200)
    withoutSpaces.assertStatus(200)
  })
})
