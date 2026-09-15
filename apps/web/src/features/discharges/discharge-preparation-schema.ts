import { z } from 'zod'

import type { DischargeDetailDto } from '@/features/discharges/types'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/helpers/dates'
import { toFormFieldName } from '@/libraries/forms/api-error'

type DetailLot = DischargeDetailDto['productLots'][number]

/**
 * The same rules the API applies. They only spare the user a round trip: the API decides, and its
 * refusals are mapped back onto these fields.
 */
const TONNAGE_PATTERN = /^\d{1,9}(\.\d{1,3})?$/
const IMO_PATTERN = /^\d{7}$/

const requiredText = (message: string) => z.string().refine((value) => value.trim() !== '', message)

const localDateTime = (requiredMessage: string) =>
  z.string().superRefine((value, context) => {
    if (value === '') {
      context.addIssue({ code: 'custom', message: requiredMessage })
    } else if (fromDateTimeLocalValue(value) === null) {
      context.addIssue({ code: 'custom', message: 'Enter a valid date and time.' })
    }
  })

export const dischargeIdentitySchema = z.object({
  vesselName: requiredText('Vessel name is required.').refine(
    (value) => value.trim().length <= 255,
    'Vessel name must be 255 characters or fewer.',
  ),
  vesselImo: z
    .string()
    .refine(
      (value) => value.trim() === '' || IMO_PATTERN.test(value.trim()),
      'Enter the 7-digit IMO number',
    ),
  vesselComment: z.string().max(2000, 'Vessel comment must be 2000 characters or fewer.'),
  dockId: requiredText('Dock is required.'),
  expectedStartAt: localDateTime('Expected start is required.'),
})

export const productLotSchema = z.object({
  customerId: requiredText('Customer is required.'),
  productName: requiredText('Product name is required.').refine(
    (value) => value.trim().length <= 255,
    'Product name must be 255 characters or fewer.',
  ),
  expectedQuantityTonnes: z.string().superRefine((value, context) => {
    const quantity = value.trim()

    if (quantity === '') {
      context.addIssue({ code: 'custom', message: 'Expected quantity is required.' })
    } else if (!TONNAGE_PATTERN.test(quantity) || /^[0.]+$/.test(quantity)) {
      context.addIssue({
        code: 'custom',
        message: 'Enter a quantity above 0 with at most 3 decimals',
      })
    }
  }),
  description: z.string().max(2000, 'Description must be 2000 characters or fewer.'),
})

/** One product of a customer block: the lot's values but its customer, which the block holds. */
export const productLineSchema = productLotSchema.omit({ customerId: true })

/** A customer and the products the vessel carries for it, entered once for all of them. */
export const productLotGroupSchema = z.object({
  customerId: requiredText('Customer is required.'),
  products: z.array(productLineSchema).min(1, 'Add at least one product.'),
})

export const productLotGroupsSchema = z
  .array(productLotGroupSchema)
  .min(1, 'Add at least one customer.')

export const plannedShiftSchema = z.object({
  plannedStartAt: localDateTime('Planned start is required.'),
  plannedEndAt: localDateTime('Planned end is required.'),
  responsibleUserId: requiredText('Responsible is required.'),
})

/** Each value on its own, as the form checks it on blur. */
export const createDischargeFieldsSchema = dischargeIdentitySchema.extend({
  lotGroups: productLotGroupsSchema,
  shifts: z.array(plannedShiftSchema).min(1, 'Add at least one shift.'),
})

/** Each value of the lots added at once to a discharge, on its own. */
export const addProductLotsFieldsSchema = z.object({ lotGroups: productLotGroupsSchema })

const lotIdentityKey = (lot: { customerId: string; productName: string }) =>
  JSON.stringify([lot.customerId, lot.productName.trim().toLowerCase()])

type LotIdentity = { customerId: string; productName: string }

/**
 * The rules across the lots of customer blocks, with each error where the form shows it: a customer
 * listed in a second block, a product repeated for one customer, and a product that customer
 * already has on the discharge (`existingLots`, for lots added to an existing discharge).
 */
