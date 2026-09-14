import User from '#models/user'

/**
 * Takes the organization admin role away from every user who holds it with an active access, and
 * hands back the function that gives it to exactly those users again.
 *
 * The final organization admin rule counts the whole user population, and the suites share one
 * in-memory database that no file resets: an active admin left behind by another file would count
 * too, and every "last admin" test would then pass for the wrong reason — nothing would ever be the
 * last. Hiding them lets a test own the population it reasons about.
 *
 * The role moves rather than the access status, because `role` carries no lifecycle columns that a
 * deactivation would have to keep consistent. Inside a global transaction the restore is redundant —
 * the rollback does it — and harmless.
 */
export async function hideActiveOrganizationAdmins(): Promise<() => Promise<void>> {
  const hidden = await User.query()
    .where('role', 'ORGANIZATION_ADMIN')
    .where('accessStatus', 'ACTIVE')
    .select('id')
  const ids = hidden.map((user) => user.id)

  if (ids.length > 0) {
    await User.query().whereIn('id', ids).update({ role: 'OPERATIONS_ADMIN' })
  }

  return async () => {
    if (ids.length > 0) {
      await User.query().whereIn('id', ids).update({ role: 'ORGANIZATION_ADMIN' })
    }
  }
}
