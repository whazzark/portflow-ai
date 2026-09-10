import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import DeactivateUserUseCase from '#users/deactivate/deactivate_user_use_case'
import {
  SelfDeactivationException,
  UserAlreadyDeactivatedException,
  UserCancelledInvitationException,
  UserNotFoundException,
  UserPendingInvitationException,
} from '#users/shared/user_exceptions'

/**
 * Exercised against the real repository rather than a swapped fake, following
 * `tests/unit/auth/renew_password_use_case.spec.ts`: what this command is *for* is the columns it
 * writes and the ones it leaves alone, and a fake would only replay whatever it was told to return.
 */
test.group('Deactivate user use case', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  const deactivate = async (id: string, actorId: string, at = DateTime.now()) => {
    const useCase = await app.container.make(DeactivateUserUseCase)

    return useCase.handle({ id, deactivatedByUserId: actorId, deactivatedAt: at })
  }

  test('records the deactivation with its date and its responsible administrator', async ({
    assert,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const target = await UserFactory.apply('active').create()
    const at = DateTime.now()

    const returned = await deactivate(target.id, admin.id, at)

    assert.equal(returned.accessStatus, 'DEACTIVATED')
    const deactivated = await User.findOrFail(target.id)
    assert.equal(deactivated.accessStatus, 'DEACTIVATED')
    assert.equal(deactivated.deactivatedByUserId, admin.id)
    // Compared at second precision: PostgreSQL stores these timestamps truncated to the second
    // while SQLite keeps the fraction, so only the whole seconds are comparable across dialects.
    assert.equal(
      Math.floor(deactivated.deactivatedAt?.toSeconds() ?? 0),
      Math.floor(at.toSeconds()),
    )
  })

  test('keeps identity, email, role, and every other lifecycle event unchanged', async ({
    assert,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const target = await UserFactory.apply('active').create()
    // Read back rather than reused from memory: both dialects store these timestamps at second
    // precision, so an in-memory `DateTime` carries milliseconds the row never had.
    const before = await User.findOrFail(target.id)

    await deactivate(target.id, admin.id)

    const after = await User.findOrFail(target.id)
    assert.equal(after.id, before.id)
    assert.equal(after.email, before.email)
    assert.equal(after.firstName, before.firstName)
    assert.equal(after.lastName, before.lastName)
    assert.equal(after.role, before.role)
    assert.equal(after.password, before.password)
    for (const timestamp of ['invitedAt', 'activatedAt', 'cancelledAt', 'reactivatedAt'] as const) {
      assert.deepEqual(after[timestamp]?.toISO() ?? null, before[timestamp]?.toISO() ?? null)
    }
  })

  test('leaves the password renewal requirement exactly as it found it', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const owing = await UserFactory.apply('passwordRenewalRequired').create()
    const notOwing = await UserFactory.apply('active').create()

    await deactivate(owing.id, admin.id)
    await deactivate(notOwing.id, admin.id)

    assert.isNotNull((await User.findOrFail(owing.id)).passwordRenewalRequiredAt)
    assert.isNull((await User.findOrFail(notOwing.id)).passwordRenewalRequiredAt)
  })

  test('refuses an administrator deactivating their own access', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    await assert.rejects(() => deactivate(admin.id, admin.id), SelfDeactivationException.message)

    const unchanged = await User.findOrFail(admin.id)
    assert.equal(unchanged.accessStatus, 'ACTIVE')
    assert.isNull(unchanged.deactivatedAt)
    assert.isNull(unchanged.deactivatedByUserId)
  })

  // PostgreSQL matches an upper-cased identifier against the canonical lower-case `uuid` it stores,
  // so a case-sensitive guard would refuse nothing and the administrator would retire their own
  // access. SQLite compares the same identifier as text and finds no row, which is why this asserts
  // the exception rather than the surviving row: both dialects agree only on the refusal.
  test('refuses a self-deactivation spelled with an upper-case identifier', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    await assert.rejects(
      () => deactivate(admin.id.toUpperCase(), admin.id),
      SelfDeactivationException.message,
    )
  })

  test('names the reason a target that is not active cannot be deactivated', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    for (const [state, exception] of [
      ['invited', UserPendingInvitationException],
      ['cancelled', UserCancelledInvitationException],
      ['deactivated', UserAlreadyDeactivatedException],
    ] as const) {
      const target = await UserFactory.apply(state).create()
      const before = await User.findOrFail(target.id)

      await assert.rejects(() => deactivate(target.id, admin.id), exception.message)

      const after = await User.findOrFail(target.id)
      assert.equal(after.accessStatus, before.accessStatus)
      assert.deepEqual(after.deactivatedAt?.toISO() ?? null, before.deactivatedAt?.toISO() ?? null)
      assert.equal(after.deactivatedByUserId, before.deactivatedByUserId)
    }
  })

  test('refuses an identifier that matches no user', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    await assert.rejects(
      () => deactivate('00000000-0000-4000-8000-999999999999', admin.id),
      UserNotFoundException.message,
    )
  })

  test('keeps the first deactivation date and administrator when a second attempt arrives', async ({
    assert,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const other = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const target = await UserFactory.apply('active').create()

    await deactivate(target.id, admin.id)
    await assert.rejects(
      () => deactivate(target.id, other.id),
      UserAlreadyDeactivatedException.message,
    )

    assert.equal((await User.findOrFail(target.id)).deactivatedByUserId, admin.id)
  })
})
