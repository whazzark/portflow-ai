import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { DockDto } from '@/features/docks/types'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

export type PendingDockPlacement = {
  latitude: number
  longitude: number
}

const nameSchema = z.object({
  name: z.string().trim().min(1, 'Dock name is required.').max(255),
})

type CoordinateAxis = 'latitude' | 'longitude'

const COORDINATE_LABELS: Record<CoordinateAxis, string> = {
  latitude: 'Latitude',
  longitude: 'Longitude',
}

const COORDINATE_RANGES: Record<CoordinateAxis, [number, number]> = {
  latitude: [-90, 90],
  longitude: [-180, 180],
}

function parseCoordinate(axis: CoordinateAxis, text: string): number | undefined {
  const trimmed = text.trim()
  if (trimmed === '') {
    return undefined
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    return undefined
  }

  const [min, max] = COORDINATE_RANGES[axis]
  if (parsed < min || parsed > max) {
    return undefined
  }

  return parsed
}

function coordinateError(axis: CoordinateAxis, text: string): string | undefined {
  const label = COORDINATE_LABELS[axis]
  if (text.trim() === '') {
    return `${label} is required.`
  }

  if (parseCoordinate(axis, text) !== undefined) {
    return undefined
  }

  if (!Number.isFinite(Number(text.trim()))) {
    return `${label} must be a number.`
  }

  const [min, max] = COORDINATE_RANGES[axis]
  return `${label} must be between ${min} and ${max}.`
}

/**
 * Both coordinate fields are always rendered (not gated behind an existing pending placement) so
 * a keyboard-only administrator — with no pointer to click the map — can still set a dock's
 * location by typing both values directly; this is the accessible fallback to map click/drag
 * placement (see research.md). They are kept as local, string-backed state rather than TanStack
 * Form fields, driven by the pending map placement (external source of truth) in one direction,
 * and writing back to it — once both axes parse to a valid number — in the other. A field's error
 * is shown only after it has been touched, so an untouched blank field doesn't show a spurious
 * "required" message before the administrator has interacted with either input.
 */
function useCoordinateFields(
  pending: PendingDockPlacement | null,
  onPendingChange: (point: PendingDockPlacement) => void,
) {
  const [latitudeText, setLatitudeText] = useState(() => (pending ? String(pending.latitude) : ''))
  const [longitudeText, setLongitudeText] = useState(() =>
    pending ? String(pending.longitude) : '',
  )
  const [latitudeTouched, setLatitudeTouched] = useState(false)
  const [longitudeTouched, setLongitudeTouched] = useState(false)

  // Only overwrite a field's text when the incoming pending value doesn't already match what it
  // currently parses to. Without this guard, every keystroke that happens to parse (e.g. "20."
  // parses to 20) round-trips through `commit` -> `onPendingChange` -> this effect and gets
  // canonicalized back to "20", making it impossible to type a decimal or a trailing zero.
  useEffect(() => {
    if (!pending) {
      return
    }
    setLatitudeText((current) =>
      parseCoordinate('latitude', current) === pending.latitude
        ? current
        : String(pending.latitude),
    )
    setLongitudeText((current) =>
      parseCoordinate('longitude', current) === pending.longitude
        ? current
        : String(pending.longitude),
    )
  }, [pending])

  const commit = (nextLatitudeText: string, nextLongitudeText: string) => {
    const latitude = parseCoordinate('latitude', nextLatitudeText)
    const longitude = parseCoordinate('longitude', nextLongitudeText)
    if (latitude !== undefined && longitude !== undefined) {
      onPendingChange({ latitude, longitude })
    }
  }

  return {
    latitude: {
      text: latitudeText,
      error: latitudeTouched ? coordinateError('latitude', latitudeText) : undefined,
      onChange: (value: string) => {
        setLatitudeText(value)
        setLatitudeTouched(true)
        commit(value, longitudeText)
      },
    },
    longitude: {
      text: longitudeText,
      error: longitudeTouched ? coordinateError('longitude', longitudeText) : undefined,
      onChange: (value: string) => {
        setLongitudeText(value)
        setLongitudeTouched(true)
        commit(latitudeText, value)
      },
    },
  }
}

function CoordinateField({
  axis,
  text,
  error,
  onChange,
}: {
  axis: CoordinateAxis
  text: string
  error?: string
  onChange: (value: string) => void
}) {
  const label = COORDINATE_LABELS[axis]
  const inputId = `dock-${axis}`
  const errorId = `${inputId}-error`

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        aria-required="true"
        id={inputId}
        inputMode="decimal"
        onChange={(event) => onChange(event.target.value)}
        value={text}
      />
      {error && <FieldError errors={[{ message: error }]} id={errorId} />}
    </Field>
  )
}

export function DockForm({
  pending,
  onPendingChange,
  onCreate,
  onSuccess,
}: {
  pending: PendingDockPlacement | null
  onPendingChange: (point: PendingDockPlacement) => void
  onCreate: (value: { name: string; latitude: number; longitude: number }) => Promise<DockDto>
  onSuccess: (dock: DockDto) => void
}) {
  const coordinateFields = useCoordinateFields(pending, onPendingChange)
  const hasCoordinateError = Boolean(
    coordinateFields.latitude.error || coordinateFields.longitude.error,
  )
  const canSubmit = Boolean(pending) && !hasCoordinateError

  const form = useAppForm({
    defaultValues: { name: '' },
    validators: {
      onBlur: nameSchema,
      onSubmit: nameSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      if (!pending || hasCoordinateError) {
        return
      }

      try {
        const result = await onCreate({
          name: value.name.trim(),
          latitude: pending.latitude,
          longitude: pending.longitude,
        })

        onSuccess(result)
      } catch (error) {
        if (!applyValidationError(formApi, error)) {
          const apiError = parseApiError(error)

          if (apiError.code === 'E_DOCK_NAME_CONFLICT') {
            formApi.setErrorMap({
              onSubmit: { fields: { name: apiError.message }, form: '' },
            })
          } else {
            toast.error('Unable to create dock', { description: apiError.message })
          }
        }
      }
    },
  })

  return (
    <form.AppForm>
      <form.Form className="flex flex-col gap-6">
        <FieldGroup>
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                autoComplete="off"
                label="Dock name"
                placeholder="North Dock"
                required={true}
              />
            )}
          </form.AppField>
          <FieldDescription role="status">
            Click the map to place the new dock, or enter its coordinates directly.
          </FieldDescription>
          <CoordinateField
            axis="latitude"
            error={coordinateFields.latitude.error}
            onChange={coordinateFields.latitude.onChange}
            text={coordinateFields.latitude.text}
          />
          <CoordinateField
            axis="longitude"
            error={coordinateFields.longitude.error}
            onChange={coordinateFields.longitude.onChange}
            text={coordinateFields.longitude.text}
          />
          {!pending && (
            <FieldDescription role="status">
              A location must be placed before this dock can be created.
            </FieldDescription>
          )}
        </FieldGroup>
        <form.FormError />
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button disabled={isSubmitting || !canSubmit} type="submit">
              {isSubmitting ? 'Creating…' : 'Create dock'}
            </Button>
          )}
        </form.Subscribe>
      </form.Form>
    </form.AppForm>
  )
}
