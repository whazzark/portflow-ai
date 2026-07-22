import { test } from '@japa/runner'
import isUniqueViolation from '#shared/database/is_unique_violation'

test.group('isUniqueViolation', () => {
  test('recognizes PostgreSQL unique violations', ({ assert }) => {
    assert.isTrue(isUniqueViolation({ code: '23505' }))
  })

  test('recognizes SQLite unique violations', ({ assert }) => {
    assert.isTrue(isUniqueViolation({ code: 'SQLITE_CONSTRAINT_UNIQUE' }))
  })

  test('ignores other errors and non-object values', ({ assert }) => {
    assert.isFalse(isUniqueViolation({ code: '23503' }))
    assert.isFalse(isUniqueViolation(new Error('duplicate')))
    assert.isFalse(isUniqueViolation(null))
    assert.isFalse(isUniqueViolation('23505'))
  })
})
