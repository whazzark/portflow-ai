import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PendingPlacementMarker, useResourceMapPlacement } from '../resource-map-placement'

const mapStub = {
  getCanvas: () => ({ style: {} as CSSStyleDeclaration }),
  on: vi.fn(),
  off: vi.fn(),
}

vi.mock('@/components/ui/map', () => ({
  useMap: () => ({ map: mapStub, isLoaded: true }),
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
        drag
      </button>
      {children}
    </div>
  ),
  // Mirrors the real component: only this subtree is portalled into the marker element, so
  // anything that must stay anchored to the marker has to render inside it.
  MarkerContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="marker-content">{children}</div>
  ),
  MarkerLabel: ({ children, position }: { children?: React.ReactNode; position?: string }) => (
    <div data-position={position} data-testid="marker-label">
      {children}
    </div>
  ),
}))

function ArmedProbe({
  armed,
  onPlace,
}: {
  armed: boolean
  onPlace: (point: { latitude: number; longitude: number }) => void
}) {
  useResourceMapPlacement({ armed, onPlace })
  return null
}

describe('useResourceMapPlacement', () => {
  beforeEach(() => {
    mapStub.on.mockClear()
    mapStub.off.mockClear()
  })

  it('registers a map click handler while armed and reports the clicked coordinates', () => {
    const onPlace = vi.fn()
    render(<ArmedProbe armed={true} onPlace={onPlace} />)

    expect(mapStub.on).toHaveBeenCalledWith('click', expect.any(Function))
    const handler = mapStub.on.mock.calls[0]?.[1] as (event: {
      lngLat: { lat: number; lng: number }
    }) => void

    handler({ lngLat: { lat: 48.1, lng: 2.3 } })

    expect(onPlace).toHaveBeenCalledWith({ latitude: 48.1, longitude: 2.3 })
  })

  it('does not register a click handler while disarmed', () => {
    render(<ArmedProbe armed={false} onPlace={vi.fn()} />)

    expect(mapStub.on).not.toHaveBeenCalled()
  })

  it('removes the click handler on disarm/unmount', () => {
    const { rerender, unmount } = render(<ArmedProbe armed={true} onPlace={vi.fn()} />)
    const handler = mapStub.on.mock.calls[0]?.[1]

    rerender(<ArmedProbe armed={false} onPlace={vi.fn()} />)
    expect(mapStub.off).toHaveBeenCalledWith('click', handler)

    mapStub.off.mockClear()
    unmount()
    expect(mapStub.off).not.toHaveBeenCalled()
  })
})

describe('PendingPlacementMarker', () => {
  it('renders a draggable marker at the given position and reports drag moves', () => {
    const onMove = vi.fn()
    render(<PendingPlacementMarker onMove={onMove} position={{ latitude: 1, longitude: 2 }} />)

    const marker = screen.getByTestId('marker')
    expect(marker).toHaveAttribute('data-lat', '1')
    expect(marker).toHaveAttribute('data-lng', '2')
    expect(marker).toHaveAttribute('data-draggable', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'drag' }))
    expect(onMove).toHaveBeenCalledWith({ latitude: 2, longitude: 3 })
  })

  it('renders its label inside the portalled marker content so it stays anchored to the marker', () => {
    render(
      <PendingPlacementMarker
        label="New dock"
        onMove={vi.fn()}
        position={{ latitude: 1, longitude: 2 }}
      />,
    )

    const label = screen.getByTestId('marker-label')
    expect(label).toHaveTextContent('New dock')
    expect(label).toHaveAttribute('data-position', 'bottom')
    expect(screen.getByTestId('marker-content')).toContainElement(label)
  })

  it('stays anchored to its geographic position when it changes (e.g. after a map pan)', () => {
    const { rerender } = render(
      <PendingPlacementMarker onMove={vi.fn()} position={{ latitude: 1, longitude: 2 }} />,
    )

    rerender(<PendingPlacementMarker onMove={vi.fn()} position={{ latitude: 5, longitude: 9 }} />)

    const marker = screen.getByTestId('marker')
    expect(marker).toHaveAttribute('data-lat', '5')
    expect(marker).toHaveAttribute('data-lng', '9')
  })
})
