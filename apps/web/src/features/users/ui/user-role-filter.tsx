import { USER_ROLE_LABELS } from '@/features/users/helpers/user-labels'
import type { UserRoleFilter } from '@/features/users/helpers/user-search'
import { classnames } from '@/libraries/shadcn/helpers'

const ROLE_FILTER_OPTIONS: { label: string; value: UserRoleFilter }[] = [
  { label: 'All roles', value: 'all' },
  ...(Object.entries(USER_ROLE_LABELS) as [UserRoleFilter, string][]).map(([value, label]) => ({
    label,
    value,
  })),
]

/**
 * The role facet as a row of chips rather than a `Select`: four roles fit on one line, and every
 * one of them stays visible, so the administrator reads which role is narrowing the view without
 * opening anything. One chip is pressed at a time — `All roles` included — because the URL carries
 * a single `role`.
 */
export function UserRoleFilterChips({
  value,
  onValueChange,
}: {
  value: UserRoleFilter
  onValueChange: (value: UserRoleFilter) => void
}) {
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Filter by role</legend>
      {ROLE_FILTER_OPTIONS.map((option) => {
        const isPressed = option.value === value

        return (
          <button
            aria-pressed={isPressed}
            className={classnames(
              'h-[30px] rounded-full border px-3 font-medium text-[13px] text-foreground/80 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
              isPressed && 'border-primary bg-accent font-semibold text-foreground',
            )}
            key={option.value}
            onClick={() => onValueChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        )
      })}
    </fieldset>
  )
}
