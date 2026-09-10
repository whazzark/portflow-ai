import type { RefObject } from 'react'
import { useEffect } from 'react'

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null

  return (
    element !== null &&
    (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable)
  )
}

/**
 * Whether a scoped shortcut should stay out of this press.
 *
 * Read from `activeElement` rather than the event target: a press made with nothing focused targets
 * `body`, which no scope contains, and would otherwise fire every scoped listener at once.
 */
function isOutsideScope(scopeRef: RefObject<HTMLElement | null> | undefined) {
  return scopeRef !== undefined && !scopeRef.current?.contains(document.activeElement)
}

/**
 * Limits a shortcut to presses made while focus is inside this element.
 *
 * Passed only where a single screen offers two selectable collections at once — the transport
 * companies and the trucks of `/transport-resources` — because there "everything the administrator
 * is looking at" has two answers and only the focused one can be meant. A screen with one
 * collection passes nothing and keeps the shortcut available from anywhere, which is what makes it
 * discoverable in the first place.
 *
 * The element has to hold the whole collection, not just its list: after a partial bulk outcome
 * focus sits on the floating toolbar's own buttons, and a scope that stopped at the directory would
 * make the keystroke go dead exactly there.
 */
type SelectionScopeRef = RefObject<HTMLElement | null>

/**
 * Ctrl/Cmd+A selects everything the administrator is currently looking at, entering select mode on
 * the fly so they never have to reach for the map control first.
 *
 * Ignored while a text field has focus, so the browser's native "select all text" keeps working
 * there. The caller decides what "all" means and whether the shortcut applies at all.
 */
export function useSelectAllShortcut({
  enabled,
  onSelectAll,
  scopeRef,
}: {
  enabled: boolean
  onSelectAll: (event: KeyboardEvent) => void
  /** See {@link SelectionScopeRef}. */
  scopeRef?: SelectionScopeRef
}) {
  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a')) {
        return
      }
      if (isEditableTarget(event.target)) {
        return
      }
      if (isOutsideScope(scopeRef)) {
        return
      }

      onSelectAll(event)
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onSelectAll, scopeRef])
}

/**
 * Escape clears an in-progress selection without leaving select mode — the keyboard counterpart of
 * the bulk action bar's "Clear selection" button.
 *
 * Callers pass `enabled: false` once nothing is checked, so a second Escape falls through to
 * whatever else Escape already does (closing a menu, for instance) rather than being swallowed.
 *
 * Scoped by the same rule as the select-all above, and for the same reason: where two collections
 * are selectable at once, one Escape must not empty both.
 */
export function useClearSelectionShortcut({
  enabled,
  onClear,
  scopeRef,
}: {
  enabled: boolean
  onClear: () => void
  /** See {@link SelectionScopeRef}. */
  scopeRef?: SelectionScopeRef
}) {
  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isOutsideScope(scopeRef)) {
        return
      }

      onClear()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onClear, scopeRef])
}
