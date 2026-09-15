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
import { correctionRowRemoval } from '@/features/discharges/customer-lots-correction'
import {
  formatTonnes,
  groupLotsByCustomer,
  sumTonnes,
} from '@/features/discharges/discharge-detail-view'
import {
  type CorrectionLineFormValues,
  correctionLineOf,
  customerProductLotsCrossRulesSchema,
  customerProductLotsFieldNames,
  customerProductLotsFieldOf,
  customerProductLotsFieldsSchema,
  customerProductLotsFormValues,
  emptyCorrectionLine,
  toCustomerProductLotsBody,
} from '@/features/discharges/discharge-preparation-schema'
import { useDischargeMutations } from '@/features/discharges/mutations/use-discharge-mutations'
import { listRefusals } from '@/features/discharges/truck-pool-refusals'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { STARTED_REFUSAL_MESSAGE } from '@/features/discharges/ui/detail/edit-discharge-identity-sheet'
import { LOT_REMOVAL_REASONS } from '@/features/discharges/ui/detail/remove-product-lot-dialog'
import { useCustomerOptions } from '@/features/discharges/ui/preparation/preparation-options'
import { ProductLotGroupFields } from '@/features/discharges/ui/preparation/product-lot-group-fields'
import { WRITE_PENDING_LABELS } from '@/helpers/resource-copy'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

export const CUSTOMER_LOTS_CHANGED_MESSAGE = "This customer's product lots changed"

type ProductLot = DischargeDetailDto['productLots'][number]
type CustomerLotGroup = { customer: ProductLot['customer']; lots: ProductLot[] }

type CustomerProductLotsSheetProps = {
  discharge: DischargeDetailDto
  /** The customer whose lots are corrected; `null` while the sheet is closed. */
  customerId: string | null
  onOpenChange: (open: boolean) => void
}

