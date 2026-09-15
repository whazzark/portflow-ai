import { PlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatTonnes, sumTonnes } from '@/features/discharges/discharge-detail-view'
import {
  addProductLotsFormDefaults,
  emptyLotGroup,
  emptyProductLine,
  type ProductLotGroupFormValues,
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

/**
 * A product row's grid, shared with its column headers. Container queries rather than the viewport:
 * the editor lays out the same in a page's column as in a narrow sheet.
 */
const PRODUCT_ROW_COLUMNS = '@lg:grid-cols-[minmax(0,1fr)_8rem_2.25rem]'

/**
 * The lots a preparation enters, customer by customer: each block picks its customer once and lists
 * the products the vessel carries for it. A customer chosen in one block is not offered in another,
 * so a customer's lots always stay together.
 */
export const ProductLotGroupsEditor = withFieldGroup({
  defaultValues: addProductLotsFormDefaults() as { lotGroups: ProductLotGroupFormValues[] },
  props: {
    customers: { options: [], loading: false } as PreparationOptions<CustomerOption>,
  },
  render: function ProductLotGroupsEditorRender({ group, customers }) {
    return (
      <group.AppField mode="array" name="lotGroups">
        {(lotGroups) => (
          <div className="flex flex-col gap-4">
            {lotGroups.state.value.map((_, groupIndex) => {
              const blockLabel = `Customer ${groupIndex + 1}`

              return (
                <fieldset
                  className="@container flex flex-col gap-3 rounded-lg border p-4"
                  // biome-ignore lint/suspicious/noArrayIndexKey: array fields are addressed by index
                  key={groupIndex}
                >
                  <legend className="sr-only">{blockLabel}</legend>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <group.Subscribe
                        selector={(state) =>
                          state.values.lotGroups
                            .filter((_, index) => index !== groupIndex)
                            .map((other) => other.customerId)
                            .join(',')
                        }
                      >
                        {(takenKey) => (
                          <group.AppField name={`lotGroups[${groupIndex}].customerId`}>
                            {(field) => (
                              <field.ComboboxField
                                emptyMessage="No customer matches"
                                label="Customer"
                                loading={customers.loading}
                                onRetry={customers.onRetry}
                                options={customers.options
                                  .filter(
                                    (option) =>
                                      option.id === field.state.value ||
                                      !takenKey.split(',').includes(option.id),
                                  )
                                  .map((option) => ({ label: option.name, value: option.id }))}
                                placeholder="Search a customer"
                                required={true}
                              />
                            )}
                          </group.AppField>
                        )}
                      </group.Subscribe>
                    </div>
                    <group.Subscribe
                      selector={(state) =>
                        sumTonnes(
                          (state.values.lotGroups[groupIndex]?.products ?? []).map(
                            (product) => product.expectedQuantityTonnes,
                          ),
                        )
                      }
                    >
                      {(subtotal) => (
                        <p className="mt-6 flex h-8 items-center text-muted-foreground text-sm tabular-nums">
                          <span className="sr-only">Subtotal&nbsp;</span>
                          {subtotal === null ? '—' : formatTonnes(subtotal)}
                        </p>
                      )}
                    </group.Subscribe>
                    <div className="mt-6">
                      <RemoveRowButton
                        canRemove={lotGroups.state.value.length > 1}
                        label={blockLabel}
                        onRemove={() => lotGroups.removeValue(groupIndex)}
                      />
                    </div>
                  </div>

                  <group.AppField mode="array" name={`lotGroups[${groupIndex}].products`}>
                    {(products) => (
                      <>
                        <ColumnHeaders
                          columns={`@lg:grid ${PRODUCT_ROW_COLUMNS}`}
                          titles={['Product', 'Quantity (t)']}
                        />
                        <div className="divide-y">
                          {products.state.value.map((_, productIndex) => {
                            const rowLabel = `Product ${productIndex + 1}`
                            const path =
                              `lotGroups[${groupIndex}].products[${productIndex}]` as const

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
                                    <RemoveRowButton
                                      canRemove={products.state.value.length > 1}
                                      label={rowLabel}
                                      onRemove={() => products.removeValue(productIndex)}
                                    />
                                  </div>
                                </div>
                                <group.AppField name={`${path}.description`}>
                                  {(field) => (
                                    <OnDemand
                                      hasContent={
                                        field.state.value !== '' ||
                                        field.state.meta.errors.length > 0
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
                        <Button
                          className="self-start"
                          onClick={() => products.pushValue(emptyProductLine())}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          <PlusIcon aria-hidden="true" />
                          Add product
                        </Button>
                      </>
                    )}
                  </group.AppField>
                </fieldset>
              )
            })}
            <Button
              className="self-start"
              onClick={() => lotGroups.pushValue(emptyLotGroup())}
              type="button"
              variant="outline"
            >
              <PlusIcon aria-hidden="true" />
              Add customer
            </Button>
          </div>
        )}
      </group.AppField>
    )
  },
})
