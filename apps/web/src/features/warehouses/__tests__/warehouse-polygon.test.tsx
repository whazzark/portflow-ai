import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { WarehouseMarkerSymbol } from '@/features/warehouses/map/warehouse-marker-symbol'
import { WarehousePolygons } from '@/features/warehouses/map/warehouse-polygon'
import { WAREHOUSES } from './support/fixtures'

const { mapGeoJsonMock } = vi.hoisted(() => ({ mapGeoJsonMock: vi.fn() }))

vi.mock('@/components/ui/map', () => ({
  MapGeoJSON: (props: unknown) => {
    mapGeoJsonMock(props)
    return null
  },
  MapMarker: ({ children }: { children: ReactNode }) => (
    <div data-testid="warehouse-marker">{children}</div>
  ),
  MapPopup: () => null,
  MarkerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

describe('warehouse polygon selection', () => {
  test('uses the shared warehouse symbol for available and archived markers', () => {
    const { container } = render(
      <>
        <WarehouseMarkerSymbol compact status="AVAILABLE" />
        <WarehouseMarkerSymbol status="ARCHIVED" />
      </>,
    )

    expect(container.querySelector('[data-warehouse-status="AVAILABLE"]')).toHaveClass(
      'bg-primary',
      'rounded-full',
      'size-6',
    )
    const archivedSymbol = container.querySelectorAll('[data-warehouse-status]')[1]
    expect(archivedSymbol).toHaveAttribute('data-warehouse-status', 'ARCHIVED')
    expect(archivedSymbol).toHaveClass('border-dashed', 'bg-background/95')
  })

  test('uses the status colors from the warehouse legend', () => {
    render(
      <WarehousePolygons
        warehouses={WAREHOUSES.map((warehouse) => ({ ...warehouse, isSearchMatch: true }))}
        onSelect={vi.fn()}
      />,
    )

    expect(mapGeoJsonMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        fillPaint: expect.objectContaining({ 'fill-color': '#0f6e8c' }),
        linePaint: expect.objectContaining({ 'line-color': '#0b4f63' }),
      }),
    )
    expect(mapGeoJsonMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        fillPaint: expect.objectContaining({ 'fill-color': '#f5f7f8' }),
        linePaint: expect.objectContaining({ 'line-color': '#5b6b7a' }),
      }),
    )
  })

  test('selects an available warehouse from its marker', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <WarehousePolygons
        warehouses={[{ ...WAREHOUSES[0], isSearchMatch: true }]}
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'View warehouse North Shed (Available)' }))

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'North Shed' }))
  })

  test('does not propagate marker activation to the footprint layer', async () => {
    const user = userEvent.setup()
    const onMapClick = vi.fn()
    const onSelect = vi.fn()

    render(
      <div onClick={onMapClick} onKeyDown={() => undefined} role="application">
        <WarehousePolygons
          warehouses={[{ ...WAREHOUSES[0], isSearchMatch: true }]}
          onSelect={onSelect}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: 'View warehouse North Shed (Available)' }))

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onMapClick).not.toHaveBeenCalled()
  })

  test('uses the shared marker silhouette and hides the selected warehouse marker', () => {
    render(
      <WarehousePolygons
        warehouses={WAREHOUSES.map((warehouse) => ({ ...warehouse, isSearchMatch: true }))}
        onSelect={vi.fn()}
        selectedId={WAREHOUSES[0].id}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'View warehouse North Shed (Available)' }),
    ).not.toBeInTheDocument()
    const marker = screen.getByRole('button', { name: 'View warehouse Retired Shed (Archived)' })
    expect(marker.className).toContain('size-11')
    const symbol = marker.querySelector('[data-warehouse-status]')
    expect(symbol).toHaveAttribute('data-warehouse-status', 'ARCHIVED')
    expect(symbol).toHaveClass('border-dashed', 'bg-background/95')
    expect(marker.querySelector('svg')).toBeInTheDocument()
  })
})