/** One customer's product lots, corrected together and saved in one change. */
export function CustomerProductLotsSheet({
  discharge,
  customerId,
  onOpenChange,
}: CustomerProductLotsSheetProps) {
  // Read from the discharge on every render, so what the detail learns meanwhile reaches the sheet.
  const group = groupLotsByCustomer(discharge.productLots).find(
    (candidate) => candidate.customer.id === customerId,
  )

  return (
    <Sheet onOpenChange={onOpenChange} open={customerId !== null}>
      <SheetContent className="overflow-y-auto" size="lg">
        <SheetHeader>
          <SheetTitle>Edit product lots</SheetTitle>
          <SheetDescription>
            {group
              ? `Correct, add, or remove the product lots of ${group.customer.name} in one change.`
              : 'Correct, add, or remove the product lots of a customer in one change.'}
          </SheetDescription>
        </SheetHeader>
        {group && (
          <CustomerProductLotsForm
            discharge={discharge}
            group={group}
            key={group.customer.id}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

const plural = (count: number) => `${count} lot${count === 1 ? '' : 's'}`

/**
 * The removed lots a refusal keeps: those refused at their position, or every removed lot when a
 * door was assigned to one of them too late for the refusal to say which. `only` tells whether the
 * refusal says nothing else.
 */
function refusedRemovals(error: unknown, removedProductLotIds: readonly string[]) {
  const apiError = parseApiError(error)
  if (apiError.code === 'E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS') {
    return { ids: new Set(removedProductLotIds), only: true }
  }

  const ids = new Set(listRefusals(apiError, 'removedProductLotIds', removedProductLotIds).keys())
  const only = (apiError.details ?? []).every((detail) =>
    detail.field.startsWith('removedProductLotIds.'),
  )

  return { ids, only: ids.size > 0 && only }
}

/** What choosing another customer does to the lots: they join the lots it already has here. */
function joinDescription(
  discharge: DischargeDetailDto,
  group: CustomerLotGroup,
  customerId: string,
) {
  if (customerId === group.customer.id) {
    return undefined
  }

  const joined = discharge.productLots.filter((lot) => lot.customer.id === customerId)
  if (joined.length === 0) {
    return undefined
  }

  const count = joined.length

  return `Joins the ${count} product ${count === 1 ? 'lot' : 'lots'} of ${joined[0].customer.name}.`
}

function CustomerProductLotsForm({
  discharge,
  group,
  onDone,
}: {
  discharge: DischargeDetailDto
  group: CustomerLotGroup
  onDone: () => void
}) {
  const { correctCustomerLots } = useDischargeMutations()
  const customers = useCustomerOptions({ id: group.customer.id, name: group.customer.name })
  const groupLotIds = new Set(group.lots.map((lot) => lot.id))
  const otherLots = discharge.productLots
    .filter((lot) => !groupLotIds.has(lot.id))
    .map((lot) => ({ customerId: lot.customer.id, productName: lot.productName }))

  const form = useAppForm({
    defaultValues: customerProductLotsFormValues(group),
    // Two rows sharing a name both carry the error: judged on submit, then on every change, so
    // fixing one clears the other.
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: {
      onChange: customerProductLotsFieldsSchema,
      onDynamic: customerProductLotsCrossRulesSchema(otherLots),
    },
    onSubmit: async ({ formApi, value }) => {
      try {
        await correctCustomerLots.mutateAsync({
          params: { dischargeId: discharge.id, customerId: group.customer.id },
          body: toCustomerProductLotsBody(value),
        })
        toast.success('Product lots updated')
        onDone()
      } catch (error) {
        // A lot that cannot be removed any more comes back as it opened, so the rest of the change
        // can still be saved; the refreshed detail then says why its row cannot be removed.
        const refused = refusedRemovals(error, value.removedProductLotIds)
        if (refused.ids.size > 0) {
          for (const lot of group.lots.filter((candidate) => refused.ids.has(candidate.id))) {
            formApi.pushFieldValue('products', correctionLineOf(lot))
          }
          formApi.setFieldValue(
            'removedProductLotIds',
            value.removedProductLotIds.filter((id) => !refused.ids.has(id)),
          )
        }
        // With nothing left to fix, the reason is told once rather than held on the form, which
        // would refuse the next save until something else changed.
        if (refused.only) {
          toast.error(LOT_REMOVAL_REASONS.E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS)

          return
        }

        if (
          applyValidationError(
            formApi,
            error,
            customerProductLotsFieldNames(value),
            customerProductLotsFieldOf,
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
        if (apiError.code === 'E_DISCHARGE_LAST_PRODUCT_LOT') {
          formApi.setErrorMap({
            onSubmit: { form: LOT_REMOVAL_REASONS.E_DISCHARGE_LAST_PRODUCT_LOT, fields: {} },
          })

          return
        }
        if (apiError.code === 'E_PRODUCT_LOT_NOT_FOUND') {
          toast.error(CUSTOMER_LOTS_CHANGED_MESSAGE)
          onDone()

          return
        }

        toast.error('Unable to update the product lots', { description: apiError.message })
      }
    },
  })

  return (
    <div className="px-4 pb-4">
      <form.AppForm>
        <form.Form className="flex flex-col gap-6" noValidate={true}>
          <form.Subscribe selector={(state) => state.values.customerId}>
            {(chosenCustomerId) => (
              <ProductLotGroupFields
                blockLabel={group.customer.name}
                customerDescription={joinDescription(discharge, group, chosenCustomerId)}
                customers={customers}
                emptyNotice={
                  otherLots.length > 0
                    ? 'Saving removes every product lot of this customer.'
                    : undefined
                }
                fields={{ customerId: 'customerId', products: 'products' }}
                form={form}
                newProductLine={emptyCorrectionLine}
                onRowRemoved={(productIndex) => {
                  const { lotId } = form.getFieldValue(`products[${productIndex}]`)
                  if (lotId) {
                    form.pushFieldValue('removedProductLotIds', lotId)
                  }
                }}
                rowRemoval={(_, rowCount, row) => {
                  const { lotId } = row as CorrectionLineFormValues
                  const lot =
                    discharge.productLots.find((candidate) => candidate.id === lotId) ?? null
                  const block = correctionRowRemoval(lot, otherLots.length, rowCount)

                  return block
                    ? { canRemove: false, blockedReason: LOT_REMOVAL_REASONS[block] }
                    : { canRemove: true }
                }}
              />
            )}
          </form.Subscribe>
          <form.FormError />
          <SheetFooter className="flex-row flex-wrap items-center justify-end gap-2 p-0">
            <form.Subscribe
              selector={(state) => ({
                count: state.values.products.length,
                tonnage: sumTonnes(
                  state.values.products.map((product) => product.expectedQuantityTonnes),
                ),
              })}
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
            <form.SubmitButton pendingLabel={WRITE_PENDING_LABELS.update}>Save</form.SubmitButton>
          </SheetFooter>
        </form.Form>
      </form.AppForm>
    </div>
  )
}
