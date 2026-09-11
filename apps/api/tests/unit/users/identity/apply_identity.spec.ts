import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import LucidUserRepository from '#users/shared/repositories/lucid_user_repository'

const repository = () => app.container.make(LucidUserRepository)

test.group('LucidUserRepository identity correction', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('writes the corrected identity', async ({ assert }) => {
    const target = await UserFactory.apply('active')
      .merge({ firstName: 'Camile', lastName: 'Renard', email: 'camile.renard@example.com' })
      .create()

    const result = await db.transaction(async (client) =>
      (await repository()).applyIdentity({
        id: target.id,
        firstName: 'Camille',
        lastName: 'Renard',
        email: 'camille.renard@example.com',
        changedAt: DateTime.now(),
        client,
      }),
    )

    assert.equal(result.kind, 'UPDATED')
    await target.refresh()
    assert.equal(target.firstName, 'Camille')
    assert.equal(target.email, 'camille.renard@example.com')
  })

  test('reports an unknown user rather than writing anything', async ({ assert }) => {
    const result = await db.transaction(async (client) =>
      (await repository()).applyIdentity({
        id: '00000000-0000-4000-8000-000000000000',
        firstName: 'Camille',
        lastName: 'Renard',
        email: 'camille.renard@example.com',
        changedAt: DateTime.now(),
        client,
      }),
    )

    assert.equal(result.kind, 'NOT_FOUND')
  })

  test('reports an address already held by another user, whatever its casing', async ({
    assert,
  }) => {
    const holder = await UserFactory.apply('cancelled')
      .merge({ email: 'occupied@example.com' })
      .create()
    const target = await UserFactory.apply('active').create()
    const targetEmailBefore = target.email

    const result = await db.transaction(async (client) =>
      (await repository()).applyIdentity({
        id: target.id,
        firstName: target.firstName,
        lastName: target.lastName,
        email: 'OCCUPIED@Example.com',
        changedAt: DateTime.now(),
        client,
      }),
    )

    assert.equal(result.kind, 'EMAIL_TAKEN')
    await target.refresh()
    assert.equal(target.email, targetEmailBefore)
    await holder.refresh()
    assert.equal(holder.email, 'occupied@example.com')
  })

  test('locks the target so a correction is decided against the identity it replaces', async ({
    assert,
  }) => {
    const target = await UserFactory.apply('active').merge({ firstName: 'Camile' }).create()

    const locked = await db.transaction(async (client) =>
      (await repository()).findByIdForUpdate(target.id, client),
    )

    assert.isNotNull(locked)
    assert.equal(locked?.firstName, 'Camile')
  })

  test('reports an unknown user from the locked read', async ({ assert }) => {
    const locked = await db.transaction(async (client) =>
      (await repository()).findByIdForUpdate('00000000-0000-4000-8000-000000000000', client),
    )

    assert.isNull(locked)
  })

  test('leaves one complete identity when two corrections race', async ({ assert }) => {
    const target = await UserFactory.apply('active').create()
    const apply = (firstName: string, lastName: string) =>
      db.transaction(async (client) =>
        (await repository()).applyIdentity({
          id: target.id,
          firstName,
          lastName,
          email: target.email,
          changedAt: DateTime.now(),
          client,
        }),
      )

    await Promise.all([apply('Camille', 'Renard'), apply('Inès', 'Faure')])

    await target.refresh()
    // Either correction may win, but never half of each: the identity a viewer reads is one of the
    // two submitted, complete.
    const stored = `${target.firstName} ${target.lastName}`
    assert.oneOf(stored, ['Camille Renard', 'Inès Faure'])
  })
})
