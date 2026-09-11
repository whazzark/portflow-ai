import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import { digestActivationSecret } from '#users/shared/activation_link_issuer'

import { issueActivationLink } from '../../../support/activation_links.ts'

const PREVIEW_PATH = '/api/v1/auth/invitation-acceptance/preview'
const ACCEPT_PATH = '/api/v1/auth/invitation-acceptance'
const PASSWORD = 'correct-horse-battery-staple'

const UNUSABLE_BODY = {
  error: { code: 'E_ACTIVATION_LINK_UNUSABLE', message: 'This activation link cannot be used' },
}

type Scenario = {
  /** The token presented, and the user the link would have opened, if any. */
  arrange: (client: ApiClient) => Promise<{ token: string; user?: User }>
}

/**
 * Every reason a link can be unusable. Each must meet the byte-identical refusal on both endpoints,
 * disclose nobody, and change nothing (FR-010, FR-012).
 */
const SCENARIOS: Record<string, Scenario> = {
  'never issued': {
    arrange: async () => ({ token: 'a-link-nobody-ever-issued' }),
  },
  'malformed: too short': {
    arrange: async () => ({ token: 'nope' }),
  },
  'malformed: far too long': {
    arrange: async () => ({ token: 'x'.repeat(2000) }),
  },
  'malformed: not base64url': {
    arrange: async () => ({ token: 'ça ne ressemble à rien / ? # %' }),
  },
  expired: {
    arrange: async () => {
      const user = await UserFactory.apply('invited').create()
      const { token } = await issueActivationLink(user, { expired: true })

      return { token, user }
    },
  },
  'already used': {
    arrange: async (client) => {
      const user = await UserFactory.apply('invited').create()
      const { token } = await issueActivationLink(user)
      const accepted = await client
        .post(ACCEPT_PATH)
        .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })
      accepted.assertStatus(200)

      return { token, user: await User.findOrFail(user.id) }
    },
  },
  'replaced by a newer link': {
    arrange: async () => {
      const user = await UserFactory.apply('invited').create()
      const { token } = await issueActivationLink(user)
      await db
        .from('user_activation_tokens')
        .where('user_id', user.id)
        .update({ hash: digestActivationSecret('the-renewed-secret') })

      return { token, user }
    },
  },
  ...Object.fromEntries(
    (['active', 'cancelled', 'deactivated'] as const).map((state) => [
      `belonging to a ${state} user`,
      {
        arrange: async () => {
          const user = await UserFactory.apply(state).create()
          const { token } = await issueActivationLink(user)

          return { token, user }
        },
      },
    ]),
  ),
}

test.group('Invitation acceptance with an unusable link', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  for (const [reason, scenario] of Object.entries(SCENARIOS)) {
    test(`refuses a link ${reason} identically on both endpoints, changing nothing`, async ({
      assert,
      client,
    }) => {
      const { token, user } = await scenario.arrange(client)
      const before = user ? await User.findOrFail(user.id) : null
      const tokenRowsBefore = user
        ? (await db.from('user_activation_tokens').where('user_id', user.id)).length
        : 0

      const preview = await client.post(PREVIEW_PATH).json({ token })
      const accept = await client
        .post(ACCEPT_PATH)
        .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })

      for (const response of [preview, accept]) {
        response.assertStatus(404)
        assert.deepEqual(response.body(), UNUSABLE_BODY)
      }
      accept.assertSessionMissing('auth_web')

      if (user && before) {
        const serialized = JSON.stringify([preview.body(), accept.body()])
        assert.notInclude(serialized, before.email)
        assert.notInclude(serialized, before.firstName)

        const after = await User.findOrFail(user.id)
        assert.equal(after.accessStatus, before.accessStatus)
        assert.equal(after.password, before.password)
        assert.equal(after.activatedAt?.toSeconds(), before.activatedAt?.toSeconds())
        // A link that existed still exists — an expired one stays renewable (FR-013).
        assert.lengthOf(
          await db.from('user_activation_tokens').where('user_id', user.id),
          tokenRowsBefore,
        )
      }
    })
  }

  test('answers a missing or empty token as a validation error, which names no user', async ({
    assert,
    client,
  }) => {
    // Only a broken client sends these — `/activate/` without a token matches no web route — and
    // the bodyparser turns an empty string into `null`. The refusal is about the request, not about
    // any link, so it discloses nothing the uniform refusal protects.
    for (const body of [{}, { token: '' }]) {
      const response = await client.post(PREVIEW_PATH).json(body)

      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
      assert.equal(response.body().error.details[0].field, 'token')
    }
  })

  test('refuses a link that expired between the preview and the submission', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(user)

    const preview = await client.post(PREVIEW_PATH).json({ token })
    preview.assertStatus(200)

    await db
      .from('user_activation_tokens')
      .where('user_id', user.id)
      .update({ expires_at: '2000-01-01 00:00:00' })

    const accept = await client
      .post(ACCEPT_PATH)
      .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })

    accept.assertStatus(404)
    assert.deepEqual(accept.body(), UNUSABLE_BODY)

    const untouched = await User.findOrFail(user.id)
    assert.equal(untouched.accessStatus, 'PENDING')
    assert.isNull(untouched.password)
  })
})
