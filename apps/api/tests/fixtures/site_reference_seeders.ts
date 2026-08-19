export const DEMO_LIFECYCLE_ACTOR_EMAIL = 'thomas.bernard@portflow.ai'

export const DEMO_LIFECYCLE_TIMESTAMPS = {
  archivedAt: '2025-01-15T10:00:00.000Z',
  reactivatedAt: '2025-03-15T10:00:00.000Z',
  archivedOnlyAt: '2025-04-15T10:00:00.000Z',
} as const

export const MANAGED_REFERENCE_EXEMPLARS = {
  customers: {
    available: 'ATL-CER',
    archived: 'CVN-001',
    reactivated: 'ARM-FROID',
  },
  docks: {
    available: "Môle d'Escale Ouest",
    archived: 'Chef de Baie 3',
    reactivated: 'Bassin à flot 2',
  },
  weighingAreas: {
    available: 'Pont-bascule Nord',
    archived: 'Ancien pont-bascule Chef de Baie',
    reactivated: 'Pont-bascule Sud',
  },
  warehouses: {
    available: 'SICA Atlantique - Silos céréaliers',
    archived: 'Ancien entrepôt Chef de Baie',
    reactivated: 'Atlantique Logistique - Hangar 7',
  },
  warehouseDoors: {
    available: {
      warehouse: 'SICA Atlantique - Silos céréaliers',
      name: 'Porte Nord',
    },
    archived: {
      warehouse: 'SICA Atlantique - Silos céréaliers',
      name: 'Porte Historique',
    },
    reactivated: {
      warehouse: 'Atlantique Logistique - Hangar 7',
      name: 'Porte de Service',
    },
  },
  transportCompanies: {
    available: 'Atlantique Transport Routier',
    archived: 'Loire Vrac Transport',
    reactivated: 'Estuaire Bennes',
  },
  trucks: {
    available: 'AA-101-PF',
    archived: 'ZZ-909-PF',
    reactivated: 'CC-303-PF',
  },
} as const

export type GeographicPoint = {
  latitude: number
  longitude: number
}

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
