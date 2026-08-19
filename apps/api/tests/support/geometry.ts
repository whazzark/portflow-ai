export type GeographicPoint = { latitude: number; longitude: number }

const isPointOnSegment = (point: GeographicPoint, start: GeographicPoint, end: GeographicPoint) => {
  const crossProduct =
    (point.latitude - start.latitude) * (end.longitude - start.longitude) -
    (point.longitude - start.longitude) * (end.latitude - start.latitude)
  if (Math.abs(crossProduct) > Number.EPSILON * 100) {
    return false
  }
  const dotProduct =
    (point.latitude - start.latitude) * (end.latitude - start.latitude) +
    (point.longitude - start.longitude) * (end.longitude - start.longitude)
  if (dotProduct < 0) {
    return false
  }
  const squaredLength =
    (end.latitude - start.latitude) ** 2 + (end.longitude - start.longitude) ** 2
  return dotProduct <= squaredLength
}

export const isPointInsideOrOnPolygon = (point: GeographicPoint, polygon: GeographicPoint[]) => {
  if (polygon.length < 3) {
    return false
  }
  let inside = false
  for (
    let currentIndex = 0, previousIndex = polygon.length - 1;
    currentIndex < polygon.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const current = polygon[currentIndex]
    const previous = polygon[previousIndex]
    if (isPointOnSegment(point, previous, current)) {
      return true
    }
    const crossesLatitude = current.latitude > point.latitude !== previous.latitude > point.latitude
    const crossingLongitude =
      ((previous.longitude - current.longitude) * (point.latitude - current.latitude)) /
        (previous.latitude - current.latitude) +
      current.longitude
    if (crossesLatitude && point.longitude < crossingLongitude) {
      inside = !inside
    }
  }
  return inside
}
