import { LngLatBounds } from 'maplibre-gl'
import { useEffect, useMemo } from 'react'
import { Map as MapCanvas, useMap } from '@/components/ui/map'
import { mapStyleUrls } from '@/config/map'
import { CheckpointMarker } from '@/features/checkpoints/map/checkpoint-marker'
import { getCheckpointMarkerOffset } from '@/features/checkpoints/map/checkpoint-marker-offset'
import type { PresentedCheckpoint } from '@/features/checkpoints/types'

function FitCheckpointBounds({ checkpoints }: { checkpoints: PresentedCheckpoint[] }) {
  const { map, isLoaded } = useMap()
  const boundsKey = checkpoints
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
  onError,
  onSelect,
}: {
  checkpoints: PresentedCheckpoint[]
  onError?: (error: unknown) => void
  onSelect: (checkpoint: PresentedCheckpoint) => void
}) {
  const initialCenter = useMemo<[number, number]>(() => {
    const firstCheckpoint = checkpoints[0]
    return firstCheckpoint
      ? [firstCheckpoint.longitude, firstCheckpoint.latitude]
      : [-1.2264, 46.1591]
  }, [checkpoints])

  return (
    <MapCanvas
      center={initialCenter}
      className="h-full"
      onMapError={onError}
      styles={mapStyleUrls}
      zoom={checkpoints.length === 1 ? 13 : 5}
    >
      <FitCheckpointBounds checkpoints={checkpoints} />
      {checkpoints.map((checkpoint) => (
        <CheckpointMarker
          checkpoint={checkpoint}
          key={`${checkpoint.kind}:${checkpoint.id}`}
          offset={getCheckpointMarkerOffset(checkpoint, checkpoints)}
          onSelect={onSelect}
        />
      ))}
    </MapCanvas>
  )
}
