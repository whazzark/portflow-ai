import { useCallback, useMemo, useState } from 'react'

/**
 * The selection behind every bulk lifecycle action.
 *
 * Four directories had written this out separately, with four different callback shapes — one took
 * the whole next list of ids, one a `(checked, ids)` pair, two a toggle plus a select-all. The
 * behaviour was the same in all four; only the spelling differed, which is what made each new
 * directory reinvent it. Everything a resource still decides for itself — which rows are eligible,
 * which are currently visible — stays with the caller.
 */
export function useBulkSelection() {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (!next.delete(id)) {
        next.add(id)
      }
      return next
    })
  }, [])

  /** Checks or unchecks a whole visible page at once, for a "Select all" control. */
  const toggleMany = useCallback((ids: readonly string[], checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      for (const id of ids) {
        if (checked) {
          next.add(id)
        } else {
          next.delete(id)
        }
      }
      return next
    })
  }, [])

  const clear = useCallback(() => setSelectedIds(new Set()), [])

  /**
   * Narrows the selection to the ids given, rather than emptying it.
   *
   * This is what every directory already did after a partial bulk outcome: the blocked records
   * stay checked so the administrator can resolve the blocker and retry exactly those, without
   * finding them again one by one.
   */
  const retainOnly = useCallback((ids: readonly string[]) => setSelectedIds(new Set(ids)), [])

  return useMemo(
    () => ({ selectedIds, toggle, toggleMany, clear, retainOnly }),
    [selectedIds, toggle, toggleMany, clear, retainOnly],
  )
}
