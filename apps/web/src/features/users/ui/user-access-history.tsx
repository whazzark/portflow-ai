import { formatFullName } from '@/features/users/helpers/name'
import type { UserDto } from '@/features/users/types'
import { formatDateTime } from '@/helpers/dates'

type LifecycleActor = { id: string; firstName: string; lastName: string } | null | undefined

type AccessEvent = {
  key: string
  label: string
  at: string | null | undefined
  by: LifecycleActor
}

/**
 * Oldest first: the record reads as how the current access status was reached, and read as a story
 * it runs forward. Site references order newest first because their pane answers a different
 * question — the transition the record currently sits in.
 */
function recordedEvents(user: UserDto): AccessEvent[] {
  const entry = user as UserDto & Record<string, unknown>

  return (
    [
      { key: 'invited', label: 'Invited', at: entry.invitedAt, by: entry.invitedBy },
      { key: 'activated', label: 'Activated', at: entry.activatedAt, by: entry.activatedBy },
      { key: 'cancelled', label: 'Cancelled', at: entry.cancelledAt, by: entry.cancelledBy },
      {
        key: 'deactivated',
        label: 'Deactivated',
        at: entry.deactivatedAt,
        by: entry.deactivatedBy,
      },
      {
        key: 'reactivated',
        label: 'Reactivated',
        at: entry.reactivatedAt,
        by: entry.reactivatedBy,
      },
    ] as AccessEvent[]
  )
    .filter((event) => Boolean(event.at))
    .sort(
      (left, right) =>
        new Date(left.at as string).getTime() - new Date(right.at as string).getTime(),
    )
}

export function UserAccessHistory({ user }: { user: UserDto }) {
  const events = recordedEvents(user)

  // No lifecycle block at all — the viewer may not consult the access history — or nothing recorded
  // yet. Either way there is no history to present, and an empty list would imply otherwise.
  if (events.length === 0) {
    return null
  }

  return (
    <section className="grid gap-3">
      <h3 className="font-medium text-sm">Access history</h3>
      <ol aria-label="Access history" className="grid gap-4 text-sm">
        {events.map((event) => (
          <li className="grid gap-1" key={event.key}>
            <span className="font-medium">{event.label}</span>
            <span className="text-muted-foreground">{formatDateTime(event.at ?? null)}</span>
            {event.by && (
              <span className="text-muted-foreground">by {formatFullName(event.by)}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
