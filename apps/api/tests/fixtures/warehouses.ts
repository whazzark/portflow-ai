export const WAREHOUSE_FOOTPRINT = [
  { latitude: 48.85, longitude: 2.34 },
  { latitude: 48.86, longitude: 2.35 },
  { latitude: 48.85, longitude: 2.36 },
] as const

export const ARCHIVED_WAREHOUSE = {
  name: 'Retired Shed',
  status: 'ARCHIVED' as const,
  footprint: WAREHOUSE_FOOTPRINT,
}
