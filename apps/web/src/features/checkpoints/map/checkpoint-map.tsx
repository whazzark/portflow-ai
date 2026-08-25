import { SquareDashedMousePointer } from 'lucide-react'
import { LngLatBounds } from 'maplibre-gl'
import { type ReactNode, useEffect, useMemo } from 'react'
import {
  type ResourceMapCreateAction,
  ResourceMapCreateControl,
} from '@/components/resource-map/resource-map-create-control'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import {
  PendingPlacementMarker,
  useResourceMapPlacement,
} from '@/components/resource-map/resource-map-placement'
import {
  ControlButton,
  ControlGroup,
  Map as MapCanvas,
  MapControls,
  useMap,
} from '@/components/ui/map'
import { mapStyleUrls } from '@/config/map'
import { CheckpointMarker } from '@/features/checkpoints/map/checkpoint-marker'
import { getCheckpointMarkerOffset } from '@/features/checkpoints/map/checkpoint-marker-offset'
import {
  CHECKPOINT_KIND_PLURAL_LABELS,
  type CheckpointKind,
  type PresentedCheckpoint,
} from '@/features/checkpoints/types'

export type CheckpointMapPlacement = {
  armed: boolean
  pending: LatLng | null
  onPlace: (point: LatLng) => void
  onMove: (point: LatLng) => void
  /** Accessible label for the pending marker, e.g. "New dock". */
  label: string
  /** Visual content for the pending marker, e.g. an `<AnchorIcon />`. */
  icon: ReactNode
}

function CheckpointPlacementLayer({ placement }: { placement: CheckpointMapPlacement }) {
  useResourceMapPlacement({ armed: placement.armed, onPlace: placement.onPlace })

  if (!placement.pending) {
    return null
  }

  return (
    <PendingPlacementMarker
      label={placement.label}
      onMove={placement.onMove}
      position={placement.pending}
    >
      <span
        className="grid size-8 place-items-center rounded-full border-2 border-white bg-primary text-primary-foreground shadow-lg dark:border-neutral-900"
        data-pending-placement-marker
      >
        {placement.icon}
      </span>
    </PendingPlacementMarker>
  )
}

function FitCheckpointBounds({
  checkpoints,
  selected,
}: {
  checkpoints: PresentedCheckpoint[]
  selected?: PresentedCheckpoint
}) {
  const { map, isLoaded } = useMap()
  const items = selected ? [selected] : checkpoints
  const boundsKey = items
    .map(
      (checkpoint) =>
        `${checkpoint.kind}:${checkpoint.id}:${checkpoint.longitude}:${checkpoint.latitude}`,
    )
    .sort()
    .join('|')
  const coordinates = useMemo(
    () =>
      boundsKey
        ? boundsKey.split('|').map((entry) => {
            const [, , longitude, latitude] = entry.split(':')
            return [Number(longitude), Number(latitude)] as [number, number]
          })
        : [],
    [boundsKey],
  )

  useEffect(() => {
    if (!map || !isLoaded || coordinates.length === 0) {
      return
    }

    if (coordinates.length === 1) {
      map.easeTo({ center: coordinates[0], zoom: 13 })
      return
    }

    const bounds = coordinates.reduce(
      (current, coordinate) => current.extend(coordinate),
      new LngLatBounds(),
    )
    map.fitBounds(bounds, { maxZoom: 13, padding: 56 })
  }, [coordinates, isLoaded, map])

  return null
}

