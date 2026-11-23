import { toast } from 'sonner'
import { z } from 'zod'

import { FieldGroup } from '@/components/ui/field'
import { SheetFooter } from '@/components/ui/sheet'
import { identitySchemaFields } from '@/features/users/helpers/identity-schema'
import { formatFullName } from '@/features/users/helpers/name'
import {
  USER_ROLE_LABELS,
  USER_ROLE_OPTIONS,
  USER_SINGULAR,
} from '@/features/users/helpers/user-labels'
import type { UserDto } from '@/features/users/types'
import {
  resourceFailureTitle,
  resourceSuccessMessage,
  WRITE_PENDING_LABELS,
} from '@/helpers/resource-copy'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

const userSchema = z.object({
  ...identitySchemaFields,
  role: z.enum(['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER']),
})

export type EditUserValue = z.infer<typeof userSchema>

/**
 * The refusals this form can answer on a field of its own. Everything else is a form-level message,
 * shown as the API words it: a pending user's address that cannot change, or a deactivated user's
 * role, is about the user's state, not about anything the administrator typed.
 */
const FIELD_REFUSALS: Record<string, keyof EditUserValue> = {
  E_USER_EMAIL_CONFLICT: 'email',
}

type EditUserFormProps = {
  user: UserDto
  onUpdate: (value: EditUserValue) => Promise<UserDto>
  onSuccess: (user: UserDto) => void
}

export function EditUserForm({ user, onUpdate, onSuccess }: EditUserFormProps) {
  // The API refuses any role change on a deactivated user, so the interface does not offer one: the
  // role is shown as it stands, with the way to unfreeze it.
  const roleIsFrozen = user.accessStatus === 'DEACTIVATED'

  const form = useAppForm({
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    },
    validators: {
      onBlur: userSchema,
      onSubmit: userSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      try {
        const saved = await onUpdate({
          firstName: value.firstName.trim(),
          lastName: value.lastName.trim(),
          email: value.email.trim(),
          role: value.role,
        })

        toast.success(resourceSuccessMessage('update', USER_SINGULAR, formatFullName(saved)))
        onSuccess(saved)
      } catch (error) {
        if (applyValidationError(formApi, error)) {
          return
        }

        const apiError = parseApiError(error)
        const field = FIELD_REFUSALS[apiError.code]

        // Reported in the form, never as a toast that leaves with the panel: the administrator has
        // to be able to read the reason next to what they typed, and try again from it.
        formApi.setErrorMap({
          onSubmit: {
            fields: field ? { [field]: apiError.message } : {},
            form: field ? '' : apiError.message,
          },
        })

        if (!field) {
          toast.error(resourceFailureTitle('update', USER_SINGULAR, formatFullName(user)), {
            description: apiError.message,
          })
        }
      }
    },
  })

  return (
    <form.AppForm>
      {/* The body scrolls and the footer stays put, so the submission is in reach however long the
          form grows. The footer stays inside the <form> so the button still submits it. */}
      <form.Form className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
          <FieldGroup>
            <form.AppField name="firstName">
              {(field) => <field.TextField autoComplete="off" label="First name" required={true} />}
            </form.AppField>
            <form.AppField name="lastName">
              {(field) => <field.TextField autoComplete="off" label="Last name" required={true} />}
            </form.AppField>
            <form.AppField name="email">
              {(field) => (
                <field.TextField
                  autoComplete="off"
                  inputMode="email"
                  label="Email"
                  required={true}
                  type="email"
                />
              )}
            </form.AppField>
            {roleIsFrozen ? (
              <div className="grid gap-1 text-sm">
                <span className="font-medium">Role</span>
                <span>{USER_ROLE_LABELS[user.role]}</span>
                <span className="text-muted-foreground">
                  A deactivated user's role cannot be changed. Reactivate the user first.
                </span>
              </div>
            ) : (
              <form.AppField name="role">
                {(field) => (
                  <field.SelectField label="Role" options={USER_ROLE_OPTIONS} required={true} />
                )}
              </form.AppField>
            )}
          </FieldGroup>
          <form.FormError />
        </div>
        <SheetFooter className="shrink-0 border-t px-6 py-4 sm:flex-row sm:justify-end">
          <form.SubmitButton pendingLabel={WRITE_PENDING_LABELS.update} size="lg">
            Save changes
          </form.SubmitButton>
        </SheetFooter>
      </form.Form>
    </form.AppForm>
  )
}
