export const RESOURCE_STATUS_FILTERS = ['all', 'available', 'archived'] as const
export type ResourceStatusFilter = (typeof RESOURCE_STATUS_FILTERS)[number]

export const RESOURCE_STATUS_LABELS: Record<ResourceStatusFilter, string> = {
  all: 'All',
  available: 'Available',
  archived: 'Archived',
}

export type ResourceStatus = 'AVAILABLE' | 'ARCHIVED'

export type SearchableResource = {
  name: string
  status: ResourceStatus
}

export type PresentedResource<T extends SearchableResource> = T & {
  isSearchMatch: boolean
}
