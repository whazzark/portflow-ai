import type * as React from 'react'

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

import { useFieldContext, useFormContext } from '../contexts'
import {
  type FieldPresentationProps,
  FieldLabelContent,
  getFieldPresentation,
  normalizeFieldErrors,
} from './field-presentation'

export function TextField({
  description,
  id,
  label,
  required,
  ...props
}: FieldPresentationProps &
  Omit<React.ComponentProps<typeof Input>, 'id' | 'name' | 'onBlur' | 'onChange' | 'value'> & {
    id?: string
  }) {
  const field = useFieldContext<string>()
  const form = useFormContext()
  const inputId = id ?? field.name
  const { errorId, errors, isInvalid } = getFieldPresentation(inputId, field, form)

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={inputId}>
        <FieldLabelContent label={label} required={required} />
      </FieldLabel>
      {description && <FieldDescription>{description}</FieldDescription>}
      <Input
        {...props}
        id={inputId}
        name={field.name}
        value={field.state.value ?? ''}
        aria-describedby={isInvalid ? errorId : undefined}
        aria-invalid={isInvalid}
        aria-required={required}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
      {isInvalid && <FieldError id={errorId} errors={normalizeFieldErrors(errors)} />}
    </Field>
  )
}
