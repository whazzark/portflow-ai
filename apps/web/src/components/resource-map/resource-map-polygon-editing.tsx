import { useCallback, useRef } from 'react'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import { PolygonOutline } from '@/components/resource-map/resource-map-polygon-outline'
import { MapMarker, MarkerContent } from '@/components/ui/map'

const OUTLINE_ID = 'editable-footprint'

const midpoint = (start: LatLng, end: LatLng): LatLng => ({
  latitude: (start.latitude + end.latitude) / 2,
  longitude: (start.longitude + end.longitude) / 2,
})

/**
 * A resource-agnostic editable ring: the outline of an existing polygon, one draggable marker per
 * boundary point with its own removal, and one handle per edge that splits it.
 *
 * Unlike the pending-polygon layer beside it, this one **never arms the map**. A ring that already
 * exists is closed by construction, so there is no appending and nothing to finish: a click landing
 * anywhere but on a handle must leave the shape alone. Insertion is expressed as splitting a
 * designated edge, which is what lets the gesture itself say where the new point goes.
 *
 * Deliberately knows nothing about what the polygon represents — no warehouse vocabulary, no
 * minimum size, no validity rule. Those belong to the feature that consumes it. Must be used inside
 * a `<Map>`.
 */
export function EditablePolygonPlacement({
  points,
  onMovePoint,
  onInsertPoint,
  onRemovePoint,
  minimumPoints = 3,
  fillColor = '#2563eb',
}: {
  points: LatLng[]
  onMovePoint: (index: number, point: LatLng) => void
  /** `index` is the position the new point takes in the resulting ring, never an arbitrary end. */
  onInsertPoint: (index: number, point: LatLng) => void
  onRemovePoint: (index: number) => void
  /** Below this count the ring stops being a ring, so removal is refused rather than allowed and
   * rejected later. */
  minimumPoints?: number
  fillColor?: string
}) {
  const canRemove = points.length > minimumPoints

  return (
    <>
      <PolygonOutline fillColor={fillColor} id={OUTLINE_ID} points={points} />
      {points.map((point, index) => (
        <MapMarker
          draggable
          // biome-ignore lint/suspicious/noArrayIndexKey: positional points — index is identity
          key={`boundary-point-${index}`}
          latitude={point.latitude}
          longitude={point.longitude}
          onDragEnd={(lngLat) =>
            onMovePoint(index, { latitude: lngLat.lat, longitude: lngLat.lng })
          }
        >
          <MarkerContent>
            <div className="group relative">
              <button
                aria-label={`Boundary point ${index + 1}`}
                className="block size-3.5 cursor-grab rounded-full border-2 border-white bg-primary shadow-lg ring-primary/40 hover:ring-4 focus-visible:outline-none focus-visible:ring-4 dark:border-neutral-900"
                data-boundary-point={index}
                onKeyDown={(event) => {
                  if (!canRemove || (event.key !== 'Delete' && event.key !== 'Backspace')) {
                    return
                  }

                  event.preventDefault()
                  onRemovePoint(index)
                }}
                type="button"
              />
              <button
                aria-label={`Remove boundary point ${index + 1}`}
                className="absolute -top-2 -right-2 hidden size-4 items-center justify-center rounded-full border border-white bg-destructive text-[10px] text-white leading-none shadow disabled:cursor-not-allowed disabled:opacity-50 group-focus-within:flex group-hover:flex dark:border-neutral-900"
                disabled={!canRemove}
                onClick={() => onRemovePoint(index)}
                type="button"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </MarkerContent>
        </MapMarker>
      ))}
      {points.map((point, index) => {
        const next = points[(index + 1) % points.length]

        return (
          <MapMarker
            // biome-ignore lint/suspicious/noArrayIndexKey: positional edges — index is identity
            key={`insert-handle-${index}`}
            {...midpoint(point, next)}
          >
            <MarkerContent>
              <InsertHandle index={index} onInsert={onInsertPoint} point={midpoint(point, next)} />
            </MarkerContent>
          </MapMarker>
        )
      })}
    </>
  )
}

/**
 * The handle sitting at the middle of one edge. Its click handler is attached natively rather than
 * through React for the same reason the drawing layer's finish control does it: MapLibre appends
 * marker elements to the map's canvas container and listens for `click` on that same container, so
 * its listener runs before React's delegated `onClick` and would let the map act on a click meant
 * only for this handle.
 */
function InsertHandle({
  index,
  point,
  onInsert,
}: {
  index: number
  point: LatLng
  onInsert: (index: number, point: LatLng) => void
}) {
  const insertRef = useRef({ index, point, onInsert })
  insertRef.current = { index, point, onInsert }

  const attachInsertHandler = useCallback((element: HTMLButtonElement | null) => {
    if (!element) {
      return
    }

    const insert = (event: MouseEvent) => {
      event.stopPropagation()
      const { index: edge, point: at, onInsert: insertPoint } = insertRef.current
      // The new point takes the position after the edge's first endpoint, so the ring keeps its
      // order and the closing edge appends at the end.
      insertPoint(edge + 1, at)
    }

    element.addEventListener('click', insert)

    return () => element.removeEventListener('click', insert)
  }, [])

  return (
    <button
      aria-label={`Insert boundary point on edge ${index + 1}`}
      className="block size-2.5 cursor-pointer rounded-full border-2 border-primary bg-white opacity-70 shadow ring-primary/40 hover:opacity-100 hover:ring-4 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-4 dark:bg-neutral-900"
      data-insert-edge={index}
      ref={attachInsertHandler}
      type="button"
    />
  )
}
