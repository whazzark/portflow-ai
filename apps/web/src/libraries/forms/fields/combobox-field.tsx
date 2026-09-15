import { Loader2Icon, RotateCwIcon } from 'lucide-react'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'

import { useFieldContext, useFormContext } from '../contexts'
import {
  FieldLabelContent,
  type FieldPresentationProps,
  getFieldPresentation,
  normalizeFieldErrors,
} from './field-presentation'

type ComboboxOption = { label: string; value: string }

/**
 * A select for long lists, searched by typing: the field holds the chosen option's value, as
 * `SelectField` does, so a form can swap one for the other without changing its values.
 *
 * Options fetched separately report their state here rather than holding the whole form back:
 * while they load the input spins and cannot be opened, and when they fail it offers a retry in
 * place. The field keeps its value throughout, and shows its label as soon as the option arrives.
 */
export function ComboboxField({
  description,
  emptyMessage = 'No match',
  id,
  label,
  labelClassName,
  loading = false,
  onRetry,
  options,
  placeholder,
  required,
}: FieldPresentationProps & {
  /** Hides the label visually where a column header names the field, as in a row of fields. */
  labelClassName?: string
} & {
  emptyMessage?: string
  id?: string
  /** Whether the options are still being fetched. */
  loading?: boolean
  /** Given when the options failed to load: retries fetching them. */
  onRetry?: () => void
  options: Array<ComboboxOption>
  placeholder?: string
}) {
  const field = useFieldContext<string>()
  const form = useFormContext()
  const inputId = id ?? field.name
  const { errorId, errors, isInvalid } = getFieldPresentation(inputId, field, form)
  const selected = options.find((option) => option.value === field.state.value) ?? null
  const fieldName = typeof label === 'string' ? label.toLowerCase() : 'options'
  const unavailable = loading || Boolean(onRetry)
  const adornment = loading ? (
    <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
  ) : onRetry ? (
    <button
      aria-label={`Retry loading ${fieldName}`}
      className="flex size-6 items-center justify-center rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={onRetry}
      type="button"
    >
      <RotateCwIcon aria-hidden="true" className="size-4" />
    </button>
  ) : undefined

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel className={labelClassName} htmlFor={inputId}>
        <FieldLabelContent label={label} required={required} />
      </FieldLabel>
      {description && <FieldDescription>{description}</FieldDescription>}
      <Combobox
        isItemEqualToValue={(item: ComboboxOption, value: ComboboxOption) =>
          item.value === value.value
        }
        itemToStringLabel={(item: ComboboxOption) => item.label}
        items={options}
        onOpenChange={(open) => {
          if (!open) {
            field.handleBlur()
          }
        }}
        onValueChange={(option: ComboboxOption | null) => field.handleChange(option?.value ?? '')}
        readOnly={unavailable}
        value={selected}
      >
        <ComboboxInput
          adornment={adornment}
          aria-busy={loading || undefined}
          aria-describedby={isInvalid ? errorId : undefined}
          aria-invalid={isInvalid}
          aria-required={required}
          id={inputId}
          name={field.name}
          placeholder={loading ? 'Loading…' : onRetry ? 'Unable to load' : placeholder}
          triggerLabel={`Show ${fieldName} options`}
        />
        <ComboboxContent>
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            {(option: ComboboxOption) => (
              <ComboboxItem key={option.value} value={option}>
                {option.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {isInvalid && <FieldError id={errorId} errors={normalizeFieldErrors(errors)} />}
    </Field>
  )
}
