/** A point on the map area in CSS pixels, or the box an outline occupies there. A point is a box
 * of zero size, so a card can sit beside either without covering it. */
export type ResourceMapAnchor = { x: number; y: number; width?: number; height?: number }

export type ResourceMapCardPlacement =
  | { kind: 'floating'; left: number; top: number }
  | { kind: 'docked' }
  | { kind: 'fallback' }

const GAP = 16
const MARGIN = 16

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/**
 * Where an anchored card goes: beside its anchor (right first, left when the right would overflow),
 * vertically centred on it, then clamped inside the map area. Below the breakpoint the card docks at
 * the bottom instead; with no anchor — a map that never rendered, or the mocked map in tests — it
 * falls back to a fixed corner.
 */
export function computeResourceMapCardPlacement({
  anchor,
  container,
  card,
  breakpoint,
}: {
  anchor: ResourceMapAnchor | null
  container: { width: number; height: number }
  card: { width: number; height: number }
  breakpoint: number
}): ResourceMapCardPlacement {
  if (container.width < breakpoint) {
    return { kind: 'docked' }
  }
  if (!anchor) {
    return { kind: 'fallback' }
  }

  const width = anchor.width ?? 0
  const height = anchor.height ?? 0
  const right = anchor.x + width + GAP
  const fitsRight = right + card.width <= container.width - MARGIN
  const left = fitsRight ? right : anchor.x - GAP - card.width
  const top = anchor.y + height / 2 - card.height / 2

  return {
    kind: 'floating',
    left: clamp(left, MARGIN, Math.max(MARGIN, container.width - MARGIN - card.width)),
    top: clamp(top, MARGIN, Math.max(MARGIN, container.height - MARGIN - card.height)),
  }
}
