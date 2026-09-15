import { toast } from 'sonner'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  dischargeIdentitySchema,
  identityFormValues,
  toIdentityBody,
} from '@/features/discharges/discharge-preparation-schema'
import { useDischargeMutations } from '@/features/discharges/mutations/use-discharge-mutations'
import type { DischargeDetailDto } from '@/features/discharges/types'
import {
  DischargeIdentityFields,
  ROOT_IDENTITY_FIELDS,
} from '@/features/discharges/ui/preparation/discharge-identity-fields'
import { useDockOptions } from '@/features/discharges/ui/preparation/preparation-options'
import {
  resourceFailureTitle,
  resourceSuccessMessage,
  WRITE_PENDING_LABELS,
} from '@/helpers/resource-copy'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

type EditDischargeIdentitySheetProps = {
  discharge: DischargeDetailDto
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const STARTED_REFUSAL_MESSAGE = 'This discharge has started and can no longer be corrected'

export function EditDischargeIdentitySheet({
  discharge,
  open,
  onOpenChange,
}: EditDischargeIdentitySheetProps) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="overflow-y-auto" size="lg">
        <SheetHeader>
          <SheetTitle>Edit discharge</SheetTitle>
          <SheetDescription>Correct the vessel, dock, and expected start.</SheetDescription>
        </SheetHeader>
        {/* Mounted with the sheet, so each opening starts from the discharge as it stands. */}
        {open && (
          <EditDischargeIdentityForm discharge={discharge} onDone={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function EditDischargeIdentityForm({
  discharge,
  onDone,
}: {
  discharge: DischargeDetailDto
  onDone: () => void
}) {
  const { correctIdentity } = useDischargeMutations()
  const docks = useDockOptions(discharge.dock)

  const form = useAppForm({
    defaultValues: identityFormValues(discharge),
    validators: { onChange: dischargeIdentitySchema, onSubmit: dischargeIdentitySchema },
    onSubmit: async ({ formApi, value }) => {
      try {
        const response = await correctIdentity.mutateAsync({
          params: { id: discharge.id },
          body: toIdentityBody(value),
        })

        toast.success(resourceSuccessMessage('update', 'discharge', response.data.vesselName))
        onDone()
      } catch (error) {
        if (applyValidationError(formApi, error)) {
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

        toast.error(resourceFailureTitle('update', 'discharge', discharge.vesselName), {
          description: apiError.message,
        })
      }
    },
  })

  return (
    <div className="px-4 pb-4">
      <form.AppForm>
        <form.Form className="flex flex-col gap-6" noValidate={true}>
          <DischargeIdentityFields docks={docks} fields={ROOT_IDENTITY_FIELDS} form={form} />
          <form.FormError />
          <form.SubmitButton className="self-end" pendingLabel={WRITE_PENDING_LABELS.update}>
            Save
          </form.SubmitButton>
        </form.Form>
      </form.AppForm>
    </div>
  )
}
