import { test } from '@japa/runner'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

import { instant, parseInstant } from '#shared/validators/instant_validator'

const validator = vine.create({ at: instant() })

test.group('Instant validation', () => {
  test('accepts ISO 8601 date-times that carry an explicit offset', async ({ assert }) => {
    for (const at of [
      '2026-10-01T06:00:00.000+02:00',
      '2026-10-01T04:00:00Z',
      '2026-10-01T06:00+02:00',
    ]) {
      const payload = await validator.validate({ at })

      assert.equal(payload.at, at)
    }
  })

  test('rejects date-times without an offset, dates alone, and impossible dates', async ({
    assert,
  }) => {
    const accepted: string[] = []

    for (const at of ['2026-10-01T06:00:00', '2026-10-01', 'not a date', '2026-02-30T06:00:00Z']) {
      const outcome = await validator.validate({ at }).then(
        () => 'accepted',
        () => 'rejected',
      )
      if (outcome === 'accepted') {
        accepted.push(at)
      }
    }

    assert.deepEqual(accepted, [])
  })

  test('parses an accepted instant into the same point in time', ({ assert }) => {
    const parsed = parseInstant('2026-10-01T06:00:00.000+02:00')

    assert.isTrue(parsed.isValid)
    assert.equal(parsed.toMillis(), DateTime.fromISO('2026-10-01T04:00:00.000Z').toMillis())
  })
})
