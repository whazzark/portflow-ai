import { FilterIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InputSearch } from '@/components/ui/input-search'
import type { CheckpointStatusFilter } from '@/features/checkpoints/types'

const STATUS_LABELS: Record<CheckpointStatusFilter, string> = {
  all: 'All',
  available: 'Available',
  archived: 'Archived',
}

export function CheckpointMapControls({
  hasMatches,
  onSearchChange,
  onStatusChange,
  search,
  status,
}: {
  hasMatches: boolean
  onSearchChange: (search: string) => void
  onStatusChange: (status: CheckpointStatusFilter) => void
  search: string
  status: CheckpointStatusFilter
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false)

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
        <DropdownMenu modal={false} open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <DropdownMenuTrigger
            aria-label={`Filter checkpoints: ${STATUS_LABELS[status]}`}
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
            <DropdownMenuContent align="end" aria-label="Checkpoint status" className="w-48">
              <DropdownMenuRadioGroup
                onValueChange={(value) => {
                  onStatusChange(value as CheckpointStatusFilter)
                  setIsFilterOpen(false)
                }}
                value={status}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
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
