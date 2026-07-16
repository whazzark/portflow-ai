import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'

import { useFieldContext, useFormContext } from '../contexts'
import {
  FieldLabelContent,
  type FieldPresentationProps,
  getFieldPresentation,
  normalizeFieldErrors,
} from './field-presentation'

export function CheckboxField({
  description,
  id,
  label,
  required,
}: FieldPresentationProps & { id?: string }) {
  const field = useFieldContext<boolean>()
  const form = useFormContext()
  const checkboxId = id ?? field.name
  const { errorId, errors, isInvalid } = getFieldPresentation(checkboxId, field, form)

  return (
    <Field data-invalid={isInvalid} orientation="horizontal">
      <Checkbox
        id={checkboxId}
        name={field.name}
        checked={field.state.value ?? false}
        aria-describedby={isInvalid ? errorId : undefined}
        aria-invalid={isInvalid}
        aria-required={required}
        onCheckedChange={field.handleChange}
      />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={checkboxId}>
          <FieldLabelContent label={label} required={required} />
        </FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
        {isInvalid && <FieldError id={errorId} errors={normalizeFieldErrors(errors)} />}
      </div>
    </Field>
  )
}
