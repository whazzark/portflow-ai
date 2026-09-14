import { createHash } from 'node:crypto'

import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import UserActivationToken from '#models/user_activation_token'
import env from '#start/env'
import { UserNotCancelledException } from '#users/restore_invitation/invitation_restoration_exceptions'
import RestoreUserInvitationUseCase from '#users/restore_invitation/restore_user_invitation_use_case'
import { UserNotFoundException } from '#users/shared/user_exceptions'

function organizationAdmin() {
  return UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
}

function cancelledUser() {
  return UserFactory.apply('cancelled').create()
}

async function restore(target: User, actor: User, comment?: string | null) {
  const useCase = await app.container.make(RestoreUserInvitationUseCase)

  return useCase.handle({
    id: target.id,
    restoredByUserId: actor.id,
    restoredAt: DateTime.now(),
    comment,
  })
}

/** The digest the database keeps of the secret a link carries. */
function digestOf(url: string) {
  const secret = url.split('/activate/')[1] ?? ''

  return createHash('sha256').update(secret).digest('hex')
}

test.group('RestoreUserInvitationUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('restores a cancelled invitation and hands out a new link, kept only as its digest', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const user = await cancelledUser()

    const { user: restored, activationLink } = await restore(user, admin)

    assert.equal(restored.id, user.id)
    assert.equal(restored.accessStatus, 'PENDING')
    assert.isTrue(activationLink.url.startsWith(`${env.get('WEB_ORIGIN')}/activate/`))

    const tokens = await UserActivationToken.query().where('userId', user.id)
    assert.lengthOf(tokens, 1)
    assert.equal(
      tokens[0].hash,
      digestOf(activationLink.url),
      'the stored digest is the new link’s',
    )
    assert.notInclude(tokens[0].hash, activationLink.url.split('/activate/')[1] ?? '')
  })

  test('issues the new link for 7 days from the restoration', async ({ assert }) => {
    const admin = await organizationAdmin()
    const user = await cancelledUser()
    const at = DateTime.now()

    const { activationLink } = await restore(user, admin)

    const days = activationLink.expiresAt.diff(at, 'days').days
    assert.closeTo(days, 7, 0.01)
  })

  test('records the restoring administrator against the event', async ({ assert }) => {
    const admin = await organizationAdmin()
    const user = await cancelledUser()

    await restore(user, admin, 'Start date confirmed.')

    const stored = await User.findOrFail(user.id)
    assert.equal(stored.invitationRestoredByUserId, admin.id)
    assert.isNotNull(stored.invitationRestoredAt)
    assert.equal(stored.invitationRestorationComment, 'Start date confirmed.')
  })

  test('stores the comment without its surrounding spaces, and a blank one as none', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()

    for (const [given, stored] of [
      ['  padded  ', 'padded'],
      ['   ', null],
      ['', null],
      [null, null],
      [undefined, null],
    ] as const) {
      const user = await cancelledUser()

      await restore(user, admin, given)

      assert.equal((await User.findOrFail(user.id)).invitationRestorationComment, stored)
    }
  })

  test('refuses an unknown user as not found', async ({ assert }) => {
    const admin = await organizationAdmin()
    const useCase = await app.container.make(RestoreUserInvitationUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: '00000000-0000-4000-8000-999999999999',
          restoredByUserId: admin.id,
          restoredAt: DateTime.now(),
        }),
      UserNotFoundException,
    )
  })

  test('refuses a user who is not cancelled, naming the status they hold', async ({ assert }) => {
    const admin = await organizationAdmin()

    for (const [state, accessStatus] of [
      ['invited', 'PENDING'],
      ['active', 'ACTIVE'],
      ['deactivated', 'DEACTIVATED'],
    ] as const) {
      const target = await UserFactory.apply(state).create()

      try {
        await restore(target, admin)
        assert.fail(`a ${accessStatus} user must not be restored`)
      } catch (error) {
        assert.instanceOf(error, UserNotCancelledException)
        assert.deepEqual((error as UserNotCancelledException).meta, { accessStatus })
      }

      assert.lengthOf(await UserActivationToken.query().where('userId', target.id), 0)
    }
  })

  test('refuses the requester’s own access, which is active and so not cancelled', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()

    try {
      await restore(admin, admin)
      assert.fail('an administrator must not restore their own access')
    } catch (error) {
      assert.instanceOf(error, UserNotCancelledException)
      assert.deepEqual((error as UserNotCancelledException).meta, { accessStatus: 'ACTIVE' })
    }
  })
})
