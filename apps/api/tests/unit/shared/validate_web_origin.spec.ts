import { test } from '@japa/runner'

import { validateWebOrigin } from '#start/env'

test.group('validateWebOrigin', () => {
  test('strips the trailing slashes a browser Origin header never carries', ({ assert }) => {
    assert.equal(
      validateWebOrigin('WEB_ORIGIN', 'https://app.example.com/'),
      'https://app.example.com',
    )
    assert.equal(
      validateWebOrigin('WEB_ORIGIN', 'http://localhost:3000//'),
      'http://localhost:3000',
    )
  })

  test('keeps an origin that is already bare', ({ assert }) => {
    assert.equal(validateWebOrigin('WEB_ORIGIN', 'http://localhost:3000'), 'http://localhost:3000')
  })

  test('refuses a missing or malformed origin', ({ assert }) => {
    assert.throws(() => validateWebOrigin('WEB_ORIGIN', undefined))
    assert.throws(() => validateWebOrigin('WEB_ORIGIN', 'app.example.com'))
  })
})
