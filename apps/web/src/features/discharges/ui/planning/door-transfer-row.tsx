import { LockIcon } from 'lucide-react'
import { type ReactNode, useId } from 'react'

import { Button } from '@/components/ui/button'
import type { DischargeDetailDto, PlanningDoorDto } from '@/features/discharges/types'
import { ShiftLink } from '@/features/discharges/ui/detail/discharge-tab-link'
import { classnames } from '@/libraries/shadcn/helpers'

/** Why a door a planned shift uses cannot be let go of from the lot. */
export const REMOVE_FROM_SHIFT_FIRST = 'Remove it from the shift first'

/** A door as both columns of the transfer know it. */
export type TransferDoor = {
  id: string
  name: string
  warehouse: { id: string; name: string }
  otherDischargeAssignments: PlanningDoorDto['otherDischargeAssignments']
  /** Read from the detail for a door the lot holds; the options only ever offer available ones. */
  archived?: boolean
  /** False once the options no longer offer the door. */
  canCheck: boolean
}

export type DoorNote = { text: string; tone: 'muted' | 'warning' | 'destructive' | 'hidden' }

const NOTE_TONES = {
  muted: 'text-muted-foreground',
  warning: 'text-warning',
  destructive: 'text-destructive',
  hidden: 'sr-only',
} as const satisfies Record<DoorNote['tone'], string>

type DoorTransferRowProps = {
  name: string
  /** Beside the name: badges and the contention marker. */
  adornments?: ReactNode
  /** The planned shifts keeping the door, each a link to its panel. */
  shifts?: Array<
    Pick<DischargeDetailDto['shifts'][number], 'id' | 'plannedStartAt' | 'plannedEndAt'>
  >
  notes: DoorNote[]
  /** The row's one action, absent on a locked door. */
  action?: { id: string; label: 'Add' | 'Remove'; onClick: () => void }
}

/**
 * One door of either column: its name, what else holds it, and the one action that moves it across.
 * Each fact is its own element, so the action's description reads them apart.
 */
export function DoorTransferRow({
  action,
  adornments,
  name,
  notes,
  shifts = [],
}: DoorTransferRowProps) {
  const baseId = useId()
  const nameId = `${baseId}-name`
  const shiftsId = `${baseId}-shifts`
  const noteIds = notes.map((_, index) => `${baseId}-note-${index}`)

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm" id={nameId}>
            {name}
          </span>
          {adornments}
        </span>
        {(shifts.length > 0 || notes.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {shifts.length > 0 && (
              <span
                className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground"
                id={shiftsId}
              >
                <LockIcon aria-hidden="true" className="size-3.5" />
                {shifts.map((shift) => (
                  <ShiftLink
                    className="underline underline-offset-4 hover:text-foreground"
                    key={shift.id}
                    shift={shift}
                  />
                ))}
              </span>
            )}
            {notes.map((note, index) => (
              <span
                className={classnames(NOTE_TONES[note.tone])}
                id={noteIds[index]}
                key={note.text}
              >
                {note.text}
              </span>
            ))}
          </div>
        )}
      </div>
      {action && (
        <Button
          aria-describedby={[nameId, shifts.length > 0 ? shiftsId : null, ...noteIds]
            .filter(Boolean)
            .join(' ')}
          className="max-md:min-h-11"
          id={action.id}
          onClick={action.onClick}
          size="sm"
          type="button"
          variant="outline"
        >
          {action.label}
        </Button>
      )}
    </li>
  )
}
