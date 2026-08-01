import { FilterIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InputSearch } from '@/components/ui/input-search'
import { CheckpointKindIcon } from '@/features/checkpoints/map/checkpoint-marker'
import type {
  CheckpointKind,
  CheckpointLayerVisibility,
  CheckpointStatusFilter,
} from '@/features/checkpoints/types'

const STATUS_LABELS: Record<CheckpointStatusFilter, string> = {
  all: 'All',
  available: 'Available',
  archived: 'Archived',
}

const KIND_LABELS: Record<CheckpointKind, string> = {
  DOCK: 'Docks',
  WEIGHING_AREA: 'Weighing areas',
}

export function CheckpointMapControls({
  hasMatches,
  layerVisibility,
  onLayerVisibilityChange,
  onSearchChange,
  onStatusChange,
  search,
  status,
}: {
  hasMatches: boolean
  layerVisibility: CheckpointLayerVisibility
  onLayerVisibilityChange: (visibility: CheckpointLayerVisibility) => void
  onSearchChange: (search: string) => void
  onStatusChange: (status: CheckpointStatusFilter) => void
  search: string
  status: CheckpointStatusFilter
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const visibleKinds = (Object.keys(KIND_LABELS) as CheckpointKind[]).filter(
    (kind) => layerVisibility[kind],
  )
  const filterLabel = `${STATUS_LABELS[status]} — ${visibleKinds.map((kind) => KIND_LABELS[kind]).join(' + ')}`

  return (
    <div className="flex max-w-full flex-col gap-2">
      <div className="flex max-w-full gap-2">
        <InputSearch
          className="bg-background/95 shadow-md backdrop-blur"
          fieldClassName="min-w-0 flex-1 sm:w-72"
          id="checkpoint-search"
          label="Search checkpoints"
          onValueChange={onSearchChange}
          placeholder="Search checkpoints"
          value={search}
        />
        <DropdownMenu
          modal={false}
          onOpenChange={(open, details) => {
            if (details.reason !== 'trigger-press') {
              setIsFilterOpen(open)
            }
          }}
          open={isFilterOpen}
        >
          <DropdownMenuTrigger
            aria-label={`Filter checkpoints: ${filterLabel}`}
            className="bg-background/95 shadow-md backdrop-blur"
            onClick={() => setIsFilterOpen((open) => !open)}
            render={
              <Button
                className="bg-background/95 shadow-md backdrop-blur"
                size="icon"
                type="button"
                variant="outline"
              />
            }
          >
            <FilterIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          {isFilterOpen && (
            <DropdownMenuContent align="end" aria-label="Checkpoint filters" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  onValueChange={(value) => {
                    onStatusChange(value as CheckpointStatusFilter)
                  }}
                  value={status}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <DropdownMenuRadioItem key={value} value={value}>
                      {label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Checkpoint types</DropdownMenuLabel>
                {(Object.keys(KIND_LABELS) as CheckpointKind[]).map((kind) => (
                  <DropdownMenuCheckboxItem
                    checked={layerVisibility[kind]}
                    closeOnClick={false}
                    disabled={visibleKinds.length === 1 && layerVisibility[kind]}
                    key={kind}
                    onCheckedChange={(checked) => {
                      if (!checked && visibleKinds.length === 1) {
                        return
                      }
                      onLayerVisibilityChange({ ...layerVisibility, [kind]: checked })
                    }}
                  >
                    <CheckpointKindIcon className="text-muted-foreground" kind={kind} />
                    {KIND_LABELS[kind]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </div>
      {search && !hasMatches && (
        <div className="rounded-lg bg-background/95 px-3 py-2 text-sm shadow-md" role="status">
          <span>No checkpoints match “{search}”.</span>{' '}
          <Button className="h-auto p-0" onClick={() => onSearchChange('')} variant="link">
            Clear search
          </Button>
        </div>
      )}
    </div>
  )
}
