import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserActivationTokenFactory } from '#database/factories/user_activation_token_factory'
import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import CancelUserInvitationUseCase from '#users/cancel_invitation/cancel_user_invitation_use_case'
import {
  UserAlreadyActivatedException,
  UserAlreadyDeactivatedException,
  UserCancelledInvitationException,
  UserNotFoundException,
} from '#users/shared/user_exceptions'

/**
 * Exercised against the real repository rather than a swapped fake, following
 * `tests/unit/users/deactivation/deactivate.spec.ts`: what this command is *for* is the columns it
 * writes and the ones it leaves alone, and a fake would only replay whatever it was told to return.
 */
test.group('Cancel user invitation use case', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  const organizationAdmin = () =>
    UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

  const cancel = async (
    id: string,
    actorId: string,
    comment?: string | null,
    at = DateTime.now(),
  ) => {
    const useCase = await app.container.make(CancelUserInvitationUseCase)

    return useCase.handle({ id, cancelledByUserId: actorId, cancelledAt: at, comment })
  }

  test('cancels a pending invitation on behalf of the requesting administrator', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('invited').create()
    await UserActivationTokenFactory.merge({ userId: target.id }).create()
    const at = DateTime.now()

    const returned = await cancel(target.id, admin.id, 'Hired elsewhere.', at)

    assert.equal(returned.id, target.id)
    assert.equal(returned.accessStatus, 'CANCELLED')
    const cancelled = await User.findOrFail(target.id)
    assert.equal(cancelled.cancelledByUserId, admin.id)
    assert.equal(cancelled.cancellationComment, 'Hired elsewhere.')
    assert.equal(Math.floor(cancelled.cancelledAt?.toSeconds() ?? 0), Math.floor(at.toSeconds()))
  })

  test('stores the comment without its surrounding spaces', async ({ assert }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('invited').create()

    await cancel(target.id, admin.id, '  Hired elsewhere.  ')

    assert.equal((await User.findOrFail(target.id)).cancellationComment, 'Hired elsewhere.')
  })

  test('stores no comment when none was written', async ({ assert }) => {
    const admin = await organizationAdmin()

    for (const comment of ['   ', '', null, undefined]) {
      const target = await UserFactory.apply('invited').create()

      await cancel(target.id, admin.id, comment)

      assert.isNull((await User.findOrFail(target.id)).cancellationComment)
    }
  })

  test('refuses an unknown user as not found', async ({ assert }) => {
    const admin = await organizationAdmin()

    await assert.rejects(
      () => cancel('00000000-0000-4000-8000-999999999999', admin.id),
      UserNotFoundException,
    )
  })

  test('refuses every user who is not pending with the exception naming their status', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()

    for (const [state, exception] of [
      ['active', UserAlreadyActivatedException],
      ['deactivated', UserAlreadyDeactivatedException],
      ['cancelled', UserCancelledInvitationException],
    ] as const) {
      const target = await UserFactory.apply(state).create()

      await assert.rejects(() => cancel(target.id, admin.id), exception)
    }
  })

  // The requester is active by definition, so their own access is refused like any other activated
  // user — no rule of its own is needed.
  test('refuses the requester own access as already activated', async ({ assert }) => {
    const admin = await organizationAdmin()

    await assert.rejects(() => cancel(admin.id, admin.id), UserAlreadyActivatedException)
    assert.equal((await User.findOrFail(admin.id)).accessStatus, 'ACTIVE')
  })
})
