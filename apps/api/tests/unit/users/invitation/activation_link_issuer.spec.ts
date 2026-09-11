import { createHash } from 'node:crypto'

import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import env from '#start/env'
import ActivationLinkIssuer, {
  ACTIVATION_LINK_LIFETIME_IN_DAYS,
} from '#users/shared/activation_link_issuer'

const secretOf = (url: string) => url.slice(url.lastIndexOf('/') + 1)

test.group('ActivationLinkIssuer', () => {
  test('issues a link under the web application origin', async ({ assert }) => {
    const issuer = await app.container.make(ActivationLinkIssuer)

    const { url } = issuer.issue()

    assert.isTrue(url.startsWith(`${env.get('WEB_ORIGIN')}/activate/`))
    assert.isAbove(secretOf(url).length, 32)
  })

  test('stores the digest of the secret and never the secret', async ({ assert }) => {
    const issuer = await app.container.make(ActivationLinkIssuer)

    const { url, hash } = issuer.issue()

    assert.equal(hash, createHash('sha256').update(secretOf(url)).digest('hex'))
    assert.notEqual(hash, secretOf(url))
  })

  test('expires the link 7 days after it is issued', async ({ assert }) => {
    const issuer = await app.container.make(ActivationLinkIssuer)

    const { expiresAt } = issuer.issue()

    assert.equal(ACTIVATION_LINK_LIFETIME_IN_DAYS, 7)
    assert.approximately(expiresAt.diff(DateTime.now(), 'hours').hours, 24 * 7, 1)
  })

  test('never issues the same secret twice', async ({ assert }) => {
    const issuer = await app.container.make(ActivationLinkIssuer)

    const first = issuer.issue()
    const second = issuer.issue()

    assert.notEqual(first.url, second.url)
    assert.notEqual(first.hash, second.hash)
  })
})
