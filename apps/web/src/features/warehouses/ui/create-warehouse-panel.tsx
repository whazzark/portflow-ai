import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import {
  type CoordinateAxis,
  CoordinateField,
  coordinateError,
  parseCoordinate,
} from '@/components/resource-map/resource-placement-fields'
import { Button } from '@/components/ui/button'
import { FieldDescription, FieldGroup } from '@/components/ui/field'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  checkFootprint,
  FOOTPRINT_PROBLEM_MESSAGES,
} from '@/features/warehouses/geometry/footprint-validation'
import type { WarehouseDto } from '@/features/warehouses/types'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

const ERROR_TITLE = 'Unable to create warehouse'

/** Touch is tracked per axis, not per row: a field only shows its error once it has been edited,
 * and typing a latitude must not flag the longitude beside it as missing. */
type Row = {
  latitude: string
  longitude: string
  latitudeTouched: boolean
  longitudeTouched: boolean
}

const rowFor = (point: LatLng): Row => ({
  latitude: String(point.latitude),
  longitude: String(point.longitude),
  latitudeTouched: false,
  longitudeTouched: false,
})

const emptyRow = (): Row => ({
  latitude: '',
  longitude: '',
  latitudeTouched: false,
  longitudeTouched: false,
})

const rowError = (row: Row, axis: CoordinateAxis) => {
  const touched = axis === 'latitude' ? row.latitudeTouched : row.longitudeTouched

  return touched ? coordinateError(axis, row[axis]) : undefined
}

/**
 * Keeps a text row per boundary point, driven by the pending footprint (the external source of
 * truth) in one direction and writing back to it — once both axes parse — in the other. The row
 * past `points.length` is a draft: a keyboard-only administrator adds a row first and it becomes a
 * real boundary point as soon as both of its coordinates parse. Only ever one draft at a time,
 * since a row's position is what tells a draft from a placed point.
 */
function useFootprintRows(
  points: LatLng[],
  onAddPoint: (point: LatLng) => void,
  onMovePoint: (index: number, point: LatLng) => void,
) {
  const [rows, setRows] = useState<Row[]>(() => points.map(rowFor))

  useEffect(() => {
    setRows((current) => {
      const next = points.map((point, index) => {
        const row = current[index]
        if (!row) {
          return rowFor(point)
        }
        // Only overwrite text that no longer parses to the point it represents, so typing a
        // decimal or a trailing zero is never canonicalized away mid-keystroke.
        return {
          latitude:
            parseCoordinate('latitude', row.latitude) === point.latitude
              ? row.latitude
              : String(point.latitude),
          longitude:
            parseCoordinate('longitude', row.longitude) === point.longitude
              ? row.longitude
              : String(point.longitude),
          latitudeTouched: row.latitudeTouched,
          longitudeTouched: row.longitudeTouched,
        }
      })

      // Preserve any draft row the administrator is still filling in.
      return [...next, ...current.slice(points.length)]
    })
  }, [points])

  const change = (index: number, axis: CoordinateAxis, value: string) => {
    const row = rows[index] ?? emptyRow()
    const updated: Row =
      axis === 'latitude'
        ? { ...row, latitude: value, latitudeTouched: true }
        : { ...row, longitude: value, longitudeTouched: true }
    setRows((current) =>
      current.map((existing, position) => (position === index ? updated : existing)),
    )

    const latitude = parseCoordinate('latitude', updated.latitude)
    const longitude = parseCoordinate('longitude', updated.longitude)
    if (latitude === undefined || longitude === undefined) {
      return
    }

    if (index < points.length) {
      onMovePoint(index, { latitude, longitude })
      return
    }

    onAddPoint({ latitude, longitude })
  }

  return {
    rows,
    change,
    // At most one draft at a time. `change` tells a draft from a placed point by its position, so
    // a second empty row could be filled out of order: it would write to the wrong point and then
    // append another one on every keystroke.
    addDraftRow: () =>
      setRows((current) => (current.length > points.length ? current : [...current, emptyRow()])),
    dropLastRow: () => setRows((current) => current.slice(0, -1)),
    hasDraftRow: rows.length > points.length,
  }
}

function summarisePoints(count: number, isComplete: boolean) {
  if (count === 0) {
    return 'No points placed yet'
  }

  const placed = count === 1 ? '1 point placed' : `${count} points placed`

  return isComplete ? `${placed} · outline finished` : placed
}

