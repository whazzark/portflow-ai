import { revalidateLogic } from '@tanstack/react-form'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  addShiftFormValues,
  addShiftRulesSchema,
  type DrawnShiftPeriod,
  SHIFT_CORRECTION_FIELDS,
  shiftCorrectionFieldOf,
  shiftCorrectionFieldsSchema,
  toAddShiftBody,
} from '@/features/discharges/discharge-preparation-schema'
import { useDischargeMutations } from '@/features/discharges/mutations/use-discharge-mutations'
import { listRefusals } from '@/features/discharges/truck-pool-refusals'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { ShiftResourceRefusalAlert } from '@/features/discharges/ui/detail/shift-edit-panel'
import {
  NO_SHIFT_RESOURCE_REFUSALS,
  ShiftPeriodFields,
  ShiftResourceFields,
  type ShiftResourceRefusals,
} from '@/features/discharges/ui/detail/shift-resource-fields'
import { WRITE_PENDING_LABELS } from '@/helpers/resource-copy'
import { useIsMobile } from '@/hooks/use-mobile'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

export const ADDITION_STARTED_MESSAGE = 'This discharge has started'
export const ADDITION_CLOSED_MESSAGE = 'This discharge is closed'
const ADDITION_GONE_MESSAGE = 'This discharge no longer exists'

type AddShiftSheetProps = {
  discharge: DischargeDetailDto
  open: boolean
  /** The period drawn on the calendar, when the addition starts there. */
  period?: DrawnShiftPeriod
  onOpenChange: (open: boolean) => void
  /** Called with the new shift's identity once it is added, to open its panel. */
  onAdded: (shiftId: string) => void
}

export function AddShiftSheet({
  discharge,
  onAdded,
  onOpenChange,
  open,
  period,
}: AddShiftSheetProps) {
  const isMobile = useIsMobile()
  const planned = discharge.status === 'PLANNED'

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="gap-0 overflow-y-auto data-[side=bottom]:h-[min(75dvh,38rem)]"
        side={isMobile ? 'bottom' : 'right'}
        size="lg"
      >
        <SheetHeader>
          <SheetTitle>Add shift</SheetTitle>
          <SheetDescription>
            {planned
              ? `Plan a new shift for ${discharge.vesselName}: its period, its responsible, and the resources it will use.`
              : `Plan a new shift for ${discharge.vesselName}: its period and its responsible. Its resources are chosen once it is added.`}
          </SheetDescription>
        </SheetHeader>
        {/* Mounted only while open, so every opening starts a new addition with its own identity. */}
        {open && (
          <AddShiftForm
            discharge={discharge}
            onAdded={(shiftId) => {
              onOpenChange(false)
              onAdded(shiftId)
            }}
            onDone={() => onOpenChange(false)}
            period={period}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function AddShiftForm({
  discharge,
  onAdded,
  onDone,
  period,
}: {
  discharge: DischargeDetailDto
  onAdded: (shiftId: string) => void
  onDone: () => void
  period: DrawnShiftPeriod | undefined
}) {
  const { addShift } = useDischargeMutations()
  // One identity for the whole addition, kept across its retries, so a resubmission finds the shift
  // it already added instead of adding a second one.
  const [id] = useState(() => crypto.randomUUID())
  const [refusals, setRefusals] = useState<ShiftResourceRefusals>(NO_SHIFT_RESOURCE_REFUSALS)
  const refusalAlert = useRef<HTMLDivElement>(null)
  const planned = discharge.status === 'PLANNED'

  const form = useAppForm({
    defaultValues: addShiftFormValues(discharge, period),
    // The period is judged against the discharge's shifts on submit, then on every change, so moving
    // it clear of another shift clears the error at once.
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: {
      onChange: shiftCorrectionFieldsSchema,
      onDynamic: addShiftRulesSchema(discharge.shifts, id),
    },
    onSubmit: async ({ formApi, value }) => {
      try {
        await addShift.mutateAsync({
          params: { dischargeId: discharge.id },
          body: toAddShiftBody(value, id, discharge.status),
        })
        toast.success('Shift added')
        onAdded(id)
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
        if (apiError.code === 'E_DISCHARGE_NOT_PLANNED') {
          // The discharge started since the form opened: its new shift is still wanted, but takes
          // no resource now. The refreshed detail hides the resource fields.
          toast.error(ADDITION_STARTED_MESSAGE)
          formApi.setFieldValue('truckIds', [])
          formApi.setFieldValue('warehouseDoorIds', [])
          formApi.setFieldValue('weighingAreaIds', [])
          setRefusals(NO_SHIFT_RESOURCE_REFUSALS)

          return
        }
        if (apiError.code === 'E_DISCHARGE_CLOSED') {
          toast.error(ADDITION_CLOSED_MESSAGE)
          onDone()

          return
        }
        if (apiError.code === 'E_DISCHARGE_NOT_FOUND') {
          toast.error(ADDITION_GONE_MESSAGE)
          onDone()

          return
        }

        toast.error('Unable to add the shift', { description: apiError.message })
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
          kept={undefined}
        />
        {planned && (
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
            shift={undefined}
          />
        )}
        <SheetFooter className="sticky bottom-0 mt-auto flex-row items-center justify-end gap-3 bg-popover px-0 py-3">
          <form.FormError className="mr-auto" />
          <form.SubmitButton pendingLabel={WRITE_PENDING_LABELS.create}>
            Add shift
          </form.SubmitButton>
        </SheetFooter>
      </form.Form>
    </form.AppForm>
  )
}
