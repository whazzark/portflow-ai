import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { FieldGroup } from '@/components/ui/field'
import type { SessionUser } from '@/features/auth/context/session-context'
import {
  isSessionHandover,
  useOwnProfileUpdate,
} from '@/features/profile/mutations/use-own-profile-update'
import { identitySchemaFields } from '@/features/users/helpers/identity-schema'
import { formatFullName } from '@/features/users/helpers/name'
import {
  resourceFailureTitle,
  resourceSuccessMessage,
  WRITE_PENDING_LABELS,
} from '@/helpers/resource-copy'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

/** The noun every toast of this form names the record with. */
const IDENTITY_SINGULAR = 'identity'

const CURRENT_PASSWORD_REQUIRED = 'Enter your current password to change your email address.'

type OwnProfileValue = {
  firstName: string
  lastName: string
  email: string
  currentPassword: string
}

/**
 * The refusals this form answers on a field of its own. Everything else is a form-level message, as
 * the API words it — reported next to what the user typed rather than in a toast alone, so they can
 * read the reason and try again from it.
 */
const FIELD_REFUSALS: Record<string, keyof OwnProfileValue> = {
  E_USER_EMAIL_CONFLICT: 'email',
  E_CURRENT_PASSWORD_REQUIRED: 'currentPassword',
  E_CURRENT_PASSWORD_INCORRECT: 'currentPassword',
}

/**
 * Whether two addresses reach the same mailbox — trimmed and case-insensitive, the comparison the
 * API makes to decide whether a change of address needs the current password.
 */
const isSameAddress = (left: string, right: string) =>
  left.trim().toLowerCase() === right.trim().toLowerCase()

/** Each field on its own, which is all a blur should judge. */
const identityFieldsSchema = z.object({ ...identitySchemaFields, currentPassword: z.string() })

/**
 * The fields, plus the rule joining two of them: a moved address needs the current password. Built
 * against the stored address, which is what decides it. Client rules spare a round trip; the API's
 * refusals remain the authority.
 *
 * Submission only, never on blur. Leaving the address field is the very moment the password field
 * appears, still empty: judged then, the form would hold an error the user has not reached yet, and
 * TanStack Form silently drops a first submission attempt made while the form is invalid — the click
 * on "Save changes" would do nothing.
 */
const identitySchemaFor = (storedEmail: string) =>
  identityFieldsSchema.superRefine((value, ctx) => {
    if (!isSameAddress(value.email, storedEmail) && value.currentPassword.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: CURRENT_PASSWORD_REQUIRED,
        path: ['currentPassword'],
      })
    }
  })

const addressMovedNotice = (address: string) =>
  `Your email address was changed by an administrator since you opened this page. It now reads “${address}”. Change it again if you still want to.`

export function OwnProfileForm({ user }: { user: SessionUser }) {
  const ownIdentityUpdate = useOwnProfileUpdate()
  /** The stored address this form is working against, as last seen or last saved. */
  const storedAddress = useRef(user.email)
  const form = useAppForm({
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      currentPassword: '',
    },
    validators: {
      onBlur: identityFieldsSchema,
      onSubmit: identitySchemaFor(user.email),
    },
    onSubmit: async ({ formApi, value }) => {
      const addressChanges = !isSameAddress(value.email, user.email)

      try {
        const response = await ownIdentityUpdate.mutateAsync({
          body: {
            firstName: value.firstName.trim(),
            lastName: value.lastName.trim(),
            email: value.email.trim(),
            // Sent only when it is asked for: a password the API has no use for stays here.
            ...(addressChanges ? { currentPassword: value.currentPassword } : {}),
          },
        })
        const saved = response.data

        toast.success(resourceSuccessMessage('update', IDENTITY_SINGULAR, formatFullName(saved)))
        storedAddress.current = saved.email
        formApi.reset({
          firstName: saved.firstName,
          lastName: saved.lastName,
          email: saved.email,
          currentPassword: '',
        })
      } catch (error) {
        // The mutation is already moving the user off this screen.
        if (isSessionHandover(error)) {
          return
        }

        // Never kept past an attempt that did not apply: it is retyped for every new one.
        formApi.setFieldValue('currentPassword', '')

        if (applyValidationError(formApi, error)) {
          return
        }

        const apiError = parseApiError(error)
        const field = FIELD_REFUSALS[apiError.code]

        // Reported in the form, next to what the user typed, so they can try again from it.
        formApi.setErrorMap({
          onSubmit: {
            fields: field ? { [field]: apiError.message } : {},
            form: field ? '' : apiError.message,
          },
        })

        if (!field) {
          toast.error(resourceFailureTitle('update', IDENTITY_SINGULAR, formatFullName(user)), {
            description: apiError.message,
          })
        }
      }
    },
  })

  /**
   * The stored address moved while this form was open — an administrator corrected it. The field is
   * re-seeded with it and the change is named, rather than leaving the form asking for a password to
   * put back an address the user never saw replaced.
   */
  useEffect(() => {
    if (isSameAddress(storedAddress.current, user.email)) {
      return
    }

    storedAddress.current = user.email
    form.setFieldValue('email', user.email)
    form.setFieldValue('currentPassword', '')
    form.setErrorMap({ onSubmit: { fields: {}, form: addressMovedNotice(user.email) } })
  }, [user.email, form])

  return (
    <form.AppForm>
      <form.Form aria-label="Identity" className="flex flex-col gap-6">
        <FieldGroup>
          <form.AppField name="firstName">
            {(field) => (
              <field.TextField autoComplete="given-name" label="First name" required={true} />
            )}
          </form.AppField>
          <form.AppField name="lastName">
            {(field) => (
              <field.TextField autoComplete="family-name" label="Last name" required={true} />
            )}
          </form.AppField>
          <form.AppField name="email">
            {(field) => (
              <field.TextField
                autoComplete="email"
                inputMode="email"
                label="Email"
                required={true}
                type="email"
              />
            )}
          </form.AppField>
          <form.Subscribe selector={(state) => state.values.email}>
            {(email) =>
              isSameAddress(email, user.email) ? null : (
                <form.AppField name="currentPassword">
                  {(field) => (
                    <field.TextField
                      autoComplete="current-password"
                      description="Your email address is how you sign in. Confirm the change with your current password."
                      label="Current password"
                      required={true}
                      type="password"
                    />
                  )}
                </form.AppField>
              )
            }
          </form.Subscribe>
        </FieldGroup>
        <form.FormError />
        <form.SubmitButton className="self-start" pendingLabel={WRITE_PENDING_LABELS.update}>
          Save changes
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