export function CreateWarehousePanel({
  points,
  isOutlineComplete = false,
  onAddPoint,
  onMovePoint,
  onRemoveLastPoint,
  onCancel,
  onCreate,
  onSuccess,
}: {
  points: LatLng[]
  isOutlineComplete?: boolean
  onAddPoint: (point: LatLng) => void
  onMovePoint: (index: number, point: LatLng) => void
  onRemoveLastPoint: () => void
  onCancel: () => void
  onCreate: (value: { name: string; points: LatLng[] }) => Promise<WarehouseDto>
  onSuccess: (warehouse: WarehouseDto) => void
}) {
  const { rows, change, addDraftRow, dropLastRow, hasDraftRow } = useFootprintRows(
    points,
    onAddPoint,
    onMovePoint,
  )
  const problem = checkFootprint(points)
  const hasCoordinateError = rows.some(
    (row) => rowError(row, 'latitude') || rowError(row, 'longitude'),
  )
  const canSubmit = problem === null && !hasCoordinateError && !hasDraftRow
  const nameSchema = z.object({
    name: z.string().trim().min(1, 'Warehouse name is required.').max(255),
  })

  const form = useAppForm({
    defaultValues: { name: '' },
    validators: { onBlur: nameSchema, onSubmit: nameSchema },
    onSubmit: async ({ formApi, value }) => {
      if (!canSubmit) {
        return
      }

      try {
        onSuccess(await onCreate({ name: value.name.trim(), points }))
      } catch (error) {
        if (applyValidationError(formApi, error)) {
          return
        }

        const apiError = parseApiError(error)

        if (
          apiError.code === 'E_WAREHOUSE_NAME_CONFLICT' ||
          apiError.code === 'E_WAREHOUSE_NAME_INVALID'
        ) {
          formApi.setErrorMap({ onSubmit: { fields: { name: apiError.message }, form: '' } })
        } else if (apiError.code === 'E_WAREHOUSE_INVALID_FOOTPRINT') {
          formApi.setErrorMap({ onSubmit: { fields: {}, form: apiError.message } })
        } else {
          toast.error(ERROR_TITLE, { description: apiError.message })
        }
      }
    },
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Create warehouse</SheetTitle>
        <SheetDescription>
          Click the map to draw the warehouse footprint, then name it. Click the first point again
          to finish the outline.
        </SheetDescription>
      </SheetHeader>
      <div className="px-4 pb-4">
        <form.AppForm>
          <form.Form className="flex flex-col gap-6">
            <FieldGroup>
              <form.AppField name="name">
                {(field) => (
                  <field.TextField
                    autoComplete="off"
                    label="Warehouse name"
                    placeholder="North Shed"
                    required={true}
                  />
                )}
              </form.AppField>
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-sm" role="status">
                  {summarisePoints(points.length, isOutlineComplete)}
                </p>
                <Button
                  disabled={rows.length === 0}
                  onClick={() => {
                    if (hasDraftRow) {
                      dropLastRow()
                      return
                    }
                    dropLastRow()
                    onRemoveLastPoint()
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Remove last point
                </Button>
              </div>
              {/* Drawing on the map is the expected path, so the raw coordinates stay out of the
                  way — folded away, but never removed: they are the only way to place a footprint
                  without a pointing device. */}
              <details className="rounded-md border px-3 py-2">
                <summary className="cursor-pointer font-medium text-sm">
                  Coordinates (advanced)
                </summary>
                <div className="flex flex-col gap-3 pt-3">
                  {rows.map((row, index) => (
                    <fieldset
                      className="flex flex-col gap-2 rounded-md border p-3"
                      // biome-ignore lint/suspicious/noArrayIndexKey: positional points — index is identity
                      key={`boundary-point-${index}`}
                    >
                      <legend className="px-1 font-medium text-sm">
                        Boundary point {index + 1}
                      </legend>
                      <CoordinateField
                        axis="latitude"
                        error={rowError(row, 'latitude')}
                        idPrefix={`warehouse-point-${index}`}
                        onChange={(value) => change(index, 'latitude', value)}
                        text={row.latitude}
                      />
                      <CoordinateField
                        axis="longitude"
                        error={rowError(row, 'longitude')}
                        idPrefix={`warehouse-point-${index}`}
                        onChange={(value) => change(index, 'longitude', value)}
                        text={row.longitude}
                      />
                    </fieldset>
                  ))}
                  {/* One draft at a time: the row only becomes a boundary point once both of its
                      coordinates parse, and a second empty row could be filled out of order. */}
                  <Button
                    disabled={hasDraftRow}
                    onClick={addDraftRow}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Add boundary point
                  </Button>
                </div>
              </details>
              {problem && (
                <FieldDescription role="status">
                  {FOOTPRINT_PROBLEM_MESSAGES[problem]}
                </FieldDescription>
              )}
            </FieldGroup>
            <form.FormError />
            <div className="flex gap-2">
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button disabled={isSubmitting || !canSubmit} type="submit">
                    {isSubmitting ? 'Creating…' : 'Create warehouse'}
                  </Button>
                )}
              </form.Subscribe>
              <Button onClick={onCancel} type="button" variant="outline">
                Cancel
              </Button>
            </div>
          </form.Form>
        </form.AppForm>
      </div>
    </div>
  )
}
