import type { ReactNode } from 'react'

/** What a search that matched nothing says, and the ways out of it. */
export function ResourceMapNoMatch({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div
      className="w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border bg-popover/95 p-4 text-popover-foreground shadow-md backdrop-blur"
      role="status"
    >
      <p className="font-medium text-sm">{title}</p>
      {description && <p className="mt-1 text-muted-foreground text-xs">{description}</p>}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
