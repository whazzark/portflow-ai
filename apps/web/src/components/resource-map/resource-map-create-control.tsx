import { PlusIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ControlButton, ControlGroup } from '@/components/ui/map'

export type ResourceMapCreateAction = {
  key: string
  label: string
  icon?: ReactNode
  onSelect: () => void
}

/**
 * A resource-agnostic "create" control for a map's control cluster. Renders a single icon button
 * when exactly one action is available, or a dropdown menu when there are several — so adding a
 * second creatable resource kind later only means adding an entry to `actions`, not restructuring
 * this component.
 */
export function ResourceMapCreateControl({ actions }: { actions: ResourceMapCreateAction[] }) {
  if (actions.length === 0) {
    return null
  }

  if (actions.length === 1) {
    const [action] = actions

    return (
      <ControlGroup>
        <ControlButton label={action.label} onClick={action.onSelect}>
          {action.icon ?? <PlusIcon aria-hidden="true" className="size-4" />}
        </ControlButton>
      </ControlGroup>
    )
  }

  return (
    <ControlGroup>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          aria-label="Create"
          render={
            <Button
              className="size-8 rounded-none border-0 bg-transparent shadow-none hover:bg-accent dark:hover:bg-accent/40"
              size="icon"
              type="button"
              variant="ghost"
            />
          }
        >
          <PlusIcon aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action) => (
            <DropdownMenuItem key={action.key} onClick={action.onSelect}>
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ControlGroup>
  )
}
