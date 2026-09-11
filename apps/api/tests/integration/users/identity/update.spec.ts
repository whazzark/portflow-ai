import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'

/**
 * The integration suite does not wrap each test in a transaction, so every address a test claims
 * stays claimed for the rest of the run. Seeding it keeps `users_email_unique` out of the way of
 * tests that are not about conflicts — the ones that are claim their address deliberately.
 */
const correction = (seed: string) => ({
  firstName: 'Camille',
  lastName: 'Renard',
  email: `camille.renard.${seed}@example.com`,
})

const anAdministrator = () =>
  UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

test.group('PATCH /api/v1/users/:id', () => {
  test('corrects the identity of another user and returns it', async ({ assert, client }) => {
    const administrator = await anAdministrator()
    const target = await UserFactory.apply('active').merge({ firstName: 'Camile' }).create()
    const submitted = correction(target.id)

    const response = await client
      .patch(`/api/v1/users/${target.id}`)
      .json(submitted)
      .loginAs(administrator)

    response.assertStatus(200)
    assert.equal(response.body().data.firstName, 'Camille')
    assert.equal(response.body().data.email, submitted.email)
    await target.refresh()
    assert.equal(target.firstName, 'Camille')
    assert.equal(target.email, submitted.email)
  })

  test('corrects a user whatever their access status', async ({ assert, client }) => {
    for (const state of ['active', 'deactivated', 'cancelled'] as const) {
      const administrator = await anAdministrator()
      const target = await UserFactory.apply(state).create()

      const response = await client
        .patch(`/api/v1/users/${target.id}`)
        .json(correction(target.id))
        .loginAs(administrator)

      response.assertStatus(200)
      await target.refresh()
      assert.equal(target.firstName, 'Camille')
      assert.equal(target.accessStatus, state === 'active' ? 'ACTIVE' : state.toUpperCase())
    }
  })

  test('corrects the name of a pending user without touching their invitation', async ({
    assert,
    client,
  }) => {
    const administrator = await anAdministrator()
    const target = await UserFactory.apply('invited').create()
    const unchangedAddress = target.email

    const response = await client
      .patch(`/api/v1/users/${target.id}`)
      .json({ firstName: 'Camille', lastName: 'Renard', email: unchangedAddress })
      .loginAs(administrator)

    response.assertStatus(200)
    await target.refresh()
    assert.equal(target.firstName, 'Camille')
    assert.equal(target.email, unchangedAddress)
    assert.equal(target.accessStatus, 'PENDING')
  })

  // Their activation link was handed out under the address recorded at invitation, and this slice
  // issues no replacement. The message is what the administrator reads, so it has to say why.
  test('refuses to move a pending user to another mailbox, and says why', async ({
    assert,
    client,
  }) => {
    const administrator = await anAdministrator()
    const target = await UserFactory.apply('invited').merge({ firstName: 'Camile' }).create()
    const addressBefore = target.email

    const response = await client
      .patch(`/api/v1/users/${target.id}`)
      .json(correction(target.id))
      .loginAs(administrator)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_USER_PENDING_EMAIL_LOCKED')
    assert.match(response.body().error.message, /has not activated their access yet/)
    await target.refresh()
    assert.equal(target.firstName, 'Camile')
    assert.equal(target.email, addressBefore)
  })

  test('accepts a submission identical to the stored identity', async ({ assert, client }) => {
    const administrator = await anAdministrator()
    // Merged rather than applied through the `active` state, which nulls the actors.
    const target = await UserFactory.merge({
      accessStatus: 'ACTIVE',
      invitedAt: DateTime.now(),
      invitedByUserId: administrator.id,
      activatedAt: DateTime.now(),
      activatedByUserId: administrator.id,
    }).create()
    const unchanged = {
      firstName: target.firstName,
      lastName: target.lastName,
      email: target.email,
    }

    const response = await client
      .patch(`/api/v1/users/${target.id}`)
      .json(unchanged)
      .loginAs(administrator)

    response.assertStatus(200)
    assert.equal(response.body().data.firstName, unchanged.firstName)
    assert.equal(response.body().data.lastName, unchanged.lastName)
    assert.equal(response.body().data.email, unchanged.email)
    // The same projection a write returns: nothing was written, but the access history is still
    // resolved rather than reading as "nobody invited this user".
    const actor = {
      id: administrator.id,
      firstName: administrator.firstName,
      lastName: administrator.lastName,
    }
    assert.deepEqual(response.body().data.invitedBy, actor)
    assert.deepEqual(response.body().data.activatedBy, actor)
  })

  test('leaves everything but the identity untouched', async ({ assert, client }) => {
    const administrator = await anAdministrator()
    const target = await UserFactory.apply('passwordRenewalRequired')
      .merge({ role: 'OPERATIONS_LEAD' })
      .create()
    // Read back from storage before capturing: the in-memory factory value carries milliseconds
    // the timestamp columns do not, and this test is about what the correction leaves alone, not
    // about storage precision.
    await target.refresh()
    const before = {
      role: target.role,
      accessStatus: target.accessStatus,
      password: target.password,
      passwordRenewalRequiredAt: target.passwordRenewalRequiredAt?.toISO(),
      activatedAt: target.activatedAt?.toISO(),
    }

    const response = await client
      .patch(`/api/v1/users/${target.id}`)
      .json(correction(target.id))
      .loginAs(administrator)

    response.assertStatus(200)
    await target.refresh()
    assert.equal(target.role, before.role)
    assert.equal(target.accessStatus, before.accessStatus)
    assert.equal(target.password, before.password)
    assert.equal(target.passwordRenewalRequiredAt?.toISO(), before.passwordRenewalRequiredAt)
    assert.equal(target.activatedAt?.toISO(), before.activatedAt)
  })

  test('never exposes credentials or renewal timing in the response', async ({
    assert,
    client,
  }) => {
    const administrator = await anAdministrator()
    const target = await UserFactory.apply('active').create()

    const response = await client
      .patch(`/api/v1/users/${target.id}`)
      .json(correction(target.id))
      .loginAs(administrator)

    response.assertStatus(200)
    assert.notProperty(response.body().data, 'password')
    assert.notProperty(response.body().data, 'passwordRenewalRequiredAt')
  })
})

