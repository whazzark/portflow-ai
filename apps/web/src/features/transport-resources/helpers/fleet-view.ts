import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { truckMatchesSearch } from '@/features/trucks/helpers/truck-search'
import type { TruckDto } from '@/features/trucks/types'
import { normalizeSearch } from '@/helpers/search'
import type { FleetSort, FleetStatus } from './transport-resources-search'

export type FleetViewInput = {
  companies: TransportCompanyDto[]
  /** Administrators read every truck; anyone else the available and suspended ones only. */
  trucks: TruckDto[]
  statuses: readonly FleetStatus[]
  search: string
  transportCompanyId?: string
  sort: FleetSort
  order: 'asc' | 'desc'
  administrator: boolean
  /** A company just created: listed while it has no truck yet, so it can receive its first. */
  pinnedCompanyId?: string
}

export type FleetTruck = {
  truck: TruckDto
  status: FleetStatus
  /** An archived truck comes back only through an available company. */
  canReactivate: boolean
}

export type FleetGroup = {
  company: TransportCompanyDto
  /** Over all its trucks, whatever the filters: what the company provides today. */
  summary: { available: number; suspended: number }
  /** A company can be archived only once it provides no available truck. */
  archiveBlockedBy: number
  trucks: FleetTruck[]
}

export type FleetView = {
  counts: Record<FleetStatus, number>
  groups: FleetGroup[]
  filteredCompany?: { id: string; name: string }
  hiddenCompanyCount: number
  showArchivedNotice: boolean
  isEmpty: boolean
}

const STATUS_BY_DTO: Record<TruckDto['status'], FleetStatus> = {
  AVAILABLE: 'available',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived',
}

const STATUS_RANK: Record<FleetStatus, number> = { available: 0, suspended: 1, archived: 2 }

const byText = (left: string, right: string) => left.localeCompare(right, 'en')

function compareTrucks(sort: FleetSort, order: 'asc' | 'desc') {
  const direction = order === 'asc' ? 1 : -1
  const byRegistration = (left: TruckDto, right: TruckDto) =>
    byText(left.registration, right.registration)

  return (left: TruckDto, right: TruckDto) => {
    if (sort === 'vehicleModel') {
      // A truck with no model has nothing to compare: it stays last whichever the direction.
      if (!left.vehicleModel || !right.vehicleModel) {
        return (
          Number(!left.vehicleModel) - Number(!right.vehicleModel) || byRegistration(left, right)
        )
      }

      return (
        direction * byText(left.vehicleModel, right.vehicleModel) || byRegistration(left, right)
      )
    }

    if (sort === 'capacity') {
      return direction * (left.capacityTonnes - right.capacityTonnes) || byRegistration(left, right)
    }

    if (sort === 'status') {
      return (
        direction *
          (STATUS_RANK[STATUS_BY_DTO[left.status]] - STATUS_RANK[STATUS_BY_DTO[right.status]]) ||
        byRegistration(left, right)
      )
    }

    return direction * byRegistration(left, right)
  }
}

export function buildFleetView(input: FleetViewInput): FleetView {
  const { companies, trucks, statuses, search, administrator } = input
  const selected = new Set(statuses)
  const normalizedSearch = normalizeSearch(search)
  const companyById = new Map(companies.map((company) => [company.id, company]))
  const trucksByCompany = new Map<string, TruckDto[]>()

  for (const truck of trucks) {
    const list = trucksByCompany.get(truck.transportCompanyId) ?? []
    list.push(truck)
    trucksByCompany.set(truck.transportCompanyId, list)
  }

  const compare = compareTrucks(input.sort, input.order)
  const listedGroups: FleetGroup[] = []

  for (const company of [...companies].sort((left, right) => byText(left.name, right.name))) {
    const companyTrucks = trucksByCompany.get(company.id) ?? []
    const companyArchived = company.status === 'ARCHIVED'
    const listedTrucks = companyTrucks
      .filter((truck) => selected.has(STATUS_BY_DTO[truck.status]))
      .filter((truck) => truckMatchesSearch(truck, company, search))
      .sort(compare)
    const matchesByName =
      normalizedSearch.length > 0 && normalizeSearch(company.name).includes(normalizedSearch)
    const listed =
      listedTrucks.length > 0 ||
      (companyArchived && selected.has('archived') && (!normalizedSearch || matchesByName)) ||
      matchesByName ||
      (company.id === input.pinnedCompanyId && companyTrucks.length === 0)

    if (!listed) {
      continue
    }

    const summary = {
      available: companyTrucks.filter((truck) => truck.status === 'AVAILABLE').length,
      suspended: companyTrucks.filter((truck) => truck.status === 'SUSPENDED').length,
    }

    listedGroups.push({
      company,
      summary,
      archiveBlockedBy: summary.available,
      trucks: listedTrucks.map((truck) => ({
        truck,
        status: STATUS_BY_DTO[truck.status],
        canReactivate: !companyArchived,
      })),
    })
  }

  const filtered = input.transportCompanyId ? companyById.get(input.transportCompanyId) : undefined
  const groups = filtered
    ? listedGroups.filter((group) => group.company.id === filtered.id)
    : listedGroups

  return {
    counts: {
      available: trucks.filter((truck) => truck.status === 'AVAILABLE').length,
      suspended: trucks.filter((truck) => truck.status === 'SUSPENDED').length,
      // Archived trucks are read by administrators only; everyone else counts what they can list.
      archived: administrator
        ? trucks.filter((truck) => truck.status === 'ARCHIVED').length
        : companies.filter((company) => company.status === 'ARCHIVED').length,
    },
    groups,
    filteredCompany: filtered ? { id: filtered.id, name: filtered.name } : undefined,
    hiddenCompanyCount: filtered ? listedGroups.length - groups.length : 0,
    showArchivedNotice:
      administrator &&
      selected.has('archived') &&
      groups.some((group) =>
        group.trucks.some((truck) => truck.status === 'archived' && !truck.canReactivate),
      ),
    isEmpty: groups.length === 0,
  }
}
