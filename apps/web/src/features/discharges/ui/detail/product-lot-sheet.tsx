import { toast } from 'sonner'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  emptyProductLot,
  productLotFormValues,
  productLotSchema,
  toProductLotBody,
} from '@/features/discharges/discharge-preparation-schema'
import { useDischargeMutations } from '@/features/discharges/mutations/use-discharge-mutations'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { STARTED_REFUSAL_MESSAGE } from '@/features/discharges/ui/detail/edit-discharge-identity-sheet'
import { useCustomerOptions } from '@/features/discharges/ui/preparation/preparation-options'
import { ProductLotFields } from '@/features/discharges/ui/preparation/product-lot-fields'
import { WRITE_PENDING_LABELS } from '@/helpers/resource-copy'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

type ProductLot = DischargeDetailDto['productLots'][number]

type ProductLotSheetProps = {
  discharge: DischargeDetailDto
  /** The lot being corrected; absent when a lot is being added. */
  lot?: ProductLot
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ROOT_LOT_FIELDS = {
  customerId: 'customerId',
  productName: 'productName',
  expectedQuantityTonnes: 'expectedQuantityTonnes',
  description: 'description',
} as const

export const LOT_GONE_MESSAGE = 'This product lot no longer exists'

export function ProductLotSheet({ discharge, lot, open, onOpenChange }: ProductLotSheetProps) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="overflow-y-auto" size="lg">
        <SheetHeader>
          <SheetTitle>{lot ? 'Edit product lot' : 'Add product lot'}</SheetTitle>
          <SheetDescription>
            {lot
              ? 'Correct the customer, product, expected quantity, or description of this lot.'
              : 'Add a lot of bulk material this discharge unloads for a customer.'}
          </SheetDescription>
        </SheetHeader>
        {open && (
          <ProductLotForm discharge={discharge} lot={lot} onDone={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function ProductLotForm({
  discharge,
  lot,
  onDone,
}: {
  discharge: DischargeDetailDto
  lot?: ProductLot
  onDone: () => void
}) {
  const { addLot, correctLot } = useDischargeMutations()
  const customers = useCustomerOptions(lot?.customer)

  const form = useAppForm({
    defaultValues: lot ? productLotFormValues(lot) : emptyProductLot(),
    validators: { onChange: productLotSchema, onSubmit: productLotSchema },
    onSubmit: async ({ formApi, value }) => {
      try {
        if (lot) {
          await correctLot.mutateAsync({
            params: { dischargeId: discharge.id, id: lot.id },
            body: toProductLotBody(value),
          })
          toast.success('Product lot updated')
        } else {
          await addLot.mutateAsync({
            params: { dischargeId: discharge.id },
            body: toProductLotBody(value),
          })
          toast.success('Product lot added')
        }
        onDone()
      } catch (error) {
        if (applyValidationError(formApi, error)) {
          return
        }

        const apiError = parseApiError(error)
        const staleMessages: Record<string, string> = {
          E_DISCHARGE_NOT_PLANNED: STARTED_REFUSAL_MESSAGE,
          E_DISCHARGE_NOT_FOUND: STARTED_REFUSAL_MESSAGE,
          E_PRODUCT_LOT_NOT_FOUND: LOT_GONE_MESSAGE,
        }
        const stale = staleMessages[apiError.code ?? '']

        if (stale) {
          toast.error(stale)
          onDone()

          return
        }

        toast.error(lot ? 'Unable to update the product lot' : 'Unable to add the product lot', {
          description: apiError.message,
        })
      }
    },
  })

  return (
    <div className="px-4 pb-4">
      <form.AppForm>
        <form.Form className="flex flex-col gap-6" noValidate={true}>
          <ProductLotFields
            customers={customers}
            fields={ROOT_LOT_FIELDS}
            form={form}
            layout="stacked"
            trailing={null}
          />
          <form.FormError />
          <form.SubmitButton
            className="self-end"
            pendingLabel={lot ? WRITE_PENDING_LABELS.update : 'Adding…'}
          >
            {lot ? 'Save' : 'Add product lot'}
          </form.SubmitButton>
        </form.Form>
      </form.AppForm>
    </div>
  )
}
