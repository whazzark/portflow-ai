import { PlusIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { formatTonnes, sumTonnes } from '@/features/discharges/discharge-detail-view'
import {
  emptyProductLine,
  type ProductLineFormValues,
} from '@/features/discharges/discharge-preparation-schema'
import type { PreparationOptions } from '@/features/discharges/ui/preparation/preparation-options'
import {
  ColumnHeaders,
  OnDemand,
  RemoveRowButton,
  RepeatedRow,
} from '@/features/discharges/ui/preparation/repeated-rows'
import { withFieldGroup } from '@/libraries/forms/form'

type CustomerOption = { id: string; name: string }

export type RowRemoval = { canRemove: boolean; blockedReason?: string }

/**
 * A product row's grid, shared with its column headers. Container queries rather than the viewport:
 * the block lays out the same in a page's column as in a narrow sheet.
 */
const PRODUCT_ROW_COLUMNS = '@lg:grid-cols-[minmax(0,1fr)_8rem_2.25rem]'

type ProductLotGroupFieldsProps = {
  blockLabel: string
  customers?: PreparationOptions<CustomerOption>
  /** `fixed` names the customer as text, for a block whose customer does not change here. */
  customerField?: 'editable' | 'fixed'
  customerName?: string
  customerDescription?: string
  /** Hides customers another block already lists. */
  customerOptionFilter?: (customerId: string) => boolean
  canAddProducts?: boolean
  newProductLine?: () => ProductLineFormValues
  /** Whether a row can be removed and why not; without it, rows have no remove button. */
  rowRemoval?: (productIndex: number, rowCount: number, row: ProductLineFormValues) => RowRemoval
  onRowRemoved?: (productIndex: number) => void
  /** Shown in place of the rows once every row is removed. */
  emptyNotice?: string
  /** An action on the whole block, placed beside its subtotal. */
  headerAction?: ReactNode
}

/**
 * One customer block: the customer, once, and the products the vessel carries for it. Creating a
 * discharge and adding lots list several blocks; correcting a customer's lots edits one.
 */
export const ProductLotGroupFields = withFieldGroup({
  defaultValues: { customerId: '', products: [emptyProductLine()] } as {
    customerId: string
    products: ProductLineFormValues[]
  },
  props: {} as ProductLotGroupFieldsProps,
  render: function ProductLotGroupFieldsRender({
    group,
    blockLabel,
    customers = { options: [], loading: false },
    customerField = 'editable',
    customerName,
    customerDescription,
    customerOptionFilter,
    canAddProducts = true,
    newProductLine = emptyProductLine,
    rowRemoval,
    onRowRemoved,
    emptyNotice,
    headerAction,
  }) {
    return (
      <fieldset className="@container flex flex-col gap-3 rounded-lg border p-4">
        <legend className="sr-only">{blockLabel}</legend>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {customerField === 'fixed' ? (
              <p className="flex h-8 items-center font-medium">{customerName}</p>
            ) : (
              <group.AppField name="customerId">
                {(field) => (
                  <field.ComboboxField
                    description={customerDescription}
                    emptyMessage="No customer matches"
                    label="Customer"
                    loading={customers.loading}
                    onRetry={customers.onRetry}
                    options={customers.options
                      .filter(
                        (option) =>
                          option.id === field.state.value ||
                          !customerOptionFilter ||
                          customerOptionFilter(option.id),
                      )
                      .map((option) => ({ label: option.name, value: option.id }))}
                    placeholder="Search a customer"
                    required={true}
                  />
                )}
              </group.AppField>
            )}
          </div>
          <group.Subscribe
            selector={(state) =>
              sumTonnes(
                (state.values.products ?? []).map((product) => product.expectedQuantityTonnes),
              )
            }
          >
            {(subtotal) => (
              <p
                className={`flex h-8 items-center text-muted-foreground text-sm tabular-nums ${customerField === 'fixed' ? '' : 'mt-6'}`}
              >
                <span className="sr-only">Subtotal&nbsp;</span>
                {subtotal === null ? '—' : formatTonnes(subtotal)}
              </p>
            )}
          </group.Subscribe>
          {headerAction && (
            <div className={customerField === 'fixed' ? '' : 'mt-6'}>{headerAction}</div>
          )}
        </div>

        <group.AppField mode="array" name="products">
          {(products) => (
            <>
              {products.state.value.length > 0 ? (
                <>
                  <ColumnHeaders
                    columns={`@lg:grid ${PRODUCT_ROW_COLUMNS}`}
                    titles={['Product', 'Quantity (t)']}
                  />
                  <div className="divide-y">
                    {products.state.value.map((_, productIndex) => {
                      const rowLabel = `Product ${productIndex + 1}`
                      const path = `products[${productIndex}]` as const
                      const removal = rowRemoval?.(
                        productIndex,
                        products.state.value.length,
                        products.state.value[productIndex],
                      )

                      return (
                        <RepeatedRow
                          className="@lg:first:pt-0"
                          // biome-ignore lint/suspicious/noArrayIndexKey: array fields are addressed by index
                          key={productIndex}
                          label={rowLabel}
                          stackedTitleClassName="@lg:hidden"
                        >
                          <div
                            className={`grid @lg:items-start gap-x-3 gap-y-3 ${PRODUCT_ROW_COLUMNS}`}
                          >
                            <group.AppField name={`${path}.productName`}>
                              {(field) => (
                                <field.TextField
                                  autoComplete="off"
                                  label="Product name"
                                  labelClassName="@lg:sr-only"
                                  required={true}
                                />
                              )}
                            </group.AppField>
                            <group.AppField name={`${path}.expectedQuantityTonnes`}>
                              {(field) => (
                                <field.TextField
                                  autoComplete="off"
                                  className="text-right tabular-nums"
                                  inputMode="decimal"
                                  label="Expected quantity (t)"
                                  labelClassName="@lg:sr-only"
                                  required={true}
                                />
                              )}
                            </group.AppField>
                            <div className="@max-lg:absolute @max-lg:top-1.5 @max-lg:right-0 flex justify-end">
                              {removal && (
                                <RemoveRowButton
                                  blockedReason={removal.blockedReason}
                                  canRemove={removal.canRemove}
                                  label={rowLabel}
                                  onRemove={() => {
                                    onRowRemoved?.(productIndex)
                                    products.removeValue(productIndex)
                                  }}
                                />
                              )}
                            </div>
                          </div>
                          <group.AppField name={`${path}.description`}>
                            {(field) => (
                              <OnDemand
                                hasContent={
                                  field.state.value !== '' || field.state.meta.errors.length > 0
                                }
                                label="Add description"
                              >
                                {(openedOnDemand) => (
                                  // Opened by the user's click, the field takes the focus the button it replaces had.
                                  <field.TextareaField
                                    autoFocus={openedOnDemand}
                                    label="Description"
                                    rows={2}
                                  />
                                )}
                              </OnDemand>
                            )}
                          </group.AppField>
                        </RepeatedRow>
                      )
                    })}
                  </div>
                </>
              ) : (
                emptyNotice && <p className="text-muted-foreground text-sm">{emptyNotice}</p>
              )}
              {canAddProducts && (
                <Button
                  className="self-start"
                  onClick={() => products.pushValue(newProductLine())}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <PlusIcon aria-hidden="true" />
                  Add product
                </Button>
              )}
            </>
          )}
        </group.AppField>
      </fieldset>
    )
  },
})
