import { toast } from 'sonner'
import { z } from 'zod'

import { FieldGroup } from '@/components/ui/field'
import { SheetFooter } from '@/components/ui/sheet'
import { invitationConflictMessage } from '@/features/users/helpers/user-invitation-copy'
import { USER_ROLE_LABELS, USER_SINGULAR } from '@/features/users/helpers/user-labels'
import type { UserInvitationDto } from '@/features/users/types'
import { resourceFailureTitle, WRITE_PENDING_LABELS } from '@/helpers/resource-copy'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

const ROLE_OPTIONS = Object.entries(USER_ROLE_LABELS).map(([value, label]) => ({ label, value }))

const invitationSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(255),
  lastName: z.string().trim().min(1, 'Last name is required.').max(255),
  email: z.string().trim().min(1, 'Email is required.').max(255).email('Enter a valid email.'),
  role: z.enum(['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER']),
})

export type InviteUserValues = z.infer<typeof invitationSchema>

type InviteUserFormProps = {
  onInvite: (value: InviteUserValues) => Promise<UserInvitationDto>
  onSuccess: (invitation: UserInvitationDto) => void
}

export function InviteUserForm({ onInvite, onSuccess }: InviteUserFormProps) {
  const form = useAppForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      role: 'OBSERVER',
    } as InviteUserValues,
    validators: {
      onBlur: invitationSchema,
      onSubmit: invitationSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      try {
        onSuccess(await onInvite(value))
      } catch (error) {
        // A refused invitation keeps everything that was typed: correcting one field is the next
        // step, and re-entering the other three is not.
        if (applyValidationError(formApi, error)) {
          return
        }

        const apiError = parseApiError(error)

        // The email is the field in conflict, so the refusal is shown on it — with the action that
        // applies to the person already holding it, not a bare "already in use".
        if (apiError.code === 'E_USER_EMAIL_CONFLICT') {
          formApi.setErrorMap({
            onSubmit: {
              fields: { email: invitationConflictMessage(apiError.meta, apiError.message) },
              form: apiError.message,
            },
          })

          return
        }

        toast.error(resourceFailureTitle('create', USER_SINGULAR, value.email.trim()), {
          description: apiError.message,
        })
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
              {(field) => (
                <field.TextField
                  autoComplete="given-name"
                  label="First name"
                  placeholder="Claire"
                  required={true}
                />
              )}
            </form.AppField>
            <form.AppField name="lastName">
              {(field) => (
                <field.TextField
                  autoComplete="family-name"
                  label="Last name"
                  placeholder="Martin"
                  required={true}
                />
              )}
            </form.AppField>
            <form.AppField name="email">
              {(field) => (
                <field.TextField
                  autoComplete="email"
                  label="Email"
                  placeholder="claire.martin@portflow.test"
                  required={true}
                />
              )}
            </form.AppField>
            <form.AppField name="role">
              {(field) => (
                <field.SelectField
                  description="What the invited person will be responsible for."
                  label="Role"
                  options={ROLE_OPTIONS}
                  required={true}
                />
              )}
            </form.AppField>
          </FieldGroup>
          <form.FormError />
        </div>
        <SheetFooter className="shrink-0 border-t px-6 py-4 sm:flex-row sm:justify-end">
          <form.SubmitButton pendingLabel={WRITE_PENDING_LABELS.create} size="lg">
            Invite user
          </form.SubmitButton>
        </SheetFooter>
      </form.Form>
    </form.AppForm>
  )
}
