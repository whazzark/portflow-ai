import { revalidateLogic } from '@tanstack/react-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatTonnes, sumTonnes } from '@/features/discharges/discharge-detail-view'
import {
  addProductLotsCrossRulesSchema,
  addProductLotsFieldsSchema,
  addProductLotsFormDefaults,
  flattenLotGroups,
  lotGroupFieldNames,
  lotGroupFieldOf,
  toProductLotsBody,
} from '@/features/discharges/discharge-preparation-schema'
import { useDischargeMutations } from '@/features/discharges/mutations/use-discharge-mutations'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { STARTED_REFUSAL_MESSAGE } from '@/features/discharges/ui/detail/edit-discharge-identity-sheet'
import { useCustomerOptions } from '@/features/discharges/ui/preparation/preparation-options'
import { ProductLotGroupsEditor } from '@/features/discharges/ui/preparation/product-lot-groups-editor'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

type AddProductLotsSheetProps = {
  discharge: DischargeDetailDto
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddProductLotsSheet({ discharge, open, onOpenChange }: AddProductLotsSheetProps) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="overflow-y-auto" size="lg">
        <SheetHeader>
          <SheetTitle>Add product lots</SheetTitle>
          <SheetDescription>
            Add the material this discharge unloads, customer by customer. All the lots are added
            together, or none.
          </SheetDescription>
        </SheetHeader>
        {open && <AddProductLotsForm discharge={discharge} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

const plural = (count: number) => `${count} lot${count === 1 ? '' : 's'}`

function AddProductLotsForm({
  discharge,
  onDone,
}: {
  discharge: DischargeDetailDto
  onDone: () => void
}) {
  const { addLots } = useDischargeMutations()
  const customers = useCustomerOptions()

  const form = useAppForm({
    defaultValues: addProductLotsFormDefaults(),
    // A product repeated across two rows puts its error on both: judged on submit, then on every
    // change, so fixing one clears the other.
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: {
      onChange: addProductLotsFieldsSchema,
      onDynamic: addProductLotsCrossRulesSchema(
        discharge.productLots.map((lot) => ({
          customerId: lot.customer.id,
          productName: lot.productName,
        })),
      ),
    },
    onSubmit: async ({ formApi, value }) => {
      const count = flattenLotGroups(value.lotGroups).length

      try {
        await addLots.mutateAsync({
          params: { dischargeId: discharge.id },
          body: { productLots: toProductLotsBody(value.lotGroups) },
        })
        toast.success(count === 1 ? 'Product lot added' : `${count} product lots added`)
        onDone()
      } catch (error) {
        if (
          applyValidationError(formApi, error, lotGroupFieldNames(value.lotGroups), (field) =>
            lotGroupFieldOf(field, value.lotGroups),
          )
        ) {
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

        toast.error(
          count === 1 ? 'Unable to add the product lot' : 'Unable to add the product lots',
          {
            description: apiError.message,
          },
        )
      }
    },
  })

  return (
    <div className="px-4 pb-4">
      <form.AppForm>
        <form.Form className="flex flex-col gap-6" noValidate={true}>
          <ProductLotGroupsEditor
            customers={customers}
            fields={{ lotGroups: 'lotGroups' }}
            form={form}
          />
          <form.FormError />
          <SheetFooter className="flex-row flex-wrap items-center justify-end gap-2 p-0">
            <form.Subscribe
              selector={(state) => {
                const lots = flattenLotGroups(state.values.lotGroups)

                return {
                  count: lots.length,
                  tonnage: sumTonnes(lots.map((lot) => lot.expectedQuantityTonnes)),
                }
              }}
            >
              {({ count, tonnage }) => (
                <p className="mr-auto text-muted-foreground text-sm tabular-nums">
                  {plural(count)} · {tonnage === null ? '—' : formatTonnes(tonnage)}
                </p>
              )}
            </form.Subscribe>
            <Button onClick={onDone} type="button" variant="outline">
              Cancel
            </Button>
            <form.SubmitButton pendingLabel="Adding…">Add product lots</form.SubmitButton>
          </SheetFooter>
        </form.Form>
      </form.AppForm>
    </div>
  )
}
