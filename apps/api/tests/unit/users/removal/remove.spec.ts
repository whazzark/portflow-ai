import { createHash, randomBytes } from 'node:crypto'

import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { DischargeFactory } from '#database/factories/discharge_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { ShiftFactory } from '#database/factories/shift_factory'
import { UserActivationTokenFactory } from '#database/factories/user_activation_token_factory'
import { UserFactory } from '#database/factories/user_factory'
import Shift from '#models/shift'
import User from '#models/user'
import UserActivationToken from '#models/user_activation_token'
import {
  UserActiveCannotBeRemovedException,
  UserDeactivatedCannotBeRemovedException,
  UserReferencedCannotBeRemovedException,
} from '#users/removal/removal_exceptions'
import RemoveUserUseCase from '#users/removal/remove_user_use_case'
import UserRepository from '#users/shared/repositories/user_repository'
import { UserNotFoundException } from '#users/shared/user_exceptions'

const UNKNOWN_ID = '00000000-0000-4000-8000-999999999999'

const removeUser = async (id: string) =>
  (await app.container.make(RemoveUserUseCase)).handle({ id })

/** Everything about a bystander a removal must leave exactly as it found it (FR-010). */
const snapshot = (user: User) => ({
  accessStatus: user.accessStatus,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  password: user.password,
  invitedAt: user.invitedAt?.toISO() ?? null,
  invitedByUserId: user.invitedByUserId,
  activatedAt: user.activatedAt?.toISO() ?? null,
  activatedByUserId: user.activatedByUserId,
  cancelledAt: user.cancelledAt?.toISO() ?? null,
  cancelledByUserId: user.cancelledByUserId,
  deactivatedAt: user.deactivatedAt?.toISO() ?? null,
  deactivatedByUserId: user.deactivatedByUserId,
  reactivatedAt: user.reactivatedAt?.toISO() ?? null,
  reactivatedByUserId: user.reactivatedByUserId,
  passwordRenewalRequiredAt: user.passwordRenewalRequiredAt?.toISO() ?? null,
  passwordResetAt: user.passwordResetAt?.toISO() ?? null,
  passwordResetByUserId: user.passwordResetByUserId,
  updatedAt: user.updatedAt?.toISO() ?? null,
})

const invitedBy = (admin: User) =>
  UserFactory.apply('invited').merge({ invitedByUserId: admin.id }).create()

