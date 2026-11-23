import { TuyauHTTPError } from '@tuyau/core/client'
import { expect, test, vi } from 'vitest'

import { applyRefusal, applyValidationError } from '@/libraries/forms/api-error'

test('maps a validation error to a form error and matching field errors', () => {
  const setErrorMap = vi.fn()
  const error = new TuyauHTTPError(
    // biome-ignore lint/suspicious/noExplicitAny: constructing a minimal fake ky HTTPError for the test
    {} as any,
    {
      error: {
        code: 'E_VALIDATION_ERROR',
        details: [{ field: 'email', message: 'Email is already in use.' }],
        message: 'Validation failure',
      },
    },
  )

  expect(applyValidationError({ setErrorMap }, error)).toBe(true)

  expect(setErrorMap).toHaveBeenCalledWith({
    onSubmit: {
      fields: { email: 'Email is already in use.' },
      form: 'Validation failure',
    },
  })
})

test('does not apply a non-validation error to the form', () => {
  const setErrorMap = vi.fn()

  const error = new TuyauHTTPError(
    // biome-ignore lint/suspicious/noExplicitAny: constructing a minimal fake ky HTTPError for the test
    {} as any,
    { error: { code: 'E_LOGIN_INVALID_CREDENTIALS', message: 'Invalid credentials' } },
  )

  expect(applyValidationError({ setErrorMap }, error)).toBe(false)
  expect(setErrorMap).not.toHaveBeenCalled()
})

function validationError(details: { field: string; message: string }[]) {
  return new TuyauHTTPError(
    // biome-ignore lint/suspicious/noExplicitAny: constructing a minimal fake ky HTTPError for the test
    {} as any,
    { error: { code: 'E_VALIDATION_ERROR', details, message: 'Validation failure' } },
  )
}

test('maps indexed API paths onto array field names', () => {
  const setErrorMap = vi.fn()
  const error = validationError([
    { field: 'productLots.1.productName', message: 'Duplicate lot.' },
    { field: 'shifts.0.responsibleUserId', message: 'Not eligible.' },
    { field: 'vesselName', message: 'Required.' },
  ])

  applyValidationError({ setErrorMap }, error)

  expect(setErrorMap).toHaveBeenCalledWith({
    onSubmit: {
      fields: {
        'productLots[1].productName': 'Duplicate lot.',
        'shifts[0].responsibleUserId': 'Not eligible.',
        vesselName: 'Required.',
      },
      form: 'Validation failure',
    },
  })
})

test('announces a detail on no known field in the form-level error', () => {
  const setErrorMap = vi.fn()
  const error = validationError([
    { field: 'productLots.0.productName', message: 'Duplicate lot.' },
    { field: 'productLots', message: 'At least one lot is required.' },
  ])

  applyValidationError({ setErrorMap }, error, ['productLots[0].productName', 'vesselName'])

  expect(setErrorMap).toHaveBeenCalledWith({
    onSubmit: {
      fields: { 'productLots[0].productName': 'Duplicate lot.' },
      form: 'Validation failure At least one lot is required.',
    },
  })
})

test('names fields through a form-specific mapping, announcing unmapped details at form level', () => {
  const setErrorMap = vi.fn()
  const error = validationError([
    { field: 'productLots.0.productName', message: 'Duplicate lot.' },
    { field: 'productLots.9.customerId', message: 'Customer archived.' },
  ])

  applyValidationError({ setErrorMap }, error, undefined, (field) =>
    field === 'productLots.0.productName' ? 'lotGroups[0].products[0].productName' : null,
  )

  expect(setErrorMap).toHaveBeenCalledWith({
    onSubmit: {
      fields: { 'lotGroups[0].products[0].productName': 'Duplicate lot.' },
      form: 'Validation failure Customer archived.',
    },
  })
})

function refusal(code: string, message: string) {
  // biome-ignore lint/suspicious/noExplicitAny: constructing a minimal fake ky HTTPError for the test
  return new TuyauHTTPError({} as any, { error: { code, message } })
}

const TRUCK_REFUSALS = {
  E_TRUCK_REGISTRATION_CONFLICT: { field: 'registration' },
  E_TRUCK_TRANSPORT_COMPANY_LOCKED: {
    field: 'transportCompanyId',
    message: 'The company cannot change while this truck is used by a discharge.',
  },
}

test('puts a known refusal on its field, in the API wording or the form own', () => {
  const setErrorMap = vi.fn()

  applyRefusal(
    { setErrorMap },
    refusal('E_TRUCK_REGISTRATION_CONFLICT', 'Registration already exists'),
    TRUCK_REFUSALS,
  )
  expect(setErrorMap).toHaveBeenLastCalledWith({
    onSubmit: { fields: { registration: 'Registration already exists' }, form: '' },
  })

  applyRefusal(
    { setErrorMap },
    refusal('E_TRUCK_TRANSPORT_COMPANY_LOCKED', 'Locked'),
    TRUCK_REFUSALS,
  )
  expect(setErrorMap).toHaveBeenLastCalledWith({
    onSubmit: {
      fields: {
        transportCompanyId: 'The company cannot change while this truck is used by a discharge.',
      },
      form: '',
    },
  })
})

test('puts any other refusal on the form itself', () => {
  const setErrorMap = vi.fn()

  applyRefusal({ setErrorMap }, refusal('E_TRUCK_ARCHIVED', 'Truck is archived'), TRUCK_REFUSALS)

  expect(setErrorMap).toHaveBeenCalledWith({
    onSubmit: { fields: {}, form: 'Truck is archived' },
  })
})

test('still maps validation details onto their fields', () => {
  const setErrorMap = vi.fn()
  const error = new TuyauHTTPError(
    // biome-ignore lint/suspicious/noExplicitAny: constructing a minimal fake ky HTTPError for the test
    {} as any,
    {
      error: {
        code: 'E_VALIDATION_ERROR',
        details: [{ field: 'registration', message: 'Too long.' }],
        message: 'Validation failure',
      },
    },
  )

  applyRefusal({ setErrorMap }, error, TRUCK_REFUSALS)

  expect(setErrorMap).toHaveBeenCalledWith({
    onSubmit: { fields: { registration: 'Too long.' }, form: 'Validation failure' },
  })
})
