import { SessionGuard } from '@adonisjs/auth/session'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import LucidUserRepository from '#users/shared/repositories/lucid_user_repository'

import { issueActivationLink } from '../../../support/activation_links.ts'

const ACCEPT_PATH = '/api/v1/auth/invitation-acceptance'
const PASSWORD = 'correct-horse-battery-staple'

const tokenRowsOf = async (userId: string) =>
  (await db.from('user_activation_tokens').where('user_id', userId)).length

test.group('Invitation acceptance recovery', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('records exactly one acceptance when the same link is submitted twice at once', async ({
    assert,
    client,
  }) => {
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)

    const [first, second] = await Promise.all([
      client.post(ACCEPT_PATH).json({ token, password: PASSWORD, passwordConfirmation: PASSWORD }),
      client
        .post(ACCEPT_PATH)
        .json({ token, password: `${PASSWORD}-other`, passwordConfirmation: `${PASSWORD}-other` }),
    ])

    assert.deepEqual([first.status(), second.status()].sort(), [200, 404])

    const activated = await User.findOrFail(pending.id)
    assert.equal(activated.accessStatus, 'ACTIVE')
    assert.isNotNull(activated.activatedAt)
    // One password recorded, the winner's — never a mix, never both.
    const verifies = [
      await hash.verify(activated.password ?? '', PASSWORD),
      await hash.verify(activated.password ?? '', `${PASSWORD}-other`),
    ]
    assert.deepEqual(verifies.filter(Boolean), [true])
    assert.equal(await tokenRowsOf(pending.id), 0)
  })

  test('leaves the invitation untouched and retryable after a transient failure', async ({
    assert,
    client,
  }) => {
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)
    const original = LucidUserRepository.prototype.acceptInvitation

    try {
      LucidUserRepository.prototype.acceptInvitation = function failing() {
        return Promise.reject(new Error('The database went away'))
      }

      const failed = await client
        .post(ACCEPT_PATH)
        .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })

      failed.assertStatus(500)
      failed.assertSessionMissing('auth_web')
    } finally {
      LucidUserRepository.prototype.acceptInvitation = original
    }

    const untouched = await User.findOrFail(pending.id)
    assert.equal(untouched.accessStatus, 'PENDING')
    assert.isNull(untouched.password)
    assert.equal(await tokenRowsOf(pending.id), 1)

    const retried = await client
      .post(ACCEPT_PATH)
      .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })

    retried.assertStatus(200)
    retried.assertSession('auth_web', pending.id)
  })

  test('says the access is active when the session could not be opened after activating', async ({
    assert,
    client,
  }) => {
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)
    const original = SessionGuard.prototype.login

    try {
      SessionGuard.prototype.login = function failing() {
        return Promise.reject(new Error('The session store went away'))
      }

      const response = await client
        .post(ACCEPT_PATH)
        .json({ token, password: PASSWORD, passwordConfirmation: PASSWORD })

      response.assertStatus(500)
      assert.deepEqual(response.body(), {
        error: {
          code: 'E_INVITATION_ACCEPTED_SESSION_NOT_OPENED',
          message: 'Your access is active. Log in with your new password',
        },
      })
      response.assertSessionMissing('auth_web')
    } finally {
      SessionGuard.prototype.login = original
    }

    const activated = await User.findOrFail(pending.id)
    assert.equal(activated.accessStatus, 'ACTIVE')
    assert.equal(await tokenRowsOf(pending.id), 0)

    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: pending.email, password: PASSWORD })

    login.assertStatus(200)
  })
})
