import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditablePolygonPlacement } from '../resource-map-polygon-editing'

const mapStub = {
  getCanvas: () => ({ style: {} as CSSStyleDeclaration }),
  on: vi.fn(),
  off: vi.fn(),
}

vi.mock('@/components/ui/map', () => ({
  useMap: () => ({ map: mapStub, isLoaded: true }),
  MapGeoJSON: ({
    id,
    data,
  }: {
    id?: string
    data: { features: { geometry: { type: string; coordinates: unknown } }[] }
  }) => (
    <div
      data-coordinates={JSON.stringify(data.features[0]?.geometry.coordinates ?? null)}
      data-geometry={data.features[0]?.geometry.type}
      data-testid={id}
    />
  ),
  MapMarker: ({
    latitude,
    longitude,
    draggable,
    onDragEnd,
    children,
  }: {
    latitude: number
    longitude: number
    draggable?: boolean
    onDragEnd?: (lngLat: { lng: number; lat: number }) => void
    children?: React.ReactNode
  }) => (
    <div data-draggable={draggable} data-lat={latitude} data-lng={longitude} data-testid="marker">
      <button onClick={() => onDragEnd?.({ lat: latitude + 1, lng: longitude + 1 })} type="button">
        drag {latitude},{longitude}
      </button>
      {children}
    </div>
  ),
  MarkerContent: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

/** A closed square: four boundary points, therefore four edges including the implied closing one. */
const square = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 4 },
  { latitude: 4, longitude: 4 },
  { latitude: 4, longitude: 0 },
]

const triangle = square.slice(0, 3)

const renderLayer = (props: Partial<Parameters<typeof EditablePolygonPlacement>[0]> = {}) =>
  render(
    <EditablePolygonPlacement
      onInsertPoint={vi.fn()}
      onMovePoint={vi.fn()}
      onRemovePoint={vi.fn()}
      points={square}
      {...props}
    />,
  )

describe('EditablePolygonPlacement', () => {
  beforeEach(() => {
    mapStub.on.mockClear()
    mapStub.off.mockClear()
  })

  it('never arms the map', () => {
    renderLayer()

    expect(mapStub.on).not.toHaveBeenCalled()
  })

  it('draws the ring as a closed polygon', () => {
    renderLayer()

    const outline = screen.getByTestId('editable-footprint')
    expect(outline).toHaveAttribute('data-geometry', 'Polygon')
    expect(outline).toHaveAttribute(
      'data-coordinates',
      JSON.stringify([
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
      ]),
    )
  })

  it('renders one draggable marker per boundary point and reports its index on drag', () => {
    const onMovePoint = vi.fn()
    renderLayer({ onMovePoint })

    expect(screen.getAllByRole('button', { name: /^Boundary point \d+$/ })).toHaveLength(4)

    fireEvent.click(screen.getByRole('button', { name: 'drag 0,4' }))
    expect(onMovePoint).toHaveBeenCalledWith(1, { latitude: 1, longitude: 5 })
  })

  it('offers exactly one insert handle per edge, closing edge included', () => {
    renderLayer()

    expect(
      screen.getAllByRole('button', { name: /^Insert boundary point on edge \d+$/ }),
    ).toHaveLength(4)
  })

  it('inserts at the midpoint of the designated edge, in that edge position', () => {
    const onInsertPoint = vi.fn()
    renderLayer({ onInsertPoint })

    // Edge 2 runs from point 2 (4,4) to point 3 (4,0): its midpoint is (4,2) and the new point
    // takes position 3, between them — not at the end of the boundary order.
    fireEvent.click(screen.getByRole('button', { name: 'Insert boundary point on edge 3' }))

    expect(onInsertPoint).toHaveBeenCalledWith(3, { latitude: 4, longitude: 2 })
  })

  it('inserts on the closing edge at the end of the boundary order', () => {
    const onInsertPoint = vi.fn()
    renderLayer({ onInsertPoint })

    // Edge 4 runs from the last point (4,0) back to the first (0,0).
    fireEvent.click(screen.getByRole('button', { name: 'Insert boundary point on edge 4' }))

    expect(onInsertPoint).toHaveBeenCalledWith(4, { latitude: 2, longitude: 0 })
  })

  it('does not let an insert click reach the map', () => {
    // MapLibre listens for clicks on the container its markers live in, so a click that kept
    // bubbling would insert a point *and* reach whatever the map does with a click.
    const containerClick = vi.fn()
    document.addEventListener('click', containerClick)

    try {
      renderLayer()
      fireEvent.click(screen.getByRole('button', { name: 'Insert boundary point on edge 1' }))

      expect(containerClick).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('click', containerClick)
    }
  })

  it('removes the designated boundary point', () => {
    const onRemovePoint = vi.fn()
    renderLayer({ onRemovePoint })

    fireEvent.click(screen.getByRole('button', { name: 'Remove boundary point 2' }))

    expect(onRemovePoint).toHaveBeenCalledWith(1)
  })

  it('removes the focused boundary point on Delete and on Backspace', () => {
    const onRemovePoint = vi.fn()
    renderLayer({ onRemovePoint })

    fireEvent.keyDown(screen.getByRole('button', { name: 'Boundary point 1' }), { key: 'Delete' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Boundary point 3' }), {
      key: 'Backspace',
    })

    expect(onRemovePoint).toHaveBeenNthCalledWith(1, 0)
    expect(onRemovePoint).toHaveBeenNthCalledWith(2, 2)
  })

  it('disables every removal at the minimum number of points', () => {
    const onRemovePoint = vi.fn()
    renderLayer({ minimumPoints: 3, onRemovePoint, points: triangle })

    for (const control of screen.getAllByRole('button', { name: /^Remove boundary point \d+$/ })) {
      expect(control).toBeDisabled()
    }

    fireEvent.keyDown(screen.getByRole('button', { name: 'Boundary point 1' }), { key: 'Delete' })
    expect(onRemovePoint).not.toHaveBeenCalled()
  })

  it('keeps inserting and dragging available at the minimum number of points', () => {
    const onInsertPoint = vi.fn()
    renderLayer({ minimumPoints: 3, onInsertPoint, points: triangle })

    expect(
      screen.getAllByRole('button', { name: /^Insert boundary point on edge \d+$/ }),
    ).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'Insert boundary point on edge 1' }))
    expect(onInsertPoint).toHaveBeenCalledWith(1, { latitude: 0, longitude: 2 })
  })

  it('offers no way to finish an outline that is already closed', () => {
    renderLayer()

    expect(screen.queryByRole('button', { name: 'Finish the outline' })).not.toBeInTheDocument()
  })
})
