import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'

import { hideActiveOrganizationAdmins } from '../../../support/organization_admins.ts'

const organizationAdmin = () =>
  UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

const activeOrganizationAdmins = () =>
  User.query().where('role', 'ORGANIZATION_ADMIN').where('accessStatus', 'ACTIVE')

test.group('PATCH /api/v1/users/:id/role — final organization admin', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.setup(async () => {
    await hideActiveOrganizationAdmins()
  })

  // FR-008 over HTTP. One request at a time can never meet the refusal: the requester is an active
  // organization admin when authorized, and the self rule guarantees they are not the target — so
  // they are always the other admin that remains. Only a collision can refuse, and the group below
  // is where it is proven.
  test('still demotes an organization admin while the requester remains one', async ({
    assert,
    client,
  }) => {
    const requester = await organizationAdmin()
    const target = await organizationAdmin()

    const response = await client
      .patch(`/api/v1/users/${target.id}/role`)
      .loginAs(requester)
      .json({ role: 'OPERATIONS_ADMIN' })

    response.assertStatus(200)
    await target.refresh()
    assert.equal(target.role, 'OPERATIONS_ADMIN')
    assert.lengthOf(await activeOrganizationAdmins(), 1)
  })
})

/**
 * Deliberately outside a global transaction. Under one, both requests would run on the single
 * connection that transaction holds: on PostgreSQL no row lock could then contend, and the group
 * would prove nothing about the lock it exists for. Here each request commits for real.
 *
 * Under SQLite — where the suites run — the single pooled connection serializes the two requests'
 * statements, so the loser may be authorized before the winner commits (and meet the rule, 409) or
 * after it (and no longer be an organization admin at all, 403); which one depends on how the two
 * queue for the connection. Either way this proves the invariant end to end, not the lock: the rule
 * is exercised deterministically by the unit decision table in
 * `tests/unit/users/role_change/final_admin.spec.ts`, and the lock by running this file against
 * PostgreSQL, as `quickstart.md` describes.
 *
 * Nothing it creates is left behind: with no transaction to roll back, the users each round creates
 * are deleted, and the admins hidden before it are given their role back.
 */
test.group('PATCH /api/v1/users/:id/role — concurrent demotions', (group) => {
  const created: string[] = []

  group.each.setup(async () => {
    const restore = await hideActiveOrganizationAdmins()

    return async () => {
      await User.query().whereIn('id', created.splice(0)).delete()
      await restore()
    }
  })

  test('keeps exactly one active organization admin when two admins demote each other', async ({
    assert,
    client,
  }) => {
    for (let round = 1; round <= 50; round++) {
      const first = await organizationAdmin()
      const second = await organizationAdmin()
      created.push(first.id, second.id)

      const responses = await Promise.all([
        client
          .patch(`/api/v1/users/${second.id}/role`)
          .loginAs(first)
          .json({ role: 'OPERATIONS_ADMIN' }),
        client
          .patch(`/api/v1/users/${first.id}/role`)
          .loginAs(second)
          .json({ role: 'OPERATIONS_ADMIN' }),
      ])

      const winners = responses.filter((response) => response.status() === 200)
      const losers = responses.filter((response) => response.status() !== 200)
      assert.lengthOf(winners, 1, `round ${round}: exactly one demotion applies`)

      // The loser either passed authorization before the winner committed, and is refused by the
      // rule, or after, and is no longer an organization admin at all.
      const [loser] = losers
      assert.include([409, 403], loser.status(), `round ${round}: the other is refused`)
      if (loser.status() === 409) {
        assert.equal(loser.body().error.code, 'E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN')
        assert.equal(
          loser.body().error.message,
          'The organization must keep at least one active organization admin',
        )
      }

      const remaining = await activeOrganizationAdmins()
      assert.lengthOf(remaining, 1, `round ${round}: one active organization admin remains`)
      assert.include([first.id, second.id], remaining[0].id)

      // The next round starts from an organization with no admin of its own.
      await User.query().where('id', remaining[0].id).update({ role: 'OPERATIONS_ADMIN' })
    }
  }).timeout(60_000)
})
