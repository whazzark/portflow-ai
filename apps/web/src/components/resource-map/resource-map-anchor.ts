/** A point in the map container's own pixel space, as `map.project()` reports it. */
export type ResourceMapAnchor = { x: number; y: number }

type Size = { width: number; height: number }

/** Space between the anchored point and the card's nearest edge. */
export const RESOURCE_MAP_CARD_GAP = 24
/** Minimum distance kept between the card and every edge of the map. */
export const RESOURCE_MAP_CARD_INSET = 16
/** Below this container width the card stops floating beside its anchor and docks to the bottom,
 * matching Tailwind's `md` breakpoint. */
export const RESOURCE_MAP_CARD_DOCK_BELOW = 768

export type ResourceMapCardPlacement =
  | { layout: 'floating'; left: number; top: number }
  /** Pinned to the bottom of the map, full width: a narrow map has no room beside the anchor. */
  | { layout: 'docked' }
  /** No anchor to follow — the map is not rendered (feature tests, map unavailable) — so the card
   * takes a fixed top-right position. */
  | { layout: 'fallback' }

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/**
 * Where a card anchored to a map feature goes: beside the anchor on its right, flipped to its left
 * when the right would overflow, and clamped so the card always stays fully inside the map.
 */
export function computeResourceMapCardPlacement({
  anchor,
  container,
  card,
}: {
  anchor: ResourceMapAnchor | null
  container: Size
  card: Size
}): ResourceMapCardPlacement {
  if (container.width < RESOURCE_MAP_CARD_DOCK_BELOW) {
    return { layout: 'docked' }
  }
  if (!anchor) {
    return { layout: 'fallback' }
  }

  const maxLeft = container.width - RESOURCE_MAP_CARD_INSET - card.width
  const maxTop = container.height - RESOURCE_MAP_CARD_INSET - card.height
  const right = anchor.x + RESOURCE_MAP_CARD_GAP
  const left = anchor.x - RESOURCE_MAP_CARD_GAP - card.width
  const preferred = right <= maxLeft ? right : left >= RESOURCE_MAP_CARD_INSET ? left : right

  return {
    layout: 'floating',
    left: clamp(preferred, RESOURCE_MAP_CARD_INSET, maxLeft),
    top: clamp(anchor.y - card.height / 2, RESOURCE_MAP_CARD_INSET, maxTop),
  }
}
