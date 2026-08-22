import type * as MapLibreGL from 'maplibre-gl'
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { MapMarker, MarkerContent, MarkerLabel, useMap } from '@/components/ui/map'

/** A plain geographic point. Resource-agnostic — not tied to any site-reference entity. */
export type LatLng = {
  latitude: number
  longitude: number
}

/**
 * Arms click-to-place on the enclosing `<Map>`. While `armed`, clicking the map reports the
 * clicked coordinates via `onPlace` instead of any other click behavior the map might otherwise
 * have. Must be used inside a `<Map>` (calls `useMap()`).
 */
export function useResourceMapPlacement({
  armed,
  onPlace,
}: {
  armed: boolean
  onPlace: (point: LatLng) => void
}) {
  const { map } = useMap()
  const onPlaceRef = useRef(onPlace)
  onPlaceRef.current = onPlace

  useEffect(() => {
    if (!map || !armed) {
      return
    }

    const handleClick = (event: MapLibreGL.MapMouseEvent) => {
      onPlaceRef.current({ latitude: event.lngLat.lat, longitude: event.lngLat.lng })
    }

    map.getCanvas().style.cursor = 'crosshair'
    map.on('click', handleClick)

    return () => {
      map.off('click', handleClick)
      map.getCanvas().style.cursor = ''
    }
  }, [map, armed])
}

/**
 * A draggable marker representing a not-yet-created placement. Purely visual: pass `children` for
 * a resource-specific icon, or omit it for a generic pending-placement mark. `label` renders a
 * short, always-visible caption under the marker (e.g. "New dock") so the pending placement stays
 * unmistakable regardless of color perception, and deliberately larger/animated than a resource's
 * normal markers so it reads as "not yet real" and draws the eye immediately. Must be used inside
 * a `<Map>`.
 */
export function PendingPlacementMarker({
  position,
  onMove,
  label,
  children,
}: {
  position: LatLng
  onMove: (point: LatLng) => void
  label?: ReactNode
  children?: ReactNode
}) {
  return (
    <MapMarker
      draggable
      latitude={position.latitude}
      longitude={position.longitude}
      onDragEnd={(lngLat) => onMove({ latitude: lngLat.lat, longitude: lngLat.lng })}
    >
      <MarkerContent>
        <span aria-hidden="true" className="relative grid place-items-center">
          <span
            className="absolute inline-flex size-11 animate-ping rounded-full bg-primary/50 motion-reduce:hidden"
            data-pending-placement-pulse
          />
          {children ?? <DefaultPendingPlacementMarkerIcon />}
        </span>
      </MarkerContent>
      {label && (
        <MarkerLabel
          className="rounded bg-background/95 px-1.5 py-0.5 font-semibold shadow-sm"
          position="bottom"
        >
          {label}
        </MarkerLabel>
      )}
    </MapMarker>
  )
}

function DefaultPendingPlacementMarkerIcon() {
  return (
    <span
      className="grid size-8 place-items-center rounded-full border-2 border-white bg-primary text-primary-foreground shadow-lg dark:border-neutral-900"
      data-pending-placement-marker
    />
  )
}
