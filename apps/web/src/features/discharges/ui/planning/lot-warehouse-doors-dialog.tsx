import { useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  currentDoorIds,
  describeIssues,
  lockedRemovals,
  lotDoorChangeSet,
  lotDoorColumns,
  lotLabel,
  movedDoors,
} from '@/features/discharges/discharge-planning-view'
import { useDischargeMutations } from '@/features/discharges/mutations/use-discharge-mutations'
import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { useResourceRows } from '@/features/discharges/ui/detail/use-resource-rows'
import { AssignedDoorsColumn } from '@/features/discharges/ui/planning/assigned-doors-column'
import { AvailableDoorsColumn } from '@/features/discharges/ui/planning/available-doors-column'
import type { TransferDoor } from '@/features/discharges/ui/planning/door-transfer-row'
import { LotDoorChangeSummary } from '@/features/discharges/ui/planning/lot-door-change-summary'
import { usePlanningOptions } from '@/features/discharges/ui/planning/planning-options'
import { PlanningOptionsState } from '@/features/discharges/ui/planning/planning-options-state'
import { staleRefusalMessage } from '@/features/discharges/ui/planning/planning-refusals'
import { WRITE_PENDING_LABELS } from '@/helpers/resource-copy'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

type ProductLot = DischargeDetailDto['productLots'][number]

/** The dialog's alert once a door the lot holds could not be let go of. */
export const DOORS_NOT_REMOVABLE_MESSAGE = 'Some warehouse doors can no longer be removed'
/** The dialog's alert once a door could not be taken; each door names its own reason. */
export const DOORS_NOT_SELECTABLE_MESSAGE = 'Some warehouse doors can no longer be selected'

type LotWarehouseDoorsDialogProps = {
  discharge: DischargeDetailDto
  lot: ProductLot | null
  onOpenChange: (open: boolean) => void
}

/**
 * A lot's warehouse doors, moved between what is available and what the lot takes. Two columns side
 * by side, so taking a door never pushes the others away; two tabs on a phone.
 */
