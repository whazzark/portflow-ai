import { formatFullName } from '@/features/users/helpers/name'
import { UserAvatar } from '@/features/users/ui/user-avatar'
import { formatShortDate } from '@/helpers/dates'

type ResourceActorProps = {
  /** The user who recorded the change; `null` when it never happened or is not resolved. */
  actor: { firstName: string; lastName: string } | null | undefined
  /** When they recorded it, read as a short date after the name. */
  at?: string | null
  /** What sits between the name and the date: a middle dot in a running line, a space in a column
   * that already reads as "who, when". */
  separator?: '·' | ' '
}

/**
 * Who recorded a change, and when: the avatar and full name, then the date in muted text. A
 * transition that never happened reads as an em dash, the way every empty cell of a directory does;
 * one whose author the read contract did not resolve still says when it happened.
 */
export function ResourceActor({ actor, at, separator = '·' }: ResourceActorProps) {
  const date = formatShortDate(at ?? null)
  const dateText = date && (
    <span className="shrink-0 whitespace-nowrap text-muted-foreground tabular-nums">
      {separator === '·' ? `· ${date}` : date}
    </span>
  )

  if (!actor) {
    return date ? (
      <span className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">Unknown</span>
        {dateText}
      </span>
    ) : (
      <span className="text-muted-foreground">—</span>
    )
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      <UserAvatar aria-hidden={true} size="sm" user={actor} />
      <span className="truncate">{formatFullName(actor)}</span>
      {dateText}
    </span>
  )
}
