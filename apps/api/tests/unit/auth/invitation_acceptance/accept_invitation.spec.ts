import app from '@adonisjs/core/services/app'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import AcceptInvitationUseCase from '#auth/invitation_acceptance/accept_invitation_use_case'
import PreviewInvitationUseCase from '#auth/invitation_acceptance/preview_invitation_use_case'
import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'

import { issueActivationLink } from '../../../support/activation_links.ts'

const PASSWORD = 'correct-horse-battery-staple'

test.group('Invitation acceptance use cases', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('previews the pending user a usable link opens', async ({ assert }) => {
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)

    const previewInvitationUseCase = await app.container.make(PreviewInvitationUseCase)
    const previewed = await previewInvitationUseCase.handle({ token, now: DateTime.now() })

    assert.equal(previewed.id, pending.id)
  })

  test('activates the pending user with the chosen password at the acceptance time', async ({
    assert,
  }) => {
    const pending = await UserFactory.apply('invited').create()
    const { token } = await issueActivationLink(pending)
    const acceptedAt = DateTime.now().startOf('second')

    const acceptInvitationUseCase = await app.container.make(AcceptInvitationUseCase)
    const activated = await acceptInvitationUseCase.handle({
      token,
      password: PASSWORD,
      signedInUserId: null,
      acceptedAt,
    })

    assert.equal(activated.id, pending.id)
    assert.equal(activated.accessStatus, 'ACTIVE')

    const stored = await User.findOrFail(pending.id)
    assert.isTrue(await hash.verify(stored.password ?? '', PASSWORD))
    assert.equal(stored.activatedAt?.toSeconds(), acceptedAt.toSeconds())
    assert.equal(stored.activatedByUserId, pending.id)
  })
})