function checkLotGroupRules(
  groups: Array<{ customerId: string; products: Array<{ productName: string }> }>,
  context: z.RefinementCtx,
  existingLots: LotIdentity[] = [],
) {
  const seenCustomers = new Set<string>()
  groups.forEach((group, index) => {
    if (!group.customerId) {
      return
    }
    if (seenCustomers.has(group.customerId)) {
      context.addIssue({
        code: 'custom',
        message: 'This customer is already listed above',
        path: ['lotGroups', index, 'customerId'],
      })
    }
    seenCustomers.add(group.customerId)
  })

  const lots = flattenLotGroups(groups).filter((lot) => lot.customerId && lot.productName.trim())
  const existingKeys = new Set(existingLots.map(lotIdentityKey))
  const lotCounts = new Map<string, number>()
  for (const lot of lots) {
    lotCounts.set(lotIdentityKey(lot), (lotCounts.get(lotIdentityKey(lot)) ?? 0) + 1)
  }
  for (const lot of lots) {
    const key = lotIdentityKey(lot)
    if ((lotCounts.get(key) ?? 0) > 1 || existingKeys.has(key)) {
      context.addIssue({
        code: 'custom',
        message: 'This customer already has a lot with this product name',
        path: ['lotGroups', lot.groupIndex, 'products', lot.productIndex, 'productName'],
      })
    }
  }
}

/**
 * The rules across lots and shifts. Raised on blur, an error on one lot because of another would
 * block a first submission the user has not finished composing.
 */
type CrossRuleValues = {
  lotGroups: Array<{ customerId: string; products: Array<{ productName: string }> }>
  shifts: Array<{ plannedStartAt: string; plannedEndAt: string }>
}

function checkCrossRules(values: CrossRuleValues, context: z.RefinementCtx) {
  checkLotGroupRules(values.lotGroups, context)

  const periods = values.shifts.map((shift) => ({
    start: Date.parse(fromDateTimeLocalValue(shift.plannedStartAt) ?? ''),
    end: Date.parse(fromDateTimeLocalValue(shift.plannedEndAt) ?? ''),
  }))
  periods.forEach((period, index) => {
    if (!Number.isNaN(period.start) && !Number.isNaN(period.end) && period.end <= period.start) {
      context.addIssue({
        code: 'custom',
        message: 'The planned end must be after the planned start',
        path: ['shifts', index, 'plannedEndAt'],
      })
    }
  })
  periods.forEach((period, index) => {
    const overlaps = periods.some(
      (other, otherIndex) =>
        otherIndex !== index &&
        period.start < period.end &&
        other.start < other.end &&
        period.start < other.end &&
        other.start < period.end,
    )
    if (overlaps) {
      context.addIssue({
        code: 'custom',
        message: 'This shift overlaps another shift',
        path: ['shifts', index, 'plannedStartAt'],
      })
    }
  })
}

/** Each value on its own and the rules across lots and shifts together, as a submission is judged. */
export const createDischargeSchema = createDischargeFieldsSchema.superRefine(checkCrossRules)

/**
 * The rules across lots and shifts alone. The form runs them on submit, then again on every change
 * once a submission has been attempted, so fixing one shift clears the error it caused on another.
 */
export const creationCrossRulesSchema = z
  .custom<CreateDischargeFormValues>()
  .superRefine(checkCrossRules)

/** The rules across the lots added at once, the discharge's existing lots included. */
export function addProductLotsCrossRulesSchema(existingLots: LotIdentity[]) {
  return z
    .custom<AddProductLotsFormValues>()
    .superRefine((values, context) => checkLotGroupRules(values.lotGroups, context, existingLots))
}

/** The steps a creation walks through, in order; each shows one section of the form. */
export const CREATION_STEPS = [
  { id: 'vessel', label: 'Vessel and dock' },
  { id: 'lots', label: 'Product lots' },
  { id: 'shifts', label: 'Planned shifts' },
] as const

export type CreationStep = (typeof CREATION_STEPS)[number]['id']

/** The step whose section holds a field, whether the path uses brackets or the API's dots. */
export function creationStepOf(fieldPath: string): CreationStep {
  if (fieldPath.startsWith('lotGroups') || fieldPath.startsWith('productLots')) {
    return 'lots'
  }

  return fieldPath.startsWith('shifts') ? 'shifts' : 'vessel'
}

/** Whether any field of a step currently carries an error, read from the form's field meta. */
export function stepHasErrors(
  step: CreationStep,
  fieldMeta: Record<string, { errors?: unknown[] } | undefined>,
) {
  return Object.entries(fieldMeta).some(
    ([path, meta]) =>
      creationStepOf(path) === step && (meta?.errors ?? []).some((error) => Boolean(error)),
  )
}

