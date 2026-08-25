export type WeighingAreaLifecycleRecord = {
  id: string
  name: string
  status: 'AVAILABLE' | 'ARCHIVED'
}

export type BulkWeighingAreaLifecycleBlocker = {
  id: string
  name?: string
  reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE'
}

export function findBulkBlockers(
  ids: string[],
  weighingAreasById: Map<string, WeighingAreaLifecycleRecord>,
  expectedStatus: 'AVAILABLE' | 'ARCHIVED',
  usedIds: Set<string> = new Set(),
): BulkWeighingAreaLifecycleBlocker[] {
  return ids.flatMap((id): BulkWeighingAreaLifecycleBlocker[] => {
    const area = weighingAreasById.get(id)

    if (!area) {
      return [{ id, reason: 'NOT_FOUND' }]
    }

    if (area.status !== expectedStatus) {
      return [
        {
          id,
          name: area.name,
          reason: expectedStatus === 'AVAILABLE' ? 'ALREADY_ARCHIVED' : 'ALREADY_AVAILABLE',
        },
      ]
    }

    if (expectedStatus === 'AVAILABLE' && usedIds.has(id)) {
      return [{ id, name: area.name, reason: 'IN_USE' }]
    }

    return []
  })
}
