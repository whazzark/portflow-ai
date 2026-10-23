import { describe, expect, test } from 'vitest'
import {
  computeResourceMapCardPlacement,
  RESOURCE_MAP_CARD_GAP,
  RESOURCE_MAP_CARD_INSET,
} from '../resource-map-anchor'

const container = { width: 1200, height: 800 }
const card = { width: 360, height: 300 }

describe('computeResourceMapCardPlacement', () => {
  test('places the card to the right of the anchor, vertically centred on it', () => {
    expect(
      computeResourceMapCardPlacement({ anchor: { x: 400, y: 400 }, container, card }),
    ).toEqual({
      layout: 'floating',
      left: 400 + RESOURCE_MAP_CARD_GAP,
      top: 400 - card.height / 2,
    })
  })

  test('flips to the left of the anchor when the right side would overflow', () => {
    expect(
      computeResourceMapCardPlacement({ anchor: { x: 1000, y: 400 }, container, card }),
    ).toMatchObject({ layout: 'floating', left: 1000 - RESOURCE_MAP_CARD_GAP - card.width })
  })

  test('clamps the card inside the container when neither side fits', () => {
    const wideCard = { width: 500, height: 300 }
    const placement = computeResourceMapCardPlacement({
      anchor: { x: 400, y: 20 },
      container: { width: 800, height: 800 },
      card: wideCard,
    })

    expect(placement).toEqual({
      layout: 'floating',
      left: 800 - RESOURCE_MAP_CARD_INSET - wideCard.width,
      top: RESOURCE_MAP_CARD_INSET,
    })
  })

  test('clamps the bottom edge inside the container', () => {
    const placement = computeResourceMapCardPlacement({
      anchor: { x: 400, y: 790 },
      container,
      card,
    })

    expect(placement).toMatchObject({
      layout: 'floating',
      top: container.height - RESOURCE_MAP_CARD_INSET - card.height,
    })
  })

  test('docks to the bottom below the medium breakpoint', () => {
    expect(
      computeResourceMapCardPlacement({
        anchor: { x: 100, y: 100 },
        container: { width: 390, height: 700 },
        card,
      }),
    ).toEqual({ layout: 'docked' })
  })

  test('falls back to the top-right corner without an anchor', () => {
    expect(computeResourceMapCardPlacement({ anchor: null, container, card })).toEqual({
      layout: 'fallback',
    })
  })
})
