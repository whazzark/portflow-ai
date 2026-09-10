import { createFormHook } from '@tanstack/react-form'
import type * as React from 'react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'

import { fieldContext, formContext, useFormContext } from './contexts'
import { CheckboxField } from './fields/checkbox-field'
import { SelectField } from './fields/select-field'
import { TextField } from './fields/text-field'
import { TextareaField } from './fields/textarea-field'

function Form({ onSubmit, ...props }: React.ComponentProps<'form'>) {
  const form = useFormContext()

  return (
    <form
      {...props}
      onSubmit={(event) => {
        onSubmit?.(event)
        if (!event.defaultPrevented) {
          event.preventDefault()
          void form.handleSubmit()
        }
      }}
    />
  )
}

function FormError({ className }: { className?: string }) {
  const form = useFormContext()

  return (
    <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
      {(error) =>
        typeof error === 'string' ? <FieldError className={className}>{error}</FieldError> : null
      }
    </form.Subscribe>
  )
}

function SubmitButton({
  children,
  disabled = false,
  pendingLabel,
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'children' | 'type'> & {
  children: React.ReactNode
  /**
   * A reason of the form's own to refuse submission, beyond a submission already in flight — a
   * warehouse footprint that is not closed yet, a checkpoint with no point placed. It is combined
   * with `isSubmitting` rather than replacing it, so a form that has both never has to choose.
   */
  disabled?: boolean
  pendingLabel: React.ReactNode
}) {
  const form = useFormContext()

  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button {...props} type="submit" disabled={isSubmitting || disabled}>
          {isSubmitting ? pendingLabel : children}
        </Button>
      )}
    </form.Subscribe>
  )
}

export const { useAppForm } = createFormHook({
  fieldComponents: { CheckboxField, SelectField, TextareaField, TextField },
  fieldContext,
  formComponents: { Form, FormError, SubmitButton },
  formContext,
})