export function LotWarehouseDoorsDialog({
  discharge,
  lot,
  onOpenChange,
}: LotWarehouseDoorsDialogProps) {
  return (
    <Dialog onOpenChange={(open) => onOpenChange(open)} open={lot !== null}>
      <DialogContent className="gap-0 p-0" size="xl">
        <DialogHeader className="shrink-0 border-b p-4">
          <DialogTitle>Warehouse doors</DialogTitle>
          <DialogDescription>{lot ? lotLabel(lot) : null}</DialogDescription>
        </DialogHeader>
        {/* Mounted with the dialog, so each opening starts from the lot as it stands. */}
        {lot && (
          <LotWarehouseDoorsForm
            discharge={discharge}
            lot={lot}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** The doors the lot holds, read from the detail so one archived since still has a row. */
function heldDoors(lot: ProductLot): TransferDoor[] {
  return lot.doorAssignments
    .filter((assignment) => assignment.effectiveTo === null)
    .map((assignment) => ({
      id: assignment.warehouseDoor.id,
      name: assignment.warehouseDoor.name,
      warehouse: { id: assignment.warehouse.id, name: assignment.warehouse.name },
      otherDischargeAssignments: [],
      archived:
        assignment.warehouseDoor.status === 'ARCHIVED' ||
        assignment.warehouse.status === 'ARCHIVED',
      canCheck: false,
    }))
}

type ValidationDetail = { field: string; message: string; rule?: string }

function LotWarehouseDoorsForm({
  discharge,
  lot,
  onDone,
}: {
  discharge: DischargeDetailDto
  lot: ProductLot
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const { changeLotDoors } = useDischargeMutations()
  const { doors } = usePlanningOptions(discharge.id)
  const baseId = useId()
  const searchId = `${baseId}-search`
  const availableHeadingId = `${baseId}-available`
  const assignedHeadingId = `${baseId}-assigned`
  const actionId = (doorId: string) => `${baseId}-action-${doorId}`
  // Fixed when the dialog opens, so neither a refused save nor a refreshed detail loses a door.
  const [held] = useState(() => heldDoors(lot))
  const [refusals, setRefusals] = useState<ReadonlyMap<string, string>>(new Map())
  const [alert, setAlert] = useState<string[] | null>(null)
  const [tab, setTab] = useState<'available' | 'assigned'>('available')
  const [focusId, setFocusId] = useState<string | null>(null)
  const alertRef = useRef<HTMLDivElement>(null)

  const heldIds = new Set(held.map((door) => door.id))
  const offered: TransferDoor[] = doors.options.map((door) => ({ ...door, canCheck: true }))

  useEffect(() => {
    if (alert) {
      alertRef.current?.focus()
    }
  }, [alert])

  // A door that moved across leaves its row, so the focus goes where the column said it should.
  useEffect(() => {
    if (focusId) {
      document.getElementById(focusId)?.focus()
      setFocusId(null)
    }
  }, [focusId])

  const form = useAppForm({
    defaultValues: { warehouseDoorIds: currentDoorIds(lot) },
    validators: {
      // A door a planned shift uses cannot leave the lot's column; this only catches a shift that
      // took one after it was let go of, before any request.
      onSubmit: ({ value }) => {
        const locked = lockedRemovals(discharge, lot, value.warehouseDoorIds)
        setAlert(locked.size > 0 ? [DOORS_NOT_REMOVABLE_MESSAGE] : null)

        return locked.size > 0 ? DOORS_NOT_REMOVABLE_MESSAGE : undefined
      },
    },
    onSubmit: async ({ value }) => {
      const changes = lotDoorChangeSet(lot, value.warehouseDoorIds)

      if (changes.assign.length === 0 && changes.withdraw.length === 0) {
        onDone()

        return
      }

      try {
        const response = await changeLotDoors.mutateAsync({
          params: { dischargeId: discharge.id, id: lot.id },
          body: changes,
        })
        const moves = movedDoors(response.data, lot.id, changes.assign)

        toast.success('Warehouse doors updated', {
          description:
            moves.length > 0
              ? [...new Set(moves.map((move) => `Taken from ${lotLabel(move.fromLot)}`))].join('\n')
              : undefined,
        })
        onDone()
      } catch (error) {
        const apiError = parseApiError(error)
        const stale = staleRefusalMessage(apiError.code)

        if (stale) {
          toast.error(stale)
          onDone()

          return
        }

        if (apiError.code === 'E_VALIDATION_ERROR') {
          const details = apiError.details as ValidationDetail[]
          // A shift the page did not know about holds a door: the refreshed detail locks its row.
          if (details.some((detail) => detail.rule === 'selectedByPlannedShift')) {
            await queryClient.fetchQuery(dischargeQueries.detail(discharge.id))
          }

          const byDoor = new Map<string, string>()
          const messages = new Set<string>()
          describeIssues(details, changes, nameOf).forEach((issue, index) => {
            if (!issue.id) {
              messages.add(issue.text)

              return
            }

            messages.add(
              issue.list === 'withdraw'
                ? DOORS_NOT_REMOVABLE_MESSAGE
                : DOORS_NOT_SELECTABLE_MESSAGE,
            )
            // The row already says why a shift keeps its door; any other reason is the API's.
            if (details[index].rule !== 'selectedByPlannedShift') {
              byDoor.set(issue.id, issue.message)
            }
          })

          setRefusals(byDoor)
          setAlert([...messages])

          return
        }

        toast.error('Unable to update the warehouse doors', { description: apiError.message })
      }
    },
  })

  const chosenIds = useStore(form.store, (state) => state.values.warehouseDoorIds)
  const known = useResourceRows(held, offered, chosenIds).map((door) => ({
    ...door,
    // A held door keeps what the detail knows of it: archived, whatever the options say.
    archived: held.find((candidate) => candidate.id === door.id)?.archived,
  }))
  const nameOf = (id: string) => {
    const door = known.find((candidate) => candidate.id === id)

    return door ? `${door.warehouse.name} › ${door.name}` : id
  }
  const columns = lotDoorColumns(known, chosenIds)
  const chosen = new Set(chosenIds)
  const availableCount = columns.available.reduce((total, group) => total + group.doors.length, 0)

  const move = (doorId: string, next: boolean, focusTarget: string) => {
    form.setFieldValue(
      'warehouseDoorIds',
      next ? [...chosenIds, doorId] : chosenIds.filter((id) => id !== doorId),
    )
    setFocusId(focusTarget)
  }

  const available = (
    // Only this column waits for the options: the lot's own doors come with the detail.
    <PlanningOptionsState noun="warehouse doors" state={doors}>
      <AvailableDoorsColumn
        actionId={actionId}
        chosen={chosen}
        discharge={discharge}
        groups={columns.available}
        heldIds={heldIds}
        lot={lot}
        onAdd={(doorId, target) => move(doorId, true, target)}
        refusals={refusals}
        searchId={searchId}
      />
    </PlanningOptionsState>
  )
  const assigned = (
    <AssignedDoorsColumn
      actionId={actionId}
      chosen={chosen}
      discharge={discharge}
      doors={columns.assigned}
      headingId={assignedHeadingId}
      heldIds={heldIds}
      lot={lot}
      onRemove={(doorId, target) => move(doorId, false, target)}
      refusals={refusals}
    />
  )
  const unavailable = doors.loading || doors.onRetry !== undefined

  return (
    <form.AppForm>
      <form.Form className="flex min-h-0 flex-1 flex-col" noValidate={true}>
        {alert && (
          <div className="shrink-0 px-4 pt-4">
            <Alert ref={alertRef} tabIndex={-1} variant="destructive">
              <AlertDescription>
                {alert.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </AlertDescription>
            </Alert>
          </div>
        )}
        {isMobile ? (
          <Tabs
            className="flex min-h-0 flex-1 flex-col"
            onValueChange={(value) => setTab(value as typeof tab)}
            value={tab}
          >
            <TabsList className="mx-4 mt-4 w-auto shrink-0">
              <TabsTrigger value="available">Available ({availableCount})</TabsTrigger>
              <TabsTrigger value="assigned">Assigned ({columns.assigned.length})</TabsTrigger>
            </TabsList>
            <TabsContent className="min-h-0 overflow-y-auto" value="available">
              <Column heading="Available" headingId={availableHeadingId} srOnlyHeading={true}>
                {available}
              </Column>
            </TabsContent>
            <TabsContent className="min-h-0 overflow-y-auto" value="assigned">
              <Column
                heading="Assigned to this lot"
                headingId={assignedHeadingId}
                srOnlyHeading={true}
              >
                {assigned}
              </Column>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-2 divide-x">
            <Column
              count={availableCount}
              heading="Available"
              headingId={availableHeadingId}
              scroll={true}
            >
              {available}
            </Column>
            <Column
              count={columns.assigned.length}
              heading="Assigned to this lot"
              headingId={assignedHeadingId}
              scroll={true}
            >
              {assigned}
            </Column>
          </div>
        )}
        <DialogFooter className="shrink-0 flex-row flex-wrap items-center gap-3 border-t p-4 sm:flex-row sm:flex-nowrap">
          <LotDoorChangeSummary
            chosenIds={chosenIds}
            discharge={discharge}
            lot={lot}
            nameOf={nameOf}
          />
          {/* Kept together, so a long summary wraps beside them rather than splitting them. */}
          <div className="ml-auto flex shrink-0 gap-3">
            <Button onClick={onDone} type="button" variant="outline">
              Cancel
            </Button>
            <form.SubmitButton disabled={unavailable} pendingLabel={WRITE_PENDING_LABELS.update}>
              Save
            </form.SubmitButton>
          </div>
        </DialogFooter>
      </form.Form>
    </form.AppForm>
  )
}

function Column({
  children,
  count,
  heading,
  headingId,
  scroll = false,
  srOnlyHeading = false,
}: {
  children: ReactNode
  count?: number
  heading: string
  headingId: string
  scroll?: boolean
  srOnlyHeading?: boolean
}) {
  return (
    <section
      aria-labelledby={headingId}
      className={scroll ? 'flex min-h-0 flex-col overflow-y-auto p-4' : 'flex flex-col p-4'}
    >
      {/* Focusable, so it takes the focus once the last door a column could move has left it. */}
      <h3
        className={srOnlyHeading ? 'sr-only' : 'mb-3 font-medium text-sm outline-none'}
        id={headingId}
        tabIndex={-1}
      >
        {heading}
        {count !== undefined && (
          <span aria-hidden="true" className="text-muted-foreground tabular-nums">
            {' '}
            ({count})
          </span>
        )}
      </h3>
      {children}
    </section>
  )
}
