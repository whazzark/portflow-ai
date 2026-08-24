export function indexById<T extends { id: string }>(records: T[]): Map<string, T> {
  return new Map(records.map((record) => [record.id, record]))
}

export function orderByIds<T extends { id: string }>(ids: string[], byId: Map<string, T>): T[] {
  return ids.flatMap((id) => {
    const record = byId.get(id)
    return record ? [record] : []
  })
}
