import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import type User from '#models/user'
import ChangeUserRoleUseCase from '#users/role_change/change_user_role_use_case'
import { LastActiveOrganizationAdminException } from '#users/shared/user_exceptions'

import { hideActiveOrganizationAdmins } from '../../../support/organization_admins.ts'
import { untouchedFields } from '../../../support/user_snapshots.ts'

const changeRole = async () => app.container.make(ChangeUserRoleUseCase)

/**
 * The administrator asking. It names no user, and that is the point: once the request has been
 * authorized, the use case never looks at the requester again — which is exactly the position of an
 * administrator demoted or deactivated while their request was in flight. Every scenario below is
 * that collision, replayed one step at a time.
 */
const REQUESTER_ID = '00000000-0000-4000-8000-00000000a0a0'

const activeAdmin = () => UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

const demote = async (user: User, role: User['role'] = 'OBSERVER') =>
  (await changeRole()).handle({ requestedByUserId: REQUESTER_ID, userId: user.id, role })

test.group('ChangeUserRoleUseCase — final organization admin', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  // Every test reasons about the population it creates; admins left by other files would count too.
  // No restore is returned: the global transaction's rollback puts them back.
  group.each.setup(async () => {
    await hideActiveOrganizationAdmins()
  })

  test('demotes an organization admin while another remains active', async ({ assert }) => {
    const [first] = [await activeAdmin(), await activeAdmin()]

    const demoted = await demote(first)

    assert.equal(demoted.role, 'OBSERVER')
  })

  test('refuses demoting the only active organization admin', async ({ assert }) => {
    const admin = await activeAdmin()

    for (const role of ['OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const error = await demote(admin, role).then(
        () => assert.fail(`demoting the last admin to ${role} was accepted`),
        (refusal: unknown) => refusal,
      )

      assert.instanceOf(error, LastActiveOrganizationAdminException)
      const refusal = error as LastActiveOrganizationAdminException
      assert.equal(refusal.status, 409)
      assert.equal(refusal.code, 'E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN')
      // FR-007: the rule, never who remains nor how many.
      assert.equal(
        refusal.message,
        'The organization must keep at least one active organization admin',
      )
    }

    await admin.refresh()
    assert.equal(admin.role, 'ORGANIZATION_ADMIN')
  })

  // US2 scenario 2, FR-005: the change is judged against the organization as it stands when it is
  // applied, not as it stood when the request was authorized.
  test('no longer counts an admin deactivated before the change is applied', async ({ assert }) => {
    const target = await activeAdmin()
    const other = await activeAdmin()
    other.accessStatus = 'DEACTIVATED'
    await other.save()

    await assert.rejects(() => demote(target), LastActiveOrganizationAdminException.message)

    await target.refresh()
    assert.equal(target.role, 'ORGANIZATION_ADMIN')
  })

  test('no longer counts an admin demoted before the change is applied', async ({ assert }) => {
    const target = await activeAdmin()
    const other = await activeAdmin()
    other.role = 'OPERATIONS_ADMIN'
    await other.save()

    await assert.rejects(() => demote(target), LastActiveOrganizationAdminException.message)

    await target.refresh()
    assert.equal(target.role, 'ORGANIZATION_ADMIN')
  })

  test('does not count pending or cancelled organization admins', async ({ assert }) => {
    const target = await activeAdmin()
    await UserFactory.apply('invited').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    await UserFactory.apply('cancelled').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    await assert.rejects(() => demote(target), LastActiveOrganizationAdminException.message)
  })

  // US2 scenario 6: they administer nobody, so demoting them takes nothing from the organization.
  test('always lets a pending or cancelled organization admin be demoted', async ({ assert }) => {
    await activeAdmin()
    const pending = await UserFactory.apply('invited')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const cancelled = await UserFactory.apply('cancelled')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()

    assert.equal((await demote(pending)).role, 'OBSERVER')
    assert.equal((await demote(cancelled)).role, 'OBSERVER')
  })

  // US2 scenario 7: granting the role can only add to the organization's admins — even to the
  // only one there is, which is the case a rule keyed on the target alone would get wrong.
  test('never refuses the organization admin role to the only active admin', async ({ assert }) => {
    const admin = await activeAdmin()
    await admin.refresh()
    const before = untouchedFields(admin)

    assert.equal((await demote(admin, 'ORGANIZATION_ADMIN')).role, 'ORGANIZATION_ADMIN')

    await admin.refresh()
    assert.deepEqual(untouchedFields(admin), before)
    assert.equal(admin.role, 'ORGANIZATION_ADMIN')
  })

  test('never refuses a promotion to organization admin', async ({ assert }) => {
    await activeAdmin()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    assert.equal((await demote(observer, 'ORGANIZATION_ADMIN')).role, 'ORGANIZATION_ADMIN')
  })

  // US2 scenario 3, one change at a time: the order the collision's winners happened to be applied.
  test('lets three admins lose two, never three', async ({ assert }) => {
    const [first, second, third] = [await activeAdmin(), await activeAdmin(), await activeAdmin()]

    await demote(second)
    await demote(third)
    await assert.rejects(() => demote(first), LastActiveOrganizationAdminException.message)

    await first.refresh()
    assert.equal(first.role, 'ORGANIZATION_ADMIN')
  })

  // FR-009: a refusal writes nothing, on the target or on the user whose loss caused it.
  test('leaves every user untouched on a refusal', async ({ assert }) => {
    const target = await activeAdmin()
    const other = await activeAdmin()
    other.accessStatus = 'DEACTIVATED'
    await other.save()
    await target.refresh()
    await other.refresh()
    const before = { target: untouchedFields(target), other: untouchedFields(other) }

    await assert.rejects(() => demote(target))

    await target.refresh()
    await other.refresh()
    assert.deepEqual({ target: untouchedFields(target), other: untouchedFields(other) }, before)
    assert.equal(target.role, 'ORGANIZATION_ADMIN')
    assert.equal(other.role, 'ORGANIZATION_ADMIN')
  })
})
