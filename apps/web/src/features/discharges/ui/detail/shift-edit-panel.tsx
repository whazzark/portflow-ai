import { revalidateLogic } from '@tanstack/react-form'
import { ArrowLeftIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import {
  formatShiftDuration,
  SHIFT_CORRECTION_FIELDS,
  type ShiftCorrectionFormValues,
  shiftCorrectionFieldOf,
  shiftCorrectionFieldsSchema,
  shiftCorrectionFormValues,
  shiftCorrectionRulesSchema,
  toShiftCorrectionBody,
} from '@/features/discharges/discharge-preparation-schema'
import { useDischargeMutations } from '@/features/discharges/mutations/use-discharge-mutations'
import { listRefusals } from '@/features/discharges/truck-pool-refusals'
import { heldPoolEntries, offeredShiftTrucks } from '@/features/discharges/truck-pool-selection'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { DischargeTabLink } from '@/features/discharges/ui/detail/discharge-tab-link'
import { STARTED_REFUSAL_MESSAGE } from '@/features/discharges/ui/detail/edit-discharge-identity-sheet'
import { ReferenceLabel } from '@/features/discharges/ui/detail/reference-label'
import {
  type ChecklistRow,
  ShiftResourceChecklist,
} from '@/features/discharges/ui/detail/shift-resource-checklist'
import {
  useResponsibleOptions,
  useWarehouseDoorOptions,
  useWeighingAreaOptions,
} from '@/features/discharges/ui/preparation/preparation-options'
import { WRITE_PENDING_LABELS } from '@/helpers/resource-copy'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

type Shift = DischargeDetailDto['shifts'][number]

type ShiftEditPanelProps = {
  discharge: DischargeDetailDto
  shift: Shift
  /** Back to the shift's details, after a save, a refusal that ends the edit, or on request. */
  onBack: () => void
}

export const SHIFT_GONE_MESSAGE = 'This shift is no longer planned'

type ResourceList = 'truckIds' | 'warehouseDoorIds' | 'weighingAreaIds'
type Refusals = Record<ResourceList, ReadonlyMap<string, string>>

const NO_REFUSALS: Refusals = {
  truckIds: new Map(),
  warehouseDoorIds: new Map(),
  weighingAreaIds: new Map(),
}

const REFUSAL_TITLES: Record<ResourceList, string> = {
  truckIds: 'Some trucks can no longer be selected',
  warehouseDoorIds: 'Some warehouse doors can no longer be selected',
  weighingAreaIds: 'Some weighing areas can no longer be selected',
}

/** The shift panel's correction of a planned shift, left through its header as every edit panel is. */
export function ShiftEditPanel({ discharge, shift, onBack }: ShiftEditPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* Sticky because "Back to details" is the only way out, and a long pool scrolls the header
          away with it. */}
      <SheetHeader className="sticky top-0 z-10 bg-popover">
        <Button className="self-start" onClick={onBack} size="sm" variant="ghost">
          <ArrowLeftIcon aria-hidden="true" />
          Back to details
        </Button>
        <SheetTitle>Edit shift</SheetTitle>
        <SheetDescription>
          Correct shift {formatShiftPeriod(shift)}: its period, its responsible, and the resources
          it will use.
        </SheetDescription>
      </SheetHeader>
      <ShiftEditForm discharge={discharge} onDone={onBack} shift={shift} />
    </div>
  )
}

/**
 * A resource list that keeps each row it has shown: one the refreshed choices no longer offer stays
 * listed while it is selected, so its refusal remains readable, but it may only be let go of.
 */
function useResourceRows<Row extends ChecklistRow>(
  current: Row[],
  offered: Row[],
  selected: readonly string[],
) {
  const seen = useRef(new Map<string, Row>())
  for (const row of [...current, ...offered]) {
    seen.current.set(row.id, row)
  }

  const offeredIds = new Set(offered.map((row) => row.id))
  const listed = new Set([...current.map((row) => row.id), ...offeredIds, ...selected])

  return [...seen.current.values()]
    .filter((row) => listed.has(row.id))
    .map((row) => ({ ...row, canCheck: offeredIds.has(row.id) }))
}

