type CoordinateCheckpoint = {
  id: string
  latitude: number
  longitude: number
}

function coordinateKey(checkpoint: CoordinateCheckpoint) {
  return `${checkpoint.latitude.toFixed(4)}:${checkpoint.longitude.toFixed(4)}`
}

export function getCheckpointMarkerOffset(
  checkpoint: CoordinateCheckpoint,
  checkpoints: CoordinateCheckpoint[],
): [number, number] {
  const collidingCheckpoints = checkpoints.filter(
    (candidate) => coordinateKey(candidate) === coordinateKey(checkpoint),
  )

  if (collidingCheckpoints.length === 1) {
    return [0, 0]
  }

  const index = collidingCheckpoints.findIndex((candidate) => candidate.id === checkpoint.id)
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / collidingCheckpoints.length
  const radius = 24

  return [Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius)]
}