/**
 * Whether a step's own values are valid, the rules across its lots or shifts included, so the
 * creation can move past it. Later steps are not considered.
 */
export function isStepComplete(step: CreationStep, values: CreateDischargeFormValues) {
  const crossIssues = () => {
    const issues: string[] = []
    checkCrossRules(values, {
      addIssue: (issue: { path?: PropertyKey[] }) => issues.push(String(issue.path?.[0] ?? '')),
    } as unknown as z.RefinementCtx)

    return issues
  }

  switch (step) {
    case 'vessel':
      return dischargeIdentitySchema.safeParse(values).success
    case 'lots':
      return (
        productLotGroupsSchema.safeParse(values.lotGroups).success &&
        !crossIssues().includes('lotGroups')
      )
    case 'shifts':
      return (
        z.array(plannedShiftSchema).min(1).safeParse(values.shifts).success &&
        !crossIssues().includes('shifts')
      )
  }
}

/**
 * Every field path the creation form renders for these values, so an API refusal naming no field
 * of the form is announced at form level rather than lost.
 */
export function creationFieldNames(values: CreateDischargeFormValues) {
  return [
    'vesselName',
    'vesselImo',
    'vesselComment',
    'dockId',
    'expectedStartAt',
    ...lotGroupFieldNames(values.lotGroups),
    ...values.shifts.flatMap((_, index) =>
      ['plannedStartAt', 'plannedEndAt', 'responsibleUserId'].map(
        (key) => `shifts[${index}].${key}`,
      ),
    ),
  ]
}

export type DischargeIdentityFormValues = z.input<typeof dischargeIdentitySchema>
export type ProductLotFormValues = z.input<typeof productLotSchema>
export type ProductLineFormValues = z.input<typeof productLineSchema>
export type ProductLotGroupFormValues = z.input<typeof productLotGroupSchema>
export type AddProductLotsFormValues = z.input<typeof addProductLotsFieldsSchema>
export type PlannedShiftFormValues = z.input<typeof plannedShiftSchema>
export type CreateDischargeFormValues = z.input<typeof createDischargeSchema>

export function emptyProductLot(): ProductLotFormValues {
  return { customerId: '', productName: '', expectedQuantityTonnes: '', description: '' }
}

export function emptyProductLine(): ProductLineFormValues {
  return { productName: '', expectedQuantityTonnes: '', description: '' }
}

export function emptyLotGroup(): ProductLotGroupFormValues {
  return { customerId: '', products: [emptyProductLine()] }
}

export function addProductLotsFormDefaults(): AddProductLotsFormValues {
  return { lotGroups: [emptyLotGroup()] }
}

/**
 * The lots of customer blocks as the API lists them: block by block, product by product, each with
 * where it was entered. This order is what `productLots.N` means in both a body and a refusal.
 */
export function flattenLotGroups<Product extends { productName: string }>(
  groups: Array<{ customerId: string; products: Product[] }>,
) {
  return groups.flatMap((group, groupIndex) =>
    group.products.map((product, productIndex) => ({
      ...product,
      customerId: group.customerId,
      groupIndex,
      productIndex,
    })),
  )
}

const LOT_API_FIELD =
  /^productLots\.(\d+)\.(customerId|productName|expectedQuantityTonnes|description)$/

/**
 * The customer block field an API refusal of `productLots.N.<field>` points at, or `null` when it
 * names no field of these blocks, so it is announced at form level rather than lost.
 */
export function lotGroupFieldOf(apiField: string, groups: ProductLotGroupFormValues[]) {
  const match = LOT_API_FIELD.exec(apiField)
  const lot = match ? flattenLotGroups(groups)[Number(match[1])] : undefined
  if (!match || !lot) {
    return null
  }

  return match[2] === 'customerId'
    ? `lotGroups[${lot.groupIndex}].customerId`
    : `lotGroups[${lot.groupIndex}].products[${lot.productIndex}].${match[2]}`
}

/** Every field path customer blocks render for these values. */
export function lotGroupFieldNames(groups: ProductLotGroupFormValues[]) {
  return groups.flatMap((group, groupIndex) => [
    `lotGroups[${groupIndex}].customerId`,
    ...group.products.flatMap((_, productIndex) =>
      ['productName', 'expectedQuantityTonnes', 'description'].map(
        (key) => `lotGroups[${groupIndex}].products[${productIndex}].${key}`,
      ),
    ),
  ])
}

