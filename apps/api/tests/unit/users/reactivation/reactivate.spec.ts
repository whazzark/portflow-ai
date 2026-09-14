import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import ReactivateUserUseCase from '#users/reactivate/reactivate_user_use_case'
import {
  UserAlreadyActiveException,
  UserCancelledInvitationException,
  UserNotFoundException,
  UserPendingInvitationException,
} from '#users/shared/user_exceptions'

/**
 * Exercised against the real repository rather than a swapped fake, following
 * `tests/unit/users/deactivation/deactivate.spec.ts`: what this command is *for* is the columns it
 * writes and the ones it leaves alone, and a fake would only replay whatever it was told to return.
 */
test.group('Reactivate user use case', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  const reactivate = async (id: string, actorId: string, at = DateTime.now()) => {
    const useCase = await app.container.make(ReactivateUserUseCase)

    return useCase.handle({ id, reactivatedByUserId: actorId, reactivatedAt: at })
  }

  const organizationAdmin = () =>
    UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

  /** The refusal itself, so a case can assert both what was thrown and what it tells the caller. */
  const refusalOf = async (attempt: () => Promise<unknown>) => {
    try {
      await attempt()
    } catch (error) {
      return error as Error
    }

    throw new Error('Expected the reactivation to be refused')
  }

  test('restores access, records the reactivation, and requires a new password', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('deactivated').create()
    const at = DateTime.now()

    const returned = await reactivate(target.id, admin.id, at)

    assert.equal(returned.accessStatus, 'ACTIVE')
    const reactivated = await User.findOrFail(target.id)
    assert.equal(reactivated.accessStatus, 'ACTIVE')
    assert.equal(reactivated.reactivatedByUserId, admin.id)
    // Compared at second precision: PostgreSQL stores these timestamps truncated to the second
    // while SQLite keeps the fraction, so only the whole seconds are comparable across dialects.
    assert.equal(reactivated.reactivatedAt?.toUnixInteger(), at.toUnixInteger())
    assert.isNotNull(reactivated.passwordRenewalRequiredAt)
  })

  test('changes nothing but the access status, the reactivation, and the requirement', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('deactivated')
      .merge({
        role: 'OPERATIONS_ADMIN',
        invitedAt: DateTime.now().minus({ months: 8 }),
        activatedAt: DateTime.now().minus({ months: 8 }),
      })
      .create()
    const before = await User.findOrFail(target.id)

    await reactivate(target.id, admin.id)

    const after = await User.findOrFail(target.id)
    assert.equal(after.email, before.email)
    assert.equal(after.role, 'OPERATIONS_ADMIN')
    assert.equal(after.firstName, before.firstName)
    assert.equal(after.lastName, before.lastName)
    assert.equal(after.password, before.password)
    assert.equal(after.invitedAt?.toISO(), before.invitedAt?.toISO())
    assert.equal(after.activatedAt?.toISO(), before.activatedAt?.toISO())
    // The deactivation this reverses is kept: it records an event that happened.
    assert.equal(after.deactivatedAt?.toISO(), before.deactivatedAt?.toISO())
    assert.equal(after.deactivatedByUserId, before.deactivatedByUserId)
  })

  test('leaves exactly one requirement on a user who already owed a renewal', async ({
    assert,
  }) => {
    const admin = await organizationAdmin()
    const resetter = await organizationAdmin()
    const resetAt = DateTime.now().minus({ days: 5 })
    // Reset, then deactivated before renewing: the requirement survived the deactivation.
    const target = await UserFactory.apply('deactivated')
      .merge({
        passwordRenewalRequiredAt: resetAt,
        passwordResetAt: resetAt,
        passwordResetByUserId: resetter.id,
      })
      .create()

    await reactivate(target.id, admin.id)

    const after = await User.findOrFail(target.id)
    assert.isNotNull(after.passwordRenewalRequiredAt)
    // The reset stays on record as its own event, correctly attributed.
    assert.equal(after.passwordResetAt?.toUnixInteger(), resetAt.toUnixInteger())
    assert.equal(after.passwordResetByUserId, resetter.id)
  })

  test('refuses a pending user, pointing to the activation link renewal', async ({ assert }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('invited').create()

    const error = await refusalOf(() => reactivate(target.id, admin.id))

    assert.instanceOf(error, UserPendingInvitationException)
    assert.match(error.message, /renew their activation link instead/)

    const after = await User.findOrFail(target.id)
    assert.equal(after.accessStatus, 'PENDING')
    assert.isNull(after.reactivatedAt)
    assert.isNull(after.passwordRenewalRequiredAt)
  })

  test('refuses a cancelled user, pointing to the invitation restoration', async ({ assert }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('cancelled').create()

    const error = await refusalOf(() => reactivate(target.id, admin.id))

    assert.instanceOf(error, UserCancelledInvitationException)
    assert.match(error.message, /restore the invitation instead/)

    assert.equal((await User.findOrFail(target.id)).accessStatus, 'CANCELLED')
  })

  test('refuses an active user as already active, and records nothing', async ({ assert }) => {
    const admin = await organizationAdmin()
    const target = await UserFactory.apply('active').create()

    await assert.rejects(() => reactivate(target.id, admin.id), UserAlreadyActiveException)

    const after = await User.findOrFail(target.id)
    assert.isNull(after.reactivatedAt)
    assert.isNull(after.reactivatedByUserId)
    assert.isNull(after.passwordRenewalRequiredAt)
  })

  test('refuses the administrator naming themselves as already active', async ({ assert }) => {
    const admin = await organizationAdmin()

    await assert.rejects(() => reactivate(admin.id, admin.id), UserAlreadyActiveException)

    assert.isNull((await User.findOrFail(admin.id)).passwordRenewalRequiredAt)
  })

  test('refuses an identifier naming no user', async ({ assert }) => {
    const admin = await organizationAdmin()

    await assert.rejects(
      () => reactivate('00000000-0000-4000-8000-999999999999', admin.id),
      UserNotFoundException,
    )
  })
})
