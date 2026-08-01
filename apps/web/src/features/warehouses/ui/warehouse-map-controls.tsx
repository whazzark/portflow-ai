import { ResourceMapControls } from '@/components/resource-map/resource-map-controls'
import type { ResourceStatusFilter } from '@/components/resource-map/resource-map-types'

export function WarehouseMapControls(props: {
  search: string
  status: ResourceStatusFilter
  counts?: Record<ResourceStatusFilter, number>
  hasMatches: boolean
  onSearchChange: (value: string) => void
  onStatusChange: (value: ResourceStatusFilter) => void
}) {
  return (
    <ResourceMapControls
      {...props}
      counts={props.counts ?? { all: 0, available: 0, archived: 0 }}
      resourceLabel="warehouse"
      resourceLabelPlural="warehouses"
    />
  )
}
