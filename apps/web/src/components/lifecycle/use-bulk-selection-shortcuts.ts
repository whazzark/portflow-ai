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
  /**
   * Limits the shortcut to presses made while focus is inside this element.
   *
   * Passed only where a single screen offers two selectable collections at once — the transport
   * companies and the trucks of `/transport-resources` — because there "everything the
   * administrator is looking at" has two answers and only the focused one can be meant. A screen
   * with one collection passes nothing and keeps the shortcut available from anywhere, which is
   * what makes it discoverable in the first place.
   */
  scopeRef?: RefObject<HTMLElement | null>
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
      // `activeElement` rather than the event target: a press made with nothing focused targets
      // `body`, which no scope contains, and would otherwise fire every scoped listener at once.
      if (scopeRef && !scopeRef.current?.contains(document.activeElement)) {
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
 */
export function useClearSelectionShortcut({
  enabled,
  onClear,
}: {
  enabled: boolean
  onClear: () => void
}) {
  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClear()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onClear])
}
