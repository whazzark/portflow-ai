import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import AcceptInvitationUseCase from '#auth/invitation_acceptance/accept_invitation_use_case'
import { InvitationAcceptanceSessionOpenException } from '#auth/invitation_acceptance/invitation_acceptance_exceptions'
import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'

import { issueActivationLink } from '../../../support/activation_links.ts'

const PASSWORD = 'correct-horse-battery-staple'

test.group('Invitation acceptance use case with a session open', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('refuses before touching a usable link', async ({ assert }) => {
    const admin = await UserFactory.apply('active').create()
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)

    const acceptInvitationUseCase = await app.container.make(AcceptInvitationUseCase)

    await assert.rejects(
      () =>
        acceptInvitationUseCase.handle({
          token,
          password: PASSWORD,
          signedInUserId: admin.id,
          acceptedAt: DateTime.now(),
        }),
      InvitationAcceptanceSessionOpenException,
    )

    const untouched = await User.findOrFail(pending.id)
    assert.equal(untouched.accessStatus, 'PENDING')
    assert.lengthOf(await db.from('user_activation_tokens').where('user_id', pending.id), 1)
  })

  test('refuses an unusable link as a session problem, never as an unusable link', async ({
    assert,
  }) => {
    const admin = await UserFactory.apply('active').create()

    const acceptInvitationUseCase = await app.container.make(AcceptInvitationUseCase)

    await assert.rejects(
      () =>
        acceptInvitationUseCase.handle({
          token: 'a-link-nobody-ever-issued',
          password: PASSWORD,
          signedInUserId: admin.id,
          acceptedAt: DateTime.now(),
        }),
      InvitationAcceptanceSessionOpenException,
    )
  })
})
