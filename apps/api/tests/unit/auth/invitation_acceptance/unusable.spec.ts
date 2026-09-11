import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import AcceptInvitationUseCase from '#auth/invitation_acceptance/accept_invitation_use_case'
import { ActivationLinkUnusableException } from '#auth/invitation_acceptance/invitation_acceptance_exceptions'
import { UserFactory } from '#database/factories/user_factory'
import UserRepository from '#users/shared/repositories/user_repository'

test.group('Invitation acceptance use case with a link lost in between', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(UserRepository))

  test('refuses as unusable when the write finds the link gone after the early check', async ({
    assert,
  }) => {
    const pending = await UserFactory.apply('invited').create()
    // The early read sees a usable link; the guarded write then loses it — to a concurrent
    // acceptance, or to an expiry reached while the password was being hashed.
    app.container.swap(
      UserRepository,
      () =>
        ({
          findPendingByActivationTokenHash: async () => pending,
          acceptInvitation: async () => ({ kind: 'UNUSABLE' }),
        }) as unknown as UserRepository,
    )

    const acceptInvitationUseCase = await app.container.make(AcceptInvitationUseCase)

    await assert.rejects(
      () =>
        acceptInvitationUseCase.handle({
          token: 'any',
          password: 'correct-horse-battery-staple',
          signedInUserId: null,
          acceptedAt: DateTime.now(),
        }),
      ActivationLinkUnusableException,
    )
  })
})