function ShiftEditForm({
  discharge,
  shift,
  onDone,
}: {
  discharge: DischargeDetailDto
  shift: Shift
  onDone: () => void
}) {
  const { correctShift } = useDischargeMutations()
  const responsibles = useResponsibleOptions()
  const doors = useWarehouseDoorOptions()
  const areas = useWeighingAreaOptions()
  const [refusals, setRefusals] = useState<Refusals>(NO_REFUSALS)
  const refusalAlert = useRef<HTMLDivElement>(null)

  // Fixed when the edit opens, so a refreshed detail never moves a row under the user's pointer.
  const [trucks] = useState(() => offeredShiftTrucks(discharge, shift.id))
  const [currentDoors] = useState<ChecklistRow[]>(() =>
    shift.warehouseDoors
      .filter((membership) => membership.effectiveTo === null)
      .map((membership) => ({
        id: membership.warehouseDoor.id,
        name: `${membership.warehouse.name} › ${membership.warehouseDoor.name}`,
        label: doorLabel(membership.warehouse, membership.warehouseDoor),
        canCheck: false,
      })),
  )
  const [currentAreas] = useState<ChecklistRow[]>(() =>
    shift.weighingAreas
      .filter((membership) => membership.effectiveTo === null)
      .map((membership) => ({
        id: membership.weighingArea.id,
        name: membership.weighingArea.name,
        label: (
          <ReferenceLabel
            name={membership.weighingArea.name}
            status={membership.weighingArea.status}
          />
        ),
        canCheck: false,
      })),
  )

  const form = useAppForm({
    defaultValues: shiftCorrectionFormValues(shift),
    // A period is judged against the discharge's other shifts on submit, then on every change, so
    // moving it clear of another shift clears the error at once.
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: {
      onChange: shiftCorrectionFieldsSchema,
      onDynamic: shiftCorrectionRulesSchema(
        discharge.shifts.filter((other) => other.id !== shift.id),
      ),
    },
    onSubmit: async ({ formApi, value }) => {
      try {
        await correctShift.mutateAsync({
          params: { dischargeId: discharge.id, shiftId: shift.id },
          body: toShiftCorrectionBody(value),
        })
        toast.success('Shift updated')
        onDone()
      } catch (error) {
        if (applyValidationError(formApi, error, SHIFT_CORRECTION_FIELDS, shiftCorrectionFieldOf)) {
          const apiError = parseApiError(error)
          setRefusals({
            truckIds: listRefusals(apiError, 'truckIds', value.truckIds),
            warehouseDoorIds: listRefusals(apiError, 'warehouseDoorIds', value.warehouseDoorIds),
            weighingAreaIds: listRefusals(apiError, 'weighingAreaIds', value.weighingAreaIds),
          })

          return
        }

        const apiError = parseApiError(error)
        if (
          apiError.code === 'E_DISCHARGE_NOT_PLANNED' ||
          apiError.code === 'E_DISCHARGE_NOT_FOUND'
        ) {
          toast.error(STARTED_REFUSAL_MESSAGE)
          onDone()

          return
        }
        if (apiError.code === 'E_SHIFT_NOT_FOUND' || apiError.code === 'E_SHIFT_NOT_PLANNED') {
          toast.error(SHIFT_GONE_MESSAGE)
          onDone()

          return
        }

        toast.error('Unable to update the shift', { description: apiError.message })
      }
    },
  })

  const refusedLists = (Object.keys(REFUSAL_TITLES) as ResourceList[]).filter(
    (list) => refusals[list].size > 0,
  )

  useEffect(() => {
    if (Object.values(refusals).some((reasons) => reasons.size > 0)) {
      refusalAlert.current?.focus()
    }
  }, [refusals])

  // A refused truck the refreshed pool no longer holds stays listed so its reason is readable, but
  // like a suspended one it may only be let go of.
  const heldNow = new Set(heldPoolEntries(discharge).map((entry) => entry.truckId))
  const truckRows: ChecklistRow[] = trucks.map((truck) => ({
    id: truck.truckId,
    name: truck.registration,
    label: <ReferenceLabel name={truck.registration} status={truck.truckStatus} />,
    canCheck:
      truck.canCheck && !(refusals.truckIds.has(truck.truckId) && !heldNow.has(truck.truckId)),
  }))

  const responsibleOptions = [
    ...(responsibles.options.some((option) => option.id === shift.responsible.id)
      ? []
      : [shift.responsible]),
    ...responsibles.options,
  ]

  return (
    <form.AppForm>
      <form.Form className="flex flex-1 flex-col gap-6 px-4 pb-4" noValidate={true}>
        {refusedLists.length > 0 && (
          <Alert ref={refusalAlert} tabIndex={-1} variant="destructive">
            <AlertDescription>
              {refusedLists.map((list) => (
                <p key={list}>{REFUSAL_TITLES[list]}</p>
              ))}
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <form.AppField name="responsibleUserId">
              {(field) => (
                <field.ComboboxField
                  emptyMessage="No responsible matches"
                  label="Responsible"
                  loading={responsibles.loading}
                  onRetry={responsibles.onRetry}
                  options={responsibleOptions.map((responsible) => ({
                    label: `${responsible.firstName} ${responsible.lastName}`,
                    value: responsible.id,
                  }))}
                  placeholder="Search a responsible"
                  required={true}
                />
              )}
            </form.AppField>
          </div>
          <form.Subscribe
            selector={(state) =>
              formatShiftDuration(state.values.plannedStartAt, state.values.plannedEndAt)
            }
          >
            {(length) => (
              <p className="text-muted-foreground text-sm tabular-nums sm:col-span-2">
                Duration {length}
              </p>
            )}
          </form.Subscribe>
          <form.AppField name="plannedStartAt">
            {(field) => <field.DateTimeField label="Planned start" required={true} />}
          </form.AppField>
          <form.AppField name="plannedEndAt">
            {(field) => <field.DateTimeField label="Planned end" required={true} />}
          </form.AppField>
        </div>
        <form.AppField name="weighingAreaIds">
          {(field) => (
            <ResourceField
              current={currentAreas}
              empty="No weighing area available"
              label="Weighing areas"
              loading={areas.loading}
              lockedNote="Archived weighing areas cannot be newly selected"
              offered={areas.options.map((area) => ({
                id: area.id,
                name: area.name,
                label: <ReferenceLabel name={area.name} status={area.status} />,
                canCheck: true,
              }))}
              onChange={field.handleChange}
              onRetry={areas.onRetry}
              reasons={refusals.weighingAreaIds}
              selected={field.state.value}
            />
          )}
        </form.AppField>
        <form.AppField name="warehouseDoorIds">
          {(field) => (
            <ResourceField
              current={currentDoors}
              empty="No warehouse door available"
              label="Warehouse doors"
              loading={doors.loading}
              lockedNote="Archived doors cannot be newly selected"
              offered={doors.options.map((door) => ({
                id: door.id,
                name: `${door.warehouse.name} › ${door.name}`,
                label: doorLabel(door.warehouse, door),
                canCheck: true,
              }))}
              onChange={field.handleChange}
              onRetry={doors.onRetry}
              reasons={refusals.warehouseDoorIds}
              selected={field.state.value}
            />
          )}
        </form.AppField>
        <form.AppField name="truckIds">
          {(field) => (
            <ShiftResourceChecklist
              empty={
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">No trucks reserved</span>
                  {/* Back to the details first, so the panel lets go of focus before its section
                      is left. */}
                  <DischargeTabLink
                    className={buttonVariants({ size: 'sm', variant: 'outline' })}
                    onClick={onDone}
                    tab="truck-pool"
                  >
                    Go to truck pool
                  </DischargeTabLink>
                </div>
              }
              label="Trucks"
              lockedNote="Suspended trucks cannot be newly selected"
              onChange={field.handleChange}
              reasons={refusals.truckIds}
              rows={truckRows}
              selected={field.state.value}
            />
          )}
        </form.AppField>
        <SheetFooter className="sticky bottom-0 mt-auto flex-row items-center justify-end gap-3 bg-popover px-0 py-3">
          <form.FormError className="mr-auto" />
          <form.SubmitButton pendingLabel={WRITE_PENDING_LABELS.update}>Save</form.SubmitButton>
        </SheetFooter>
      </form.Form>
    </form.AppForm>
  )
}

function doorLabel(
  warehouse: { name: string; status: 'AVAILABLE' | 'ARCHIVED' },
  door: { name: string; status: 'AVAILABLE' | 'ARCHIVED' },
) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <ReferenceLabel name={warehouse.name} status={warehouse.status} />
      {' › '}
      <ReferenceLabel name={door.name} status={door.status} />
    </span>
  )
}

function ResourceField({
  current,
  empty,
  offered,
  selected,
  ...props
}: {
  current: ChecklistRow[]
  offered: ChecklistRow[]
  selected: ShiftCorrectionFormValues['warehouseDoorIds']
  empty: string
  label: string
  lockedNote: string
  loading: boolean
  onRetry?: () => void
  onChange: (ids: string[]) => void
  reasons: ReadonlyMap<string, string>
}) {
  const rows = useResourceRows(current, offered, selected)

  return (
    <ShiftResourceChecklist
      {...props}
      empty={<p className="text-muted-foreground text-sm">{empty}</p>}
      rows={rows}
      selected={selected}
    />
  )
}
