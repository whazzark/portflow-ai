import { useEffect, useState } from 'react'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export type CoordinateAxis = 'latitude' | 'longitude'

const COORDINATE_LABELS: Record<CoordinateAxis, string> = {
  latitude: 'Latitude',
  longitude: 'Longitude',
}

const COORDINATE_RANGES: Record<CoordinateAxis, [number, number]> = {
  latitude: [-90, 90],
  longitude: [-180, 180],
}

export function parseCoordinate(axis: CoordinateAxis, text: string): number | undefined {
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

export function coordinateError(axis: CoordinateAxis, text: string): string | undefined {
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
 * a keyboard-only administrator — with no pointer to click the map — can still set a site
 * reference's location by typing both values directly; this is the accessible fallback to map
 * click/drag placement (see research.md). They are kept as local, string-backed state rather than
 * TanStack Form fields, driven by the pending map placement (external source of truth) in one
 * direction, and writing back to it — once both axes parse to a valid number — in the other. A
 * field's error is shown only after it has been touched, so an untouched blank field doesn't show
 * a spurious "required" message before the administrator has interacted with either input.
 */
export function useCoordinateFields(
  pending: LatLng | null,
  onPendingChange: (point: LatLng) => void,
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
    // A discarded placement clears the fields too: switching creation kind drops the pending
    // point, and without this the freshly mounted form would keep the abandoned coordinates —
    // a populated, valid-looking pair with no marker on the map and a disabled submit.
    if (!pending) {
      setLatitudeText('')
      setLongitudeText('')
      setLatitudeTouched(false)
      setLongitudeTouched(false)
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

/** A single latitude/longitude input, purely presentational — `idPrefix` keeps its element id
 * unique when a page renders more than one resource's placement fields (not expected today, but
 * cheap to keep collision-safe). Resource-agnostic: no knowledge of what the coordinates belong to. */
export function CoordinateField({
  idPrefix,
  axis,
  text,
  error,
  onChange,
}: {
  idPrefix: string
  axis: CoordinateAxis
  text: string
  error?: string
  onChange: (value: string) => void
}) {
  const label = COORDINATE_LABELS[axis]
  const inputId = `${idPrefix}-${axis}`
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
