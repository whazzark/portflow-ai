import { z } from 'zod'

export const FLEET_STATUSES = ['available', 'suspended', 'archived'] as const
export type FleetStatus = (typeof FLEET_STATUSES)[number]

export const FLEET_SORTS = ['registration', 'vehicleModel', 'capacity', 'status'] as const
export type FleetSort = (typeof FLEET_SORTS)[number]

export const DEFAULT_FLEET_STATUSES: FleetStatus[] = ['available', 'suspended']

const statusSelection = z
  .array(z.enum(FLEET_STATUSES))
  .transform((statuses) => FLEET_STATUSES.filter((status) => statuses.includes(status)))
  .optional()
  .catch(undefined)

const mode = z.enum(['view', 'edit', 'create']).default('view').catch('view')

/**
 * The V2 screen is one grouped table, so one status selection and one search replace the two
 * directories' own. Their former names are still read, so links already in circulation keep
 * opening the view they meant, and are rewritten here rather than ever written back.
 */
export const transportResourcesSearchSchema = z
  .object({
    status: statusSelection,
    search: z.string().optional().catch(undefined),
    transportCompanyId: z.string().optional().catch(undefined),
    sort: z.enum(FLEET_SORTS).default('registration').catch('registration'),
    order: z.enum(['asc', 'desc']).default('asc').catch('asc'),
    truckId: z.string().optional().catch(undefined),
    truckMode: mode,
    truckCompanyId: z.string().optional().catch(undefined),
    companyDetailsId: z.string().optional().catch(undefined),
    companyDetailsMode: mode,
    truckStatus: z.enum(FLEET_STATUSES).optional().catch(undefined),
    truckSearch: z.string().optional().catch(undefined),
    companyStatus: z.enum(['available', 'archived']).optional().catch(undefined),
    companySearch: z.string().optional().catch(undefined),
  })
  .transform(({ truckStatus, truckSearch, companyStatus, companySearch, ...search }) => {
    const legacyStatus: FleetStatus[] | undefined = truckStatus
      ? [truckStatus]
      : companyStatus === 'archived'
        ? ['archived']
        : undefined
    const status =
      search.status && search.status.length > 0
        ? search.status
        : (legacyStatus ?? DEFAULT_FLEET_STATUSES)

    // One form at a time, the truck's winning; a creation clears its own record so the two can
    // never contradict each other; one detail at a time, the truck's winning.
    const truckMode = search.truckMode
    const companyDetailsMode = truckMode === 'view' ? search.companyDetailsMode : 'view'
    const truckId = truckMode === 'create' ? undefined : search.truckId
    const companyDetailsId =
      companyDetailsMode === 'create' || truckId ? undefined : search.companyDetailsId

    return {
      status,
      search: search.search ?? truckSearch ?? companySearch ?? '',
      transportCompanyId: search.transportCompanyId,
      sort: search.sort,
      order: search.order,
      truckId,
      truckMode,
      truckCompanyId: truckMode === 'create' ? search.truckCompanyId : undefined,
      companyDetailsId,
      companyDetailsMode,
    }
  })

export type TransportResourcesSearch = z.output<typeof transportResourcesSearchSchema>

/** What the default view writes nothing for, so a shared address carries only what differs. */
export const DEFAULT_TRANSPORT_RESOURCES_SEARCH = {
  status: DEFAULT_FLEET_STATUSES,
  search: '',
  sort: 'registration',
  order: 'asc',
  truckMode: 'view',
  companyDetailsMode: 'view',
} satisfies Partial<TransportResourcesSearch>

/** The former Transport companies address, mapped onto the grouped screen. */
export function fromLegacyTransportCompanySearch(search: {
  status: 'available' | 'archived'
  search: string
  transportCompanyId?: string
}): Pick<TransportResourcesSearch, 'status' | 'search' | 'transportCompanyId'> {
  return {
    status: search.status === 'archived' ? ['archived'] : DEFAULT_FLEET_STATUSES,
    search: search.search,
    transportCompanyId: search.transportCompanyId,
  }
}