/** The creation form field an API refusal points at, lots being entered in customer blocks. */
export function creationFieldOf(apiField: string, values: CreateDischargeFormValues) {
  return apiField.startsWith('productLots')
    ? lotGroupFieldOf(apiField, values.lotGroups)
    : toFormFieldName(apiField)
}

export function emptyPlannedShift(): PlannedShiftFormValues {
  return { plannedStartAt: '', plannedEndAt: '', responsibleUserId: '' }
}

const MINUTE = 60_000

function localPeriodMillis(startLocal: string, endLocal: string) {
  const start = Date.parse(fromDateTimeLocalValue(startLocal) ?? '')
  const end = Date.parse(fromDateTimeLocalValue(endLocal) ?? '')

  return Number.isNaN(start) || Number.isNaN(end) || end <= start ? null : { start, end }
}

/** How long a planned shift lasts, as `8 h`, `7 h 30`, or `45 min`; `—` until its period is valid. */
export function formatShiftDuration(startLocal: string, endLocal: string) {
  const period = localPeriodMillis(startLocal, endLocal)
  if (!period) {
    return '—'
  }

  const minutes = Math.round((period.end - period.start) / MINUTE)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (hours === 0) {
    return `${rest} min`
  }

  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`
}

/**
 * The shift a preparation most likely needs next: starting when the last one ends and lasting as
 * long, so consecutive shifts only need their responsible. An incomplete last shift gives an empty
 * one, as there is nothing reliable to follow.
 */
export function nextPlannedShift(
  previous: PlannedShiftFormValues | undefined,
): PlannedShiftFormValues {
  const period = previous && localPeriodMillis(previous.plannedStartAt, previous.plannedEndAt)
  if (!period || !previous) {
    return emptyPlannedShift()
  }

  const nextEnd = new Date(period.end + (period.end - period.start)).toISOString()

  return {
    plannedStartAt: previous.plannedEndAt,
    plannedEndAt: toDateTimeLocalValue(nextEnd),
    responsibleUserId: '',
  }
}

export function createDischargeFormDefaults(): CreateDischargeFormValues {
  return {
    vesselName: '',
    vesselImo: '',
    vesselComment: '',
    dockId: '',
    expectedStartAt: '',
    lotGroups: [emptyLotGroup()],
    shifts: [emptyPlannedShift()],
  }
}

const optionalText = (value: string) => value.trim() || null

export function toIdentityBody(values: DischargeIdentityFormValues) {
  return {
    vesselName: values.vesselName.trim(),
    vesselImo: optionalText(values.vesselImo),
    vesselComment: optionalText(values.vesselComment),
    dockId: values.dockId,
    expectedStartAt: fromDateTimeLocalValue(values.expectedStartAt) as string,
  }
}

export function toProductLotBody(values: ProductLotFormValues) {
  return {
    customerId: values.customerId,
    productName: values.productName.trim(),
    expectedQuantityTonnes: values.expectedQuantityTonnes.trim(),
    description: optionalText(values.description),
  }
}

export function toProductLotsBody(groups: ProductLotGroupFormValues[]) {
  return flattenLotGroups(groups).map(toProductLotBody)
}

/** `id` is the creation's identity, generated once per creation page so a retry is recognized. */
export function toCreateDischargeBody(values: CreateDischargeFormValues, id: string) {
  return {
    id,
    ...toIdentityBody(values),
    productLots: toProductLotsBody(values.lotGroups),
    shifts: values.shifts.map((shift) => ({
      plannedStartAt: fromDateTimeLocalValue(shift.plannedStartAt) as string,
      plannedEndAt: fromDateTimeLocalValue(shift.plannedEndAt) as string,
      responsibleUserId: shift.responsibleUserId,
    })),
  }
}

export function identityFormValues(detail: DischargeDetailDto): DischargeIdentityFormValues {
  return {
    vesselName: detail.vesselName,
    vesselImo: detail.vesselImo ?? '',
    vesselComment: detail.vesselComment ?? '',
    dockId: detail.dock.id,
    expectedStartAt: toDateTimeLocalValue(detail.expectedStartAt),
  }
}

export function productLotFormValues(lot: DetailLot): ProductLotFormValues {
  return {
    customerId: lot.customer.id,
    productName: lot.productName,
    expectedQuantityTonnes: lot.expectedQuantityTonnes,
    description: lot.description ?? '',
  }
}
