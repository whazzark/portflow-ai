import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { WarehouseMap } from '@/features/warehouses/map/warehouse-map'
import { presentWarehouses } from '@/features/warehouses/warehouse-search'
import { WAREHOUSES } from './support/fixtures'

const { fitBoundsMock, mapMock } = vi.hoisted(() => {
  const fitBoundsMock = vi.fn()

  return {
    fitBoundsMock,
    mapMock: {
      easeTo: vi.fn(),
      fitBounds: fitBoundsMock,
    },
  }
})

vi.mock('@/components/ui/map', () => ({
  Map: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MapControls: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ isLoaded: true, map: mapMock }),
  ControlGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ControlButton: ({ children, label }: { children: React.ReactNode; label: string }) => (
    <button aria-label={label} type="button">
      {children}
    </button>
  ),
}))

vi.mock('@/features/warehouse-doors/map/warehouse-door-marker', () => ({
  WarehouseDoorMarker: () => null,
}))

vi.mock('@/features/warehouses/map/warehouse-polygon', () => ({
  WarehousePolygons: () => null,
}))

describe('warehouse map framing', () => {
  const warehouses = presentWarehouses(WAREHOUSES, 'all', '')

  beforeEach(() => {
    fitBoundsMock.mockReset()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  })

  test('keeps the selected footprint visible beside the desktop details panel', async () => {
    render(
      <WarehouseMap
        detailsPanelSide="right"
        onSelect={vi.fn()}
        selected={warehouses[0]}
        warehouses={warehouses}
      />,
    )

    await waitFor(() =>
      expect(fitBoundsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          padding: { bottom: 56, left: 56, right: 568, top: 56 },
        }),
      ),
    )
  })

  test('keeps the selected footprint visible above the mobile details panel', async () => {
    render(
      <WarehouseMap
        detailsPanelSide="bottom"
        onSelect={vi.fn()}
        selected={warehouses[0]}
        warehouses={warehouses}
      />,
    )

    await waitFor(() =>
      expect(fitBoundsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          padding: { bottom: 656, left: 56, right: 56, top: 56 },
        }),
      ),
    )
  })

  // The page presents its warehouses afresh on every render, so a fit keyed by prop identity would
  // replay on every state change — every point a door placement puts down, every coordinate typed —
  // and haul the view back from wherever the administrator had panned or zoomed it.
  test('leaves the view alone when a render only rebuilds the same warehouses', async () => {
    const { rerender } = render(
      <WarehouseMap
        detailsPanelSide="right"
        onSelect={vi.fn()}
        selected={warehouses[0]}
        warehouses={warehouses}
      />,
    )

    await waitFor(() => expect(fitBoundsMock).toHaveBeenCalledTimes(1))

    const presentedAgain = presentWarehouses(WAREHOUSES, 'all', '')
    rerender(
      <WarehouseMap
        detailsPanelSide="right"
        onSelect={vi.fn()}
        selected={presentedAgain[0]}
        warehouses={presentedAgain}
      />,
    )

    expect(fitBoundsMock).toHaveBeenCalledTimes(1)
  })

  test('retains balanced overview framing without a selected warehouse', async () => {
    render(<WarehouseMap onSelect={vi.fn()} warehouses={warehouses} />)

    await waitFor(() =>
      expect(fitBoundsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ padding: 56 }),
      ),
    )
  })
})

/** `WarehousePolygons` is stubbed out above, so the sr-only warehouse list is what stands in for a
 * polygon click here — the two read the same `suppressesSelection`, which is the point. */
describe('warehouse selection while doors are checkable', () => {
  const warehouses = presentWarehouses(WAREHOUSES, 'all', '')
  const listedWarehouse = () => screen.getByRole('button', { name: /North Shed/ })

  test('keeps the warehouses selectable while the door checkboxes are merely offered', () => {
    // `doorSelectMode` is true for every open available warehouse — checking is offered, never
    // entered — so on its own it must cost the administrator nothing.
    render(
      <WarehouseMap
        checkedDoorIds={new Set()}
        doorSelectMode
        onSelect={vi.fn()}
        selected={warehouses[0]}
        warehouses={warehouses}
      />,
    )

    expect(listedWarehouse()).toBeEnabled()
  })

  test('suppresses warehouse selection once a door is actually checked', () => {
    render(
      <WarehouseMap
        checkedDoorIds={new Set([(WAREHOUSES[0].doors ?? [])[0].id])}
        doorSelectMode
        onSelect={vi.fn()}
        selected={warehouses[0]}
        warehouses={warehouses}
      />,
    )

    expect(listedWarehouse()).toBeDisabled()
  })
})