test.group('PATCH /api/v1/users/:id authorization', () => {
  test('rejects unauthenticated access', async ({ assert, client }) => {
    const target = await UserFactory.apply('active').create()

    const response = await client.patch(`/api/v1/users/${target.id}`).json(correction(target.id))

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('denies the correction to every role but organization admin', async ({ assert, client }) => {
    for (const role of ['OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const viewer = await UserFactory.apply('active').merge({ role }).create()
      const target = await UserFactory.apply('active').create()
      const nameBefore = target.firstName

      const response = await client
        .patch(`/api/v1/users/${target.id}`)
        .json(correction(target.id))
        .loginAs(viewer)

      response.assertStatus(403)
      assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
      await target.refresh()
      assert.equal(target.firstName, nameBefore)
    }
  })

  // Per the contract: a non-active user holds no session at all (GH-3), so the refusal arrives as
  // an unauthenticated one rather than an authorization failure.
  test('denies the correction to an administrator whose own access is not active', async ({
    assert,
    client,
  }) => {
    const viewer = await UserFactory.apply('deactivated')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const target = await UserFactory.apply('active').create()

    const response = await client
      .patch(`/api/v1/users/${target.id}`)
      .json(correction(target.id))
      .loginAs(viewer)

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('refuses an administrator correcting themselves', async ({ assert, client }) => {
    const administrator = await anAdministrator()
    const nameBefore = administrator.firstName

    const response = await client
      .patch(`/api/v1/users/${administrator.id}`)
      .json(correction(administrator.id))
      .loginAs(administrator)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_USER_IDENTITY_SELF_UPDATE')
    await administrator.refresh()
    assert.equal(administrator.firstName, nameBefore)
  })

  test('answers an unknown user the way it answers a user of another organization', async ({
    assert,
    client,
  }) => {
    const administrator = await anAdministrator()

    const response = await client
      .patch('/api/v1/users/00000000-0000-4000-8000-000000000000')
      .json(correction('absent'))
      .loginAs(administrator)

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_USER_NOT_FOUND')
  })
})

test.group('PATCH /api/v1/users/:id validation', () => {
  test('rejects a malformed identifier before any user is read', async ({ assert, client }) => {
    const administrator = await anAdministrator()

    const response = await client
      .patch('/api/v1/users/not-a-uuid')
      .json(correction('malformed'))
      .loginAs(administrator)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(response.body().error.details[0].field, 'params.id')
  })

  test('refuses a blank, whitespace-only, or over-long name', async ({ assert, client }) => {
    const administrator = await anAdministrator()
    const target = await UserFactory.apply('active').create()
    const nameBefore = target.firstName

    for (const firstName of ['', '   ', 'x'.repeat(256)]) {
      const response = await client
        .patch(`/api/v1/users/${target.id}`)
        .json({ ...correction(target.id), firstName })
        .loginAs(administrator)

      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
      assert.equal(response.body().error.details[0].field, 'firstName')
    }

    await target.refresh()
    assert.equal(target.firstName, nameBefore)
  })

  test('refuses a malformed email address', async ({ assert, client }) => {
    const administrator = await anAdministrator()
    const target = await UserFactory.apply('active').create()
    const addressBefore = target.email

    const response = await client
      .patch(`/api/v1/users/${target.id}`)
      .json({ ...correction(target.id), email: 'camille.renard@' })
      .loginAs(administrator)

    response.assertStatus(422)
    assert.equal(response.body().error.details[0].field, 'email')
    await target.refresh()
    assert.equal(target.email, addressBefore)
  })

  test('refuses a missing key rather than preserving the stored value silently', async ({
    assert,
    client,
  }) => {
    const administrator = await anAdministrator()
    const target = await UserFactory.apply('active').create()

    const response = await client
      .patch(`/api/v1/users/${target.id}`)
      .json({ firstName: 'Camille', lastName: 'Renard' })
      .loginAs(administrator)

    response.assertStatus(422)
    assert.equal(response.body().error.details[0].field, 'email')
  })

  test('trims insignificant whitespace and keeps everything else as entered', async ({
    assert,
    client,
  }) => {
    const administrator = await anAdministrator()
    const target = await UserFactory.apply('active').create()
    const submitted = correction(target.id)

    const response = await client
      .patch(`/api/v1/users/${target.id}`)
      .json({
        firstName: '  Cámille-Ünn  ',
        lastName: "  O'Ríordáin  ",
        email: `  ${submitted.email}  `,
      })
      .loginAs(administrator)

    response.assertStatus(200)
    await target.refresh()
    assert.equal(target.firstName, 'Cámille-Ünn')
    assert.equal(target.lastName, "O'Ríordáin")
    assert.equal(target.email, submitted.email)
  })

  test('refuses an address another user already holds, whatever their access status', async ({
    assert,
    client,
  }) => {
    for (const state of ['active', 'invited', 'deactivated', 'cancelled'] as const) {
      const administrator = await anAdministrator()
      const holder = await UserFactory.apply(state).create()
      const target = await UserFactory.apply('active').create()
      const addressBefore = target.email

      const response = await client
        .patch(`/api/v1/users/${target.id}`)
        .json({ ...correction(target.id), email: holder.email })
        .loginAs(administrator)

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_USER_EMAIL_CONFLICT')
      await target.refresh()
      assert.equal(target.email, addressBefore)
      await holder.refresh()
      assert.equal(holder.accessStatus, state === 'invited' ? 'PENDING' : state.toUpperCase())
    }
  })

  test('treats an address differing only by case or padding as the same address', async ({
    assert,
    client,
  }) => {
    const administrator = await anAdministrator()
    const holder = await UserFactory.apply('active').create()
    const target = await UserFactory.apply('active').create()
    const addressBefore = target.email

    const response = await client
      .patch(`/api/v1/users/${target.id}`)
      .json({ ...correction(target.id), email: `  ${holder.email.toUpperCase()}  ` })
      .loginAs(administrator)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_USER_EMAIL_CONFLICT')
    await target.refresh()
    assert.equal(target.email, addressBefore)
  })

  test('accepts the correction once the offending value is fixed', async ({ assert, client }) => {
    const administrator = await anAdministrator()
    const holder = await UserFactory.apply('active').create()
    const target = await UserFactory.apply('active').create()

    const refused = await client
      .patch(`/api/v1/users/${target.id}`)
      .json({ ...correction(target.id), email: holder.email })
      .loginAs(administrator)
    refused.assertStatus(409)

    const accepted = await client
      .patch(`/api/v1/users/${target.id}`)
      .json(correction(target.id))
      .loginAs(administrator)

    accepted.assertStatus(200)
    await target.refresh()
    assert.equal(target.firstName, 'Camille')
  })
})