test.group('RemoveUserUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('removes a pending and a cancelled user', async ({ assert }) => {
    for (const state of ['invited', 'cancelled'] as const) {
      const user = await UserFactory.apply(state).create()

      await removeUser(user.id)

      assert.isNull(await User.find(user.id))
    }
  })

  test('takes the activation link with the user, and no other', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const target = await invitedBy(admin)
    const bystander = await invitedBy(admin)
    await UserActivationTokenFactory.merge({ userId: target.id }).create()
    const kept = await UserActivationTokenFactory.merge({ userId: bystander.id }).create()

    await removeUser(target.id)

    assert.isNull(await UserActivationToken.findBy('userId', target.id))
    assert.isNotNull(await UserActivationToken.find(kept.id))
  })

  test('leaves every other user exactly as it was', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const bystander = await invitedBy(admin)
    const target = await invitedBy(admin)
    await admin.refresh()
    await bystander.refresh()
    const before = [snapshot(admin), snapshot(bystander)]

    await removeUser(target.id)

    await admin.refresh()
    await bystander.refresh()
    assert.deepEqual([snapshot(admin), snapshot(bystander)], before)
  })

  // FR-012: nothing records the removal — the user and their link are the only rows that move.
  test('keeps no trace of the removal', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const target = await invitedBy(admin)
    await UserActivationTokenFactory.merge({ userId: target.id }).create()
    const usersBefore = (await User.all()).length
    const tokensBefore = (await UserActivationToken.all()).length

    await removeUser(target.id)

    assert.equal((await User.all()).length, usersBefore - 1)
    assert.equal((await UserActivationToken.all()).length, tokensBefore - 1)
    assert.isNull(await User.query().where('email', target.email).first())
  })

  test('frees the email for a new invitation, whatever its casing', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const target = await invitedBy(admin)

    await removeUser(target.id)

    const repository = await app.container.make(UserRepository)
    const result = await repository.invite({
      firstName: target.firstName,
      lastName: target.lastName,
      email: target.email.toUpperCase(),
      role: 'OBSERVER',
      invitedAt: DateTime.now(),
      invitedByUserId: admin.id,
      activationTokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
      activationTokenExpiresAt: DateTime.now().plus({ days: 7 }),
    })

    assert.equal(result.kind, 'CREATED')
    if (result.kind === 'CREATED') {
      assert.notEqual(result.user.id, target.id)
      assert.equal(result.user.role, 'OBSERVER')
    }
  })

  test('refuses an active user and names deactivation', async ({ assert }) => {
    const user = await UserFactory.apply('active').create()
    await user.refresh()
    const before = snapshot(user)

    await assert.rejects(() => removeUser(user.id), UserActiveCannotBeRemovedException.message)

    await user.refresh()
    assert.deepEqual(snapshot(user), before)
  })

  test('refuses a deactivated user, who is kept', async ({ assert }) => {
    const user = await UserFactory.apply('deactivated').create()
    await user.refresh()
    const before = snapshot(user)

    await assert.rejects(() => removeUser(user.id), UserDeactivatedCannotBeRemovedException.message)

    await user.refresh()
    assert.deepEqual(snapshot(user), before)
  })

  test('refuses an identifier naming no user', async ({ assert }) => {
    await assert.rejects(() => removeUser(UNKNOWN_ID), UserNotFoundException.message)
  })

  // Nothing of the first removal is kept, so the second cannot tell it from a user that never was.
  test('answers a second removal of the same user as naming no user', async ({ assert }) => {
    const user = await UserFactory.apply('invited').create()

    await removeUser(user.id)

    await assert.rejects(() => removeUser(user.id), UserNotFoundException.message)
  })

  // US2 scenario 4, as an ordering: the user was listed as pending and became active before the
  // delete ran. The single SQLite connection cannot interleave the two writes; what this pins is
  // that the delete judges the row as it stands, and leaves the activation link with it.
  test('refuses a user whose invitation became active after they were listed', async ({
    assert,
  }) => {
    const asDisplayed = await UserFactory.apply('invited').create()
    await UserActivationTokenFactory.merge({ userId: asDisplayed.id }).create()
    await User.query().where('id', asDisplayed.id).update({ accessStatus: 'ACTIVE' })

    await assert.rejects(
      () => removeUser(asDisplayed.id),
      UserActiveCannotBeRemovedException.message,
    )

    assert.isNotNull(await User.find(asDisplayed.id))
    assert.isNotNull(await UserActivationToken.findBy('userId', asDisplayed.id))
  })

  test('refuses a user a shift names as its responsible, and changes nothing', async ({
    assert,
  }) => {
    const user = await UserFactory.apply('invited').create()
    const token = await UserActivationTokenFactory.merge({ userId: user.id }).create()
    const dock = await DockFactory.create()
    const discharge = await DischargeFactory.merge({ dockId: dock.id }).create()
    const shift = await ShiftFactory.merge({
      dischargeId: discharge.id,
      responsibleUserId: user.id,
    }).create()

    await assert.rejects(() => removeUser(user.id), UserReferencedCannotBeRemovedException.message)

    assert.isNotNull(await User.find(user.id))
    assert.isNotNull(await UserActivationToken.find(token.id))
    assert.equal((await Shift.findOrFail(shift.id)).responsibleUserId, user.id)
  })

  // A never-activated organization admin never counted as an active one, so nothing protects them.
  test('removes a pending organization admin like any other pending user', async ({ assert }) => {
    const user = await UserFactory.apply('invited').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    await removeUser(user.id)

    assert.isNull(await User.find(user.id))
  })

  // ADR 0013: the repository reports what the guarded delete observed, free of HTTP; the use case
  // alone turns it into a refusal. Each outcome is pinned here at the seam the use case reads.
  test('reports the typed outcome the guarded delete observed', async ({ assert }) => {
    const repository = await app.container.make(UserRepository)
    const pending = await UserFactory.apply('invited').create()
    const active = await UserFactory.apply('active').create()
    const deactivated = await UserFactory.apply('deactivated').create()
    const referenced = await UserFactory.apply('cancelled').create()
    const dock = await DockFactory.create()
    const discharge = await DischargeFactory.merge({ dockId: dock.id }).create()
    await ShiftFactory.merge({
      dischargeId: discharge.id,
      responsibleUserId: referenced.id,
    }).create()

    assert.deepEqual(await repository.removeNeverActivated({ id: pending.id }), {
      kind: 'REMOVED',
    })
    assert.deepEqual(await repository.removeNeverActivated({ id: pending.id }), {
      kind: 'NOT_FOUND',
    })
    assert.deepEqual(await repository.removeNeverActivated({ id: active.id }), {
      kind: 'NOT_REMOVABLE',
      accessStatus: 'ACTIVE',
    })
    assert.deepEqual(await repository.removeNeverActivated({ id: deactivated.id }), {
      kind: 'NOT_REMOVABLE',
      accessStatus: 'DEACTIVATED',
    })
    assert.deepEqual(await repository.removeNeverActivated({ id: referenced.id }), {
      kind: 'REFERENCED',
    })
  })
})
