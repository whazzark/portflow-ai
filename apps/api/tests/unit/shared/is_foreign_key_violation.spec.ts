import { test } from '@japa/runner'
import isForeignKeyViolation from '#shared/database/is_foreign_key_violation'

test.group('isForeignKeyViolation', () => {
  // The only branch production reaches; the SQLite suites never raise it.
  test('recognizes PostgreSQL foreign-key violations', ({ assert }) => {
    assert.isTrue(isForeignKeyViolation({ code: '23503' }))
  })

  test('recognizes a SQLite deferred foreign-key violation', ({ assert }) => {
    assert.isTrue(isForeignKeyViolation({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' }))
  })

  test('recognizes a SQLite ON DELETE RESTRICT refusal by its message', ({ assert }) => {
    assert.isTrue(
      isForeignKeyViolation({
        code: 'SQLITE_CONSTRAINT_TRIGGER',
        message: 'delete from `users` where … - FOREIGN KEY constraint failed',
      }),
    )
  })

  // The trigger code is shared with a user-defined RAISE, which is no foreign-key refusal.
  test('ignores a SQLite trigger refusal that is not a foreign key', ({ assert }) => {
    assert.isFalse(isForeignKeyViolation({ code: 'SQLITE_CONSTRAINT_TRIGGER', message: 'nope' }))
    assert.isFalse(isForeignKeyViolation({ code: 'SQLITE_CONSTRAINT_TRIGGER' }))
  })

  test('ignores other errors and non-object values', ({ assert }) => {
    assert.isFalse(isForeignKeyViolation({ code: '23505' }))
    assert.isFalse(isForeignKeyViolation({ code: 'SQLITE_CONSTRAINT_UNIQUE' }))
    assert.isFalse(isForeignKeyViolation(new Error('FOREIGN KEY constraint failed')))
    assert.isFalse(isForeignKeyViolation(null))
    assert.isFalse(isForeignKeyViolation('23503'))
  })
})
