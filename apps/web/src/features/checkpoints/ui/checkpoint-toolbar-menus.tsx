import { ChevronDownIcon, PlusIcon, SquareDashedMousePointer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CheckpointKindIcon } from '@/features/checkpoints/map/checkpoint-marker'
import { CHECKPOINT_KIND_PLURAL_LABELS, type CheckpointKind } from '@/features/checkpoints/types'

const CREATE_ITEMS: { kind: CheckpointKind; label: string; description: string }[] = [
  { kind: 'DOCK', label: 'New dock', description: 'Berth where trucks are loaded' },
  {
    kind: 'WEIGHING_AREA',
    label: 'New weighing area',
    description: 'Weighbridge where trucks are weighed',
  },
]

/** The toolbar's Create button: one item per checkpoint kind, each starting its placement mode. */
export function CheckpointCreateMenu({ onCreate }: { onCreate: (kind: CheckpointKind) => void }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger render={<Button size="sm" type="button" />}>
        <PlusIcon aria-hidden="true" />
        Create
        <ChevronDownIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        {CREATE_ITEMS.map((item) => (
          <DropdownMenuItem
            className="items-start gap-2.5 py-2"
            key={item.kind}
            onClick={() => onCreate(item.kind)}
          >
            <CheckpointKindIcon className="mt-0.5 text-muted-foreground" kind={item.kind} />
            <span className="flex flex-col">
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground text-xs">{item.description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The toolbar's Select button: enters bulk select mode for one checkpoint kind. */
export function CheckpointSelectMenu({
  kinds,
  onSelect,
}: {
  kinds: CheckpointKind[]
  onSelect: (kind: CheckpointKind) => void
}) {
  if (kinds.length === 0) {
    return null
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger render={<Button size="sm" type="button" variant="outline" />}>
        <SquareDashedMousePointer aria-hidden="true" />
        Select
        <ChevronDownIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {kinds.map((kind) => (
          <DropdownMenuItem key={kind} onClick={() => onSelect(kind)}>
            <CheckpointKindIcon className="text-muted-foreground" kind={kind} />
            Select {CHECKPOINT_KIND_PLURAL_LABELS[kind]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
