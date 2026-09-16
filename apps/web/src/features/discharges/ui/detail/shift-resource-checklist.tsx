import { type ReactNode, useId } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

export type ChecklistRow = {
  id: string
  /** How the row is named to assistive technology: `Select {name}`. */
  name: string
  label: ReactNode
  /** A fact read with the row, under its label: the lot holding a door. */
  description?: string
  /** False for a resource that may stay selected but not be newly chosen, such as a suspended one. */
  canCheck: boolean
}

type ShiftResourceChecklistProps = {
  /** The list's accessible name, and its heading. */
  label: string
  rows: ChecklistRow[]
  selected: readonly string[]
  onChange: (ids: string[]) => void
  /** The reason each refused resource carries, by identity. */
  reasons?: ReadonlyMap<string, string>
  /** Why some rows cannot be newly chosen, shown when one of them is listed. */
  lockedNote: string
  /** Shown in place of the list when it offers nothing. */
  empty: ReactNode
  loading?: boolean
  onRetry?: () => void
}

/**
 * One kind of resource a shift uses, chosen by ticking it. The order of `rows` is kept in what is
 * submitted, so a refusal reported at a position finds its row again.
 */
export function ShiftResourceChecklist({
  empty,
  label,
  loading = false,
  lockedNote,
  onChange,
  onRetry,
  reasons,
  rows,
  selected,
}: ShiftResourceChecklistProps) {
  const headingId = useId()
  const noteId = useId()
  const chosen = new Set(selected)

  const checkableIds = rows.filter((row) => row.canCheck).map((row) => row.id)
  const allSelected = checkableIds.length > 0 && checkableIds.every((id) => chosen.has(id))
  const someSelected = checkableIds.some((id) => chosen.has(id))

  const commit = (next: Set<string>) =>
    onChange(rows.map((row) => row.id).filter((id) => next.has(id)))

  const toggle = (row: ChecklistRow) => {
    const next = new Set(chosen)
    if (next.has(row.id)) {
      next.delete(row.id)
    } else if (row.canCheck) {
      next.add(row.id)
    }
    commit(next)
  }

  const toggleAll = (checked: boolean) => {
    const next = new Set(chosen)
    for (const id of checkableIds) {
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
    }
    commit(next)
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-sm" id={headingId}>
          {label}
        </h3>
        {rows.length > 0 && (
          <span className="text-muted-foreground text-xs tabular-nums">{chosen.size} selected</span>
        )}
      </div>
      {rows.length === 0 ? (
        loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : onRetry ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Unable to load</span>
            <Button onClick={onRetry} size="sm" type="button" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          empty
        )
      ) : (
        <div className="flex flex-col gap-1 rounded-lg border p-2">
          <div className="flex items-center gap-2 border-b px-2 pb-2">
            <Checkbox
              aria-checked={someSelected && !allSelected ? 'mixed' : allSelected}
              aria-label={`Select all ${label.toLowerCase()}`}
              checked={allSelected}
              disabled={checkableIds.length === 0}
              onCheckedChange={(checked) => toggleAll(checked === true)}
            />
            <span className="text-muted-foreground text-xs">Select all</span>
          </div>
          <ul aria-label={label} className="grid gap-1">
            {rows.map((row) => {
              const reason = reasons?.get(row.id)
              const reasonId = `${noteId}-${row.id}-reason`
              const descriptionId = `${noteId}-${row.id}-description`
              const describedBy = [
                row.description ? descriptionId : null,
                reason ? reasonId : null,
                row.canCheck ? null : noteId,
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <li className="flex items-start gap-3 rounded-md px-2 py-1.5" key={row.id}>
                  <Checkbox
                    aria-describedby={describedBy || undefined}
                    aria-label={`Select ${row.name}`}
                    checked={chosen.has(row.id)}
                    className="mt-0.5"
                    disabled={!row.canCheck && !chosen.has(row.id)}
                    onCheckedChange={() => toggle(row)}
                  />
                  <div className="grid min-w-0 gap-0.5 text-sm">
                    {row.label}
                    {row.description && (
                      <span className="text-muted-foreground" id={descriptionId}>
                        {row.description}
                      </span>
                    )}
                    {reason && (
                      <span className="text-destructive" id={reasonId}>
                        {reason}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {rows.some((row) => !row.canCheck) && (
            <p className="px-2 pt-1 text-muted-foreground text-xs" id={noteId}>
              {lockedNote}
            </p>
          )}
        </div>
      )}
      {loading && rows.length > 0 && <p className="text-muted-foreground text-xs">Loading…</p>}
    </section>
  )
}