export function CheckpointMap({
  checkpoints,
  selected,
  onError,
  onSelect,
  placement,
  createActions = [],
  selectMode,
  checkedIds,
  checkableIds,
  onToggleChecked,
  selectableKinds = [],
  onToggleSelectMode,
  onShiftSelect,
}: {
  checkpoints: PresentedCheckpoint[]
  selected?: PresentedCheckpoint
  onError?: (error: unknown) => void
  onSelect: (checkpoint: PresentedCheckpoint) => void
  placement?: CheckpointMapPlacement
  createActions?: ResourceMapCreateAction[]
  /** When set to a kind, markers of that kind become checkable instead of opening the details
   * sheet, while every other kind's markers keep their normal `onSelect` behavior. */
  selectMode?: CheckpointKind
  checkedIds?: Set<string>
  /** Checkpoint ids eligible to become checked, whether or not select mode is currently active —
   * also gates shift-click, which can enter select mode directly from any checkable marker. The
   * caller (checkpoints-page.tsx) owns the eligibility rule (kind, lifecycle status, and the
   * selection's intent); the map only renders it. */
  checkableIds?: Set<string>
  onToggleChecked?: (id: string) => void
  /** Which kinds offer a "Select {kind}" map-control toggle at all; one button is rendered per
   * entry, and at most one kind is ever the active `selectMode`. */
  selectableKinds?: CheckpointKind[]
  onToggleSelectMode?: (kind: CheckpointKind) => void
  /** Shift-clicking a checkable marker enters/adds to that kind's select mode directly,
   * regardless of the current mode. */
  onShiftSelect?: (kind: CheckpointKind, id: string) => void
}) {
  const initialCenter = useMemo<[number, number]>(() => {
    const firstCheckpoint = checkpoints[0]
    return firstCheckpoint
      ? [firstCheckpoint.longitude, firstCheckpoint.latitude]
      : [-1.2264, 46.1591]
  }, [checkpoints])
  const isArmed = placement?.armed ?? false

  return (
    <MapCanvas
      // MapLibre's built-in Shift+drag box-zoom is not a feature this map offers, and its
      // interaction handler swallows the click that follows a Shift+mousedown (via its internal
      // suppressClick — see BoxZoomHandler) even when the mousedown lands on a marker rather than
      // the canvas. That silently breaks shift-click-to-select below, so box-zoom stays disabled.
      boxZoom={false}
      center={initialCenter}
      className={isArmed ? 'h-full cursor-crosshair' : 'h-full'}
      onMapError={onError}
      styles={mapStyleUrls}
      zoom={checkpoints.length === 1 ? 13 : 5}
    >
      <FitCheckpointBounds checkpoints={checkpoints} selected={selected} />
      {checkpoints.map((checkpoint) => {
        const isCheckable =
          selectableKinds.includes(checkpoint.kind) && (checkableIds?.has(checkpoint.id) ?? false)
        const isSelectableNow = selectMode === checkpoint.kind && isCheckable

        return (
          <CheckpointMarker
            checked={isSelectableNow ? (checkedIds?.has(checkpoint.id) ?? false) : undefined}
            checkpoint={checkpoint}
            key={`${checkpoint.kind}:${checkpoint.id}`}
            muted={isArmed}
            offset={getCheckpointMarkerOffset(checkpoint, checkpoints)}
            onSelect={(selectedCheckpoint, event) => {
              if (isCheckable && event.shiftKey && onShiftSelect) {
                onShiftSelect(checkpoint.kind, checkpoint.id)
                return
              }
              if (isSelectableNow) {
                onToggleChecked?.(checkpoint.id)
                return
              }
              onSelect(selectedCheckpoint)
            }}
          />
        )
      })}
      {placement && <CheckpointPlacementLayer placement={placement} />}
      {/* While placement is armed the create sheet covers the map's right edge, and the default
          bottom-right cluster with it. Move the controls to the free middle-left strip — between
          the filter panel (top-left) and the legend (bottom-left) — so the map stays zoomable
          while the admin refines the placement. */}
      <MapControls
        className={isArmed ? 'top-1/2 bottom-auto -translate-y-1/2' : undefined}
        position={isArmed ? 'bottom-left' : 'bottom-right'}
        showZoom
      >
        {onToggleSelectMode &&
          selectableKinds.map((kind) => (
            <ControlGroup key={kind}>
              <ControlButton
                active={selectMode === kind}
                label={
                  selectMode === kind
                    ? `Stop selecting ${CHECKPOINT_KIND_PLURAL_LABELS[kind]}`
                    : `Select ${CHECKPOINT_KIND_PLURAL_LABELS[kind]}`
                }
                onClick={() => onToggleSelectMode(kind)}
              >
                <SquareDashedMousePointer aria-hidden="true" className="size-4" />
              </ControlButton>
            </ControlGroup>
          ))}
        <ResourceMapCreateControl actions={createActions} />
      </MapControls>
    </MapCanvas>
  )
}
