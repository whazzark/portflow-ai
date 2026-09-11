/**
 * Whether a write was refused because another row still references the one it touched — a
 * `RESTRICT` foreign key standing in the way of a delete.
 *
 * PostgreSQL reports every foreign-key violation as `23503`. SQLite — only once the connection
 * enabled `foreign_keys`, which `config/database.ts` does — reports a deferred `NO ACTION` check as
 * `SQLITE_CONSTRAINT_FOREIGNKEY`, but enforces `ON DELETE RESTRICT` through an internal trigger and
 * reports it as `SQLITE_CONSTRAINT_TRIGGER`. That code is shared with a user-defined `RAISE`, so it
 * only counts here together with SQLite's own foreign-key message.
 */
export default function isForeignKeyViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as { code?: string; message?: string }

  if (candidate.code === '23503' || candidate.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return true
  }

  return (
    candidate.code === 'SQLITE_CONSTRAINT_TRIGGER' &&
    (candidate.message ?? '').includes('FOREIGN KEY constraint failed')
  )
}
