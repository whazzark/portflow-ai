import type { HttpContext } from '@adonisjs/core/http'

import type User from '#models/user'

/**
 * Which reactivation a session was opened under — the rule API ADR-0015 records.
 *
 * Sessions live in the cookie (API ADR-0001), so the server holds nothing it could delete to end
 * one, and `clearWithBrowser` gives the cookie no expiry: a browser left open keeps its session.
 * While its user is deactivated that session is refused because the user is not active — but the
 * moment a reactivation makes them active again, the very same cookie would authenticate, and the
 * renewal step it is confined to would hand the choice of their new password to whoever holds that
 * browser, without any password being presented.
 *
 * So every session records the user's `reactivated_at` as it is opened, and `open_session.ts`
 * refuses one whose record no longer matches. The comparison is equality on the stored value, not a
 * clock comparison: both sides read the same column, a reactivation always writes a new value into
 * it, and nothing else ever writes it. A session with no record reads as `null`, which is what a user
 * never reactivated has — so nothing changes for them, and a `loginAs` in a test models a session
 * opened *before* a reactivation, not a shortcut to a valid one.
 */
export const REACTIVATION_SESSION_KEY = 'user_reactivated_at'

type Session = HttpContext['session']

function reactivationOf(user: User): number | null {
  return user.reactivatedAt?.toMillis() ?? null
}

/**
 * Called wherever a session comes into being: login, invitation acceptance, and restoration. A user
 * never reactivated is recorded by the key's absence — the session store refuses `null`, and absent
 * already reads as `null` — which also clears whatever a stale session left behind.
 */
export function recordSessionReactivation(session: Session, user: User) {
  const reactivation = reactivationOf(user)

  if (reactivation === null) {
    session.forget(REACTIVATION_SESSION_KEY)

    return
  }

  session.put(REACTIVATION_SESSION_KEY, reactivation)
}

export function matchesSessionReactivation(session: Session, user: User) {
  return (session.get(REACTIVATION_SESSION_KEY) ?? null) === reactivationOf(user)
}

/**
 * Whether a remembered connection may open a session under the user's latest reactivation — asked
 * only on restoration, where the session is recorded from the user on the very same request and the
 * equality above can therefore say nothing.
 *
 * A reactivation revokes every remembered connection made before it, so a surviving one always
 * qualifies; this asks the credential itself rather than trusting that revocation, so the rule still
 * holds here if a future write ever leaves a connection standing across a reactivation. The
 * comparison is a clock one, unlike `matchesSessionReactivation`: the two sides are different
 * columns, and a connection made after the reactivation carries no copy of it.
 */
export function rememberedConnectionMatchesReactivation(
  rememberedConnection: { createdAt: Date } | null,
  user: User,
) {
  const reactivation = reactivationOf(user)

  if (reactivation === null) {
    return true
  }

  return rememberedConnection !== null && rememberedConnection.createdAt.getTime() >= reactivation
}
