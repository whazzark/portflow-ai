import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'

type UserEntry = {
  id: string
  accessStatus: string
  invitedAt: unknown
  invitedBy: unknown
  cancelledAt: unknown
  cancelledBy: unknown
}

test.group('GET /api/v1/users', () => {
  test('rejects unauthenticated access', async ({ assert, client }) => {
    const response = await client.get('/api/v1/users')

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('denies consultation to roles without user administration responsibility', async ({
    assert,
    client,
  }) => {
    for (const role of ['OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const viewer = await UserFactory.apply('active').merge({ role }).create()

      const response = await client.get('/api/v1/users').loginAs(viewer)

      response.assertStatus(403)
      assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
    }
  })

  // Per the contract: a non-active user holds no session at all (GH-3), so the refusal arrives as
  // an unauthenticated one rather than an authorization failure.
  test('denies consultation to a viewer whose access is not active', async ({ assert, client }) => {
    const deactivated = await UserFactory.apply('deactivated')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()

    const response = await client.get('/api/v1/users').loginAs(deactivated)

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('restricts an operations admin to active users with no lifecycle block', async ({
    assert,
    client,
  }) => {
    const viewer = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const pending = await UserFactory.apply('invited').create()
    const deactivated = await UserFactory.apply('deactivated').create()
    const cancelled = await UserFactory.apply('cancelled').create()

    const response = await client.get('/api/v1/users').loginAs(viewer)

    response.assertStatus(200)

    const body = response.body().data as Record<string, unknown>[]
    const ids = body.map((user) => user.id)

    assert.include(ids, viewer.id)
    assert.notInclude(ids, pending.id)
    assert.notInclude(ids, deactivated.id)
    assert.notInclude(ids, cancelled.id)
    assert.isTrue(body.every((user) => user.accessStatus === 'ACTIVE'))

    // Absent, not null: a responsible administrator is itself a user this viewer may not consult.
    for (const key of [
      'invitedAt',
      'invitedBy',
      'activatedAt',
      'activatedBy',
      'cancelledAt',
      'cancelledBy',
      'deactivatedAt',
      'deactivatedBy',
      'reactivatedAt',
      'reactivatedBy',
    ]) {
      assert.isTrue(
        body.every((user) => !(key in user)),
        `expected "${key}" to be absent from every entry`,
      )
    }
  })

  test('returns every access status to an organization admin', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const pending = await UserFactory.apply('invited').create()
    const deactivated = await UserFactory.apply('deactivated').create()
    const cancelled = await UserFactory.apply('cancelled').create()

    const response = await client.get('/api/v1/users').loginAs(admin)

    response.assertStatus(200)

    const body = response.body().data as UserEntry[]
    const byId = new Map(body.map((user) => [user.id, user]))

    assert.includeMembers(
      body.map((user) => user.id),
      [admin.id, pending.id, deactivated.id, cancelled.id],
    )
    assert.deepEqual(
      [pending, deactivated, cancelled].map((user) => byId.get(user.id)?.accessStatus),
      ['PENDING', 'DEACTIVATED', 'CANCELLED'],
    )
  })

  test('resolves the administrator responsible for a recorded lifecycle event', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    // Merged rather than applied through the `invited` state, which nulls the actor like every
    // sibling lifecycle state does.
    const invited = await UserFactory.merge({
      invitedAt: DateTime.now(),
      invitedByUserId: admin.id,
    }).create()

    const response = await client.get('/api/v1/users').loginAs(admin)

    response.assertStatus(200)

    const entry = (response.body().data as UserEntry[]).find((user) => user.id === invited.id)

    assert.deepEqual(entry?.invitedBy, {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
    })
    assert.isNotNull(entry?.invitedAt)
  })

  test('leaves an unrecorded lifecycle event null rather than inventing one', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const pending = await UserFactory.create()

    const response = await client.get('/api/v1/users').loginAs(admin)

    response.assertStatus(200)

    const entry = (response.body().data as UserEntry[]).find((user) => user.id === pending.id)

    assert.isNull(entry?.cancelledAt)
    assert.isNull(entry?.cancelledBy)
  })

  /**
   * Asserted on the key set rather than on a `'password'` substring, which `#17` made a false
   * positive: `passwordResetAt`, `passwordResetBy`, and `passwordRenewalRequired` are named after
   * `CONTEXT.md`'s `Password Reset` and carry no secret — a date, an administrator's name, and one
   * boolean. The intent is unchanged and the check is stricter: an exhaustive key set catches a new
   * leak under *any* name, which the substring never did.
   */
  test('never exposes credentials or tokens', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    await UserFactory.apply('active').createMany(2)

    const response = await client.get('/api/v1/users').loginAs(admin)

    response.assertStatus(200)

    for (const user of response.body().data as Array<Record<string, unknown>>) {
      assert.deepEqual(Object.keys(user).sort(), [
        'accessStatus',
        'activatedAt',
        'activatedBy',
        'cancelledAt',
        'cancelledBy',
        'deactivatedAt',
        'deactivatedBy',
        'email',
        'firstName',
        'id',
        'invitedAt',
        'invitedBy',
        'lastName',
        'passwordRenewalRequired',
        'passwordResetAt',
        'passwordResetBy',
        'reactivatedAt',
        'reactivatedBy',
        'role',
      ])
    }

    const serialized = JSON.stringify(response.body())

    // The raw requirement timestamp stays unserialized everywhere: it would say *when* an
    // administrator acted, where the reset event says it correctly attributed.
    assert.notInclude(serialized, 'passwordRenewalRequiredAt')
    assert.notInclude(serialized, 'token')
  })
})
