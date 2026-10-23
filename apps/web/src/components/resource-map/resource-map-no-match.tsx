import type { ReactNode } from 'react'

/** Shown over the map when a search matches nothing: names the search, says what it looked at, and
 * offers the ways out. */
export function ResourceMapNoMatch({
  title,
  explanation,
  actions,
}: {
  title: ReactNode
  explanation: ReactNode
  actions: ReactNode
}) {
  return (
    <div
      className="flex max-w-sm flex-col items-center gap-3 rounded-xl border bg-popover px-6 py-5 text-center text-popover-foreground shadow-lg"
      role="status"
    >
      <p className="font-heading font-semibold text-sm">{title}</p>
      <p className="text-muted-foreground text-sm">{explanation}</p>
      <div className="flex flex-wrap justify-center gap-2">{actions}</div>
    </div>
  )
}
