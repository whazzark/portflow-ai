import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useFieldContext, useFormContext } from '../contexts'
import {
  type FieldPresentationProps,
  getFieldPresentation,
  normalizeFieldErrors,
} from './field-presentation'

type SelectOption = { label: string; value: string }

export function SelectField({
  description,
  id,
  label,
  options,
  placeholder,
}: FieldPresentationProps & { id?: string; options: Array<SelectOption>; placeholder?: string }) {
  const field = useFieldContext<string>()
  const form = useFormContext()
  const selectId = id ?? field.name
  const { errorId, errors, isInvalid } = getFieldPresentation(selectId, field, form)

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={selectId}>{label}</FieldLabel>
      {description && <FieldDescription>{description}</FieldDescription>}
      <Select
        value={field.state.value}
        onValueChange={(value) => {
          if (value !== null) {
            field.handleChange(value)
          }
        }}
      >
        <SelectTrigger
          id={selectId}
          aria-describedby={isInvalid ? errorId : undefined}
          aria-invalid={isInvalid}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {isInvalid && <FieldError id={errorId} errors={normalizeFieldErrors(errors)} />}
    </Field>
  )
}
