type CoordinateResource = {
  id: string
  latitude: number
  longitude: number
}

function coordinateKey(resource: CoordinateResource) {
  return `${resource.latitude.toFixed(4)}:${resource.longitude.toFixed(4)}`
}

export function getResourceMarkerOffset(
  resource: CoordinateResource,
  resources: CoordinateResource[],
): [number, number] {
  const collisions = resources.filter(
    (candidate) => coordinateKey(candidate) === coordinateKey(resource),
  )
  if (collisions.length <= 1) {
    return [0, 0]
  }

  const index = collisions.findIndex((candidate) => candidate.id === resource.id)
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / collisions.length
  const radius = 24
  return [Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius)]
}
