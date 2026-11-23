import { describe, expect, test } from 'vitest'
import { computeResourceMapCardPlacement } from '@/components/resource-map/resource-map-anchor'

const container = { width: 1200, height: 800 }
const card = { width: 360, height: 400 }
const breakpoint = 768

describe('card placement', () => {
  test('sits to the right of a point anchor with a gap', () => {
    expect(
      computeResourceMapCardPlacement({ anchor: { x: 300, y: 300 }, container, card, breakpoint }),
    ).toEqual({ kind: 'floating', left: 316, top: 100 })
  })

  test('flips to the left when the right side would overflow', () => {
    expect(
      computeResourceMapCardPlacement({ anchor: { x: 1000, y: 300 }, container, card, breakpoint }),
    ).toEqual({ kind: 'floating', left: 624, top: 100 })
  })

  test('clamps inside the container', () => {
    expect(
      computeResourceMapCardPlacement({ anchor: { x: 300, y: 20 }, container, card, breakpoint }),
    ).toEqual({ kind: 'floating', left: 316, top: 16 })
  })

  test('sits beside a rectangular anchor without covering it', () => {
    const placement = computeResourceMapCardPlacement({
      anchor: { x: 200, y: 200, width: 300, height: 200 },
      container,
      card,
      breakpoint,
    })

    expect(placement).toEqual({ kind: 'floating', left: 516, top: 100 })
  })

  test('flips beside a rectangular anchor', () => {
    expect(
      computeResourceMapCardPlacement({
        anchor: { x: 600, y: 200, width: 400, height: 200 },
        container,
        card,
        breakpoint,
      }),
    ).toEqual({ kind: 'floating', left: 224, top: 100 })
  })

  test('docks at the bottom below the breakpoint', () => {
    expect(
      computeResourceMapCardPlacement({
        anchor: { x: 100, y: 100 },
        container: { width: 390, height: 700 },
        card,
        breakpoint,
      }),
    ).toEqual({ kind: 'docked' })
  })

  test('falls back to the top-right corner without an anchor', () => {
    expect(computeResourceMapCardPlacement({ anchor: null, container, card, breakpoint })).toEqual({
      kind: 'fallback',
    })
  })
})
