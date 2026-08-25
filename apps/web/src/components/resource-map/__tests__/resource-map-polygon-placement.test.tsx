import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PendingPolygonPlacement } from '../resource-map-polygon-placement'

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
    <div data-draggable={draggable} data-lat={latitude} data-lng={longitude} data-testid="vertex">
      <button onClick={() => onDragEnd?.({ lat: latitude + 1, lng: longitude + 1 })} type="button">
        drag {latitude},{longitude}
      </button>
      {children}
    </div>
  ),
  MarkerContent: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

const square = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 2 },
  { latitude: 2, longitude: 2 },
]

describe('PendingPolygonPlacement', () => {
  beforeEach(() => {
    mapStub.on.mockClear()
    mapStub.off.mockClear()
  })

  it('appends the clicked coordinates while armed', () => {
    const onAddPoint = vi.fn()
    render(
      <PendingPolygonPlacement
        armed={true}
        onAddPoint={onAddPoint}
        onMovePoint={vi.fn()}
        points={[]}
      />,
    )

    const handler = mapStub.on.mock.calls[0]?.[1] as (event: {
      lngLat: { lat: number; lng: number }
    }) => void
    handler({ lngLat: { lat: 48.1, lng: 2.3 } })

    expect(onAddPoint).toHaveBeenCalledWith({ latitude: 48.1, longitude: 2.3 })
  })

  it('captures no map click while disarmed and renders nothing', () => {
    const { container } = render(
      <PendingPolygonPlacement
        armed={false}
        onAddPoint={vi.fn()}
        onMovePoint={vi.fn()}
        points={square}
      />,
    )

    expect(mapStub.on).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders one draggable marker per point and reports its index on drag', () => {
    const onMovePoint = vi.fn()
    render(
      <PendingPolygonPlacement
        armed={true}
        onAddPoint={vi.fn()}
        onMovePoint={onMovePoint}
        points={square}
      />,
    )

    const vertices = screen.getAllByTestId('vertex')
    expect(vertices).toHaveLength(3)
    expect(vertices[2]).toHaveAttribute('data-lat', '2')
    expect(vertices[2]).toHaveAttribute('data-draggable', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'drag 0,2' }))
    expect(onMovePoint).toHaveBeenCalledWith(1, { latitude: 1, longitude: 3 })
  })

  it('draws an open line from two points', () => {
    render(
      <PendingPolygonPlacement
        armed={true}
        onAddPoint={vi.fn()}
        onMovePoint={vi.fn()}
        points={square.slice(0, 2)}
      />,
    )

    const outline = screen.getByTestId('pending-footprint')
    expect(outline).toHaveAttribute('data-geometry', 'LineString')
    expect(outline).toHaveAttribute(
      'data-coordinates',
      JSON.stringify([
        [0, 0],
        [2, 0],
      ]),
    )
  })

  it('closes the outline into a polygon from three points', () => {
    render(
      <PendingPolygonPlacement
        armed={true}
        onAddPoint={vi.fn()}
        onMovePoint={vi.fn()}
        points={square}
      />,
    )

    const outline = screen.getByTestId('pending-footprint')
    expect(outline).toHaveAttribute('data-geometry', 'Polygon')
    expect(outline).toHaveAttribute(
      'data-coordinates',
      JSON.stringify([
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 0],
        ],
      ]),
    )
  })

  it('finishes the outline without letting the click reach the map', () => {
    const onComplete = vi.fn()
    const onAddPoint = vi.fn()
    // MapLibre listens for clicks on the container its markers live in, so a click that keeps
    // bubbling would close the ring *and* drop one more boundary point.
    const containerClick = vi.fn()
    document.addEventListener('click', containerClick)

    try {
      render(
        <PendingPolygonPlacement
          armed={true}
          onAddPoint={onAddPoint}
          onComplete={onComplete}
          onMovePoint={vi.fn()}
          points={square}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Finish the outline' }))

      expect(onComplete).toHaveBeenCalledTimes(1)
      expect(containerClick).not.toHaveBeenCalled()
      expect(onAddPoint).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('click', containerClick)
    }
  })

  it('offers no way to finish before three points, or once completed', () => {
    const { rerender } = render(
      <PendingPolygonPlacement
        armed={true}
        onAddPoint={vi.fn()}
        onComplete={vi.fn()}
        onMovePoint={vi.fn()}
        points={square.slice(0, 2)}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Finish the outline' })).not.toBeInTheDocument()

    rerender(
      <PendingPolygonPlacement
        armed={true}
        completed={true}
        onAddPoint={vi.fn()}
        onComplete={vi.fn()}
        onMovePoint={vi.fn()}
        points={square}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Finish the outline' })).not.toBeInTheDocument()
  })

  it('draws no outline from a single point but still marks it', () => {
    render(
      <PendingPolygonPlacement
        armed={true}
        onAddPoint={vi.fn()}
        onMovePoint={vi.fn()}
        points={square.slice(0, 1)}
      />,
    )

    expect(screen.queryByTestId('pending-footprint')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('vertex')).toHaveLength(1)
  })
})
