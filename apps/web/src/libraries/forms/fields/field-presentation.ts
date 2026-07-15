import type * as React from 'react'

export type FieldPresentationProps = {
  description?: React.ReactNode
  label: React.ReactNode
}

export function getFieldPresentation<
  TField extends {
    state: {
      meta: { errors: Array<unknown>; isTouched: boolean }
    }
  },
>(fieldName: string, field: TField, form: { state: { isSubmitted: boolean } }) {
  const errors = field.state.meta.errors
  const isInvalid = errors.length > 0 && (field.state.meta.isTouched || form.state.isSubmitted)
  const errorId = `${fieldName}-error`

  return { errorId, errors, isInvalid }
}

export function normalizeFieldErrors(errors: Array<unknown>) {
  return errors.map((error) =>
    typeof error === 'string' ? { message: error } : (error as { message?: string } | undefined),
  )
}
