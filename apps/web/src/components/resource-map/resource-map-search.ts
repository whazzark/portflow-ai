import type {
  PresentedResource,
  ResourceStatus,
  ResourceStatusFilter,
  SearchableResource,
} from './resource-map-types'

export function normalizeResourceSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase('en')
}

export function resourceMatchesSearch(resource: Pick<SearchableResource, 'name'>, search: string) {
  const normalizedSearch = normalizeResourceSearch(search)
  return (
    normalizedSearch.length === 0 ||
    normalizeResourceSearch(resource.name).includes(normalizedSearch)
  )
}

export function presentResources<T extends SearchableResource>(
  resources: T[],
  status: ResourceStatusFilter,
  search: string,
  include: (resource: T) => boolean = () => true,
): PresentedResource<T>[] {
  const expectedStatus: ResourceStatus | undefined =
    status === 'all' ? undefined : (status.toUpperCase() as ResourceStatus)

  return resources
    .filter(
      (resource) => include(resource) && (!expectedStatus || resource.status === expectedStatus),
    )
    .map((resource) => ({
      ...resource,
      isSearchMatch: resourceMatchesSearch(resource, search),
    }))
}

export function countResources<T extends SearchableResource>(
  resources: T[],
  include: (resource: T) => boolean = () => true,
) {
  return {
    all: resources.filter(include).length,
    available: resources.filter((resource) => include(resource) && resource.status === 'AVAILABLE')
      .length,
    archived: resources.filter((resource) => include(resource) && resource.status === 'ARCHIVED')
      .length,
  } satisfies Record<ResourceStatusFilter, number>
}
