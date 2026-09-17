import { revalidateLogic } from '@tanstack/react-form'
import { ArrowLeftIcon } from 'lucide-react'
import { type Ref, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import {
  SHIFT_CORRECTION_FIELDS,
  shiftCorrectionFieldOf,
  shiftCorrectionFieldsSchema,
  shiftCorrectionFormValues,
  shiftCorrectionRulesSchema,
  toShiftCorrectionBody,
} from '@/features/discharges/discharge-preparation-schema'
import { useDischargeMutations } from '@/features/discharges/mutations/use-discharge-mutations'
import { listRefusals } from '@/features/discharges/truck-pool-refusals'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { STARTED_REFUSAL_MESSAGE } from '@/features/discharges/ui/detail/edit-discharge-identity-sheet'
import {
  NO_SHIFT_RESOURCE_REFUSALS,
  SHIFT_RESOURCE_REFUSAL_TITLES,
  ShiftPeriodFields,
  ShiftResourceFields,
  type ShiftResourceList,
  type ShiftResourceRefusals,
} from '@/features/discharges/ui/detail/shift-resource-fields'
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
  const [refusals, setRefusals] = useState<ShiftResourceRefusals>(NO_SHIFT_RESOURCE_REFUSALS)
  const refusalAlert = useRef<HTMLDivElement>(null)

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
          body: toShiftCorrectionBody(value, shift),
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

  useEffect(() => {
    if (Object.values(refusals).some((reasons) => reasons.size > 0)) {
      refusalAlert.current?.focus()
    }
  }, [refusals])

  return (
    <form.AppForm>
      <form.Form className="flex flex-1 flex-col gap-6 px-4 pb-4" noValidate={true}>
        <ShiftResourceRefusalAlert ref={refusalAlert} refusals={refusals} />
        <ShiftPeriodFields
          fields={{
            plannedStartAt: 'plannedStartAt',
            plannedEndAt: 'plannedEndAt',
            responsibleUserId: 'responsibleUserId',
          }}
          form={form}
          kept={shift.responsible}
        />
        <ShiftResourceFields
          discharge={discharge}
          fields={{
            truckIds: 'truckIds',
            warehouseDoorIds: 'warehouseDoorIds',
            weighingAreaIds: 'weighingAreaIds',
          }}
          form={form}
          onLeave={onDone}
          refusals={refusals}
          shift={shift}
        />
        <SheetFooter className="sticky bottom-0 mt-auto flex-row items-center justify-end gap-3 bg-popover px-0 py-3">
          <form.FormError className="mr-auto" />
          <form.SubmitButton pendingLabel={WRITE_PENDING_LABELS.update}>Save</form.SubmitButton>
        </SheetFooter>
      </form.Form>
    </form.AppForm>
  )
}

/** Which resource lists the API refused, above the form; it takes focus so the refusal is read. */
export function ShiftResourceRefusalAlert({
  ref,
  refusals,
}: {
  ref: Ref<HTMLDivElement>
  refusals: ShiftResourceRefusals
}) {
  const refused = (Object.keys(SHIFT_RESOURCE_REFUSAL_TITLES) as ShiftResourceList[]).filter(
    (list) => refusals[list].size > 0,
  )
  if (refused.length === 0) {
    return null
  }

  return (
    <Alert ref={ref} tabIndex={-1} variant="destructive">
      <AlertDescription>
        {refused.map((list) => (
          <p key={list}>{SHIFT_RESOURCE_REFUSAL_TITLES[list]}</p>
        ))}
      </AlertDescription>
    </Alert>
  )
}
