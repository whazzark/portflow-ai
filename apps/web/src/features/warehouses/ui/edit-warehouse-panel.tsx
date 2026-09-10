import { ArrowLeftIcon } from 'lucide-react'
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
  doorsOutsideFootprint,
  FOOTPRINT_PROBLEM_MESSAGES,
  MINIMUM_FOOTPRINT_POINTS,
} from '@/features/warehouses/geometry/footprint-validation'
import type { WarehouseDto } from '@/features/warehouses/types'
import { WAREHOUSE_SINGULAR } from '@/features/warehouses/warehouse-lifecycle'
import { resourceFailureTitle, WRITE_PENDING_LABELS } from '@/helpers/resource-copy'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

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

const rowError = (row: Row, axis: CoordinateAxis) => {
  const touched = axis === 'latitude' ? row.latitudeTouched : row.longitudeTouched

  return touched ? coordinateError(axis, row[axis]) : undefined
}

/**
 * Keeps a text row per boundary point, driven by the draft outline in one direction and writing back
 * to it — once both axes parse — in the other. Unlike the creation panel there is no draft row: the
 * ring is closed, so a new point is inserted by splitting an edge rather than by filling a blank row.
 */
function useFootprintRows(points: LatLng[], onMovePoint: (index: number, point: LatLng) => void) {
  const [rows, setRows] = useState<Row[]>(() => points.map(rowFor))

  useEffect(() => {
    setRows((current) =>
      points.map((point, index) => {
        const row = current[index]
        if (!row) {
          return rowFor(point)
        }
        // Only overwrite text that no longer parses to the point it represents, so typing a decimal
        // or a trailing zero is never canonicalized away mid-keystroke.
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
      }),
    )
  }, [points])

  const change = (index: number, axis: CoordinateAxis, value: string) => {
    const row = rows[index] ?? rowFor(points[index])
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

    onMovePoint(index, { latitude, longitude })
  }

  return { rows, change }
}

const summarisePoints = (count: number) =>
  count === 1 ? '1 boundary point' : `${count} boundary points`

const midpointAfter = (points: LatLng[], index: number): LatLng => {
  const start = points[index]
  const end = points[(index + 1) % points.length]

  return {
    latitude: (start.latitude + end.latitude) / 2,
    longitude: (start.longitude + end.longitude) / 2,
  }
}

const samePoints = (left: LatLng[], right: LatLng[]) =>
  left.length === right.length &&
  left.every(
    (point, index) =>
      point.latitude === right[index].latitude && point.longitude === right[index].longitude,
  )

export function EditWarehousePanel({
  warehouse,
  points,
  originName,
  originPoints,
  onMovePoint,
  onInsertPoint,
  onRemovePoint,
  onRestoreOutline,
  onCancel,
  onNotFound,
  onUpdate,
  onSuccess,
}: {
  warehouse: WarehouseDto
  points: LatLng[]
  /** The name and outline as they stood when the session opened — not their live, refetchable values. */
  originName: string
  originPoints: LatLng[]
  onMovePoint: (index: number, point: LatLng) => void
  onInsertPoint: (index: number, point: LatLng) => void
  onRemovePoint: (index: number) => void
  onRestoreOutline: () => void
  onCancel: () => void
  onNotFound: () => void
  onUpdate: (value: { name: string; points: LatLng[] }) => Promise<WarehouseDto>
  onSuccess: (warehouse: WarehouseDto) => void
}) {
  const { rows, change } = useFootprintRows(points, onMovePoint)
  const problem = checkFootprint(points)
  const hasCoordinateError = rows.some(
    (row) => rowError(row, 'latitude') || rowError(row, 'longitude'),
  )
  // The API remains the enforcement point; naming the doors here only spares a round-trip and tells
  // the administrator which one is in the way while they are still shaping the outline.
  const excludedDoors = problem === null ? doorsOutsideFootprint(points, warehouse.doors ?? []) : []
  const canRemovePoint = points.length > MINIMUM_FOOTPRINT_POINTS
  const outlineModified = !samePoints(points, originPoints)
  const canSubmit = problem === null && !hasCoordinateError && excludedDoors.length === 0
  const nameSchema = z.object({
    name: z.string().trim().min(1, 'Warehouse name is required.').max(255),
  })
  // The name the session opened on, not the one being typed: a refused rename must still point at
  // the warehouse the administrator was correcting.
  const failureTitle = resourceFailureTitle('update', WAREHOUSE_SINGULAR, originName)

  const form = useAppForm({
    defaultValues: { name: originName },
    validators: { onBlur: nameSchema, onSubmit: nameSchema },
    onSubmit: async ({ formApi, value }) => {
      if (!canSubmit) {
        return
      }

      try {
        onSuccess(await onUpdate({ name: value.name.trim(), points }))
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
        } else if (apiError.code === 'E_WAREHOUSE_NOT_FOUND') {
          toast.error(failureTitle, { description: apiError.message })
          onNotFound()
        } else if (
          apiError.code === 'E_WAREHOUSE_INVALID_FOOTPRINT' ||
          apiError.code === 'E_WAREHOUSE_DOORS_OUTSIDE_FOOTPRINT' ||
          apiError.code === 'E_WAREHOUSE_ARCHIVED'
        ) {
          formApi.setErrorMap({ onSubmit: { fields: {}, form: apiError.message } })
        } else {
          toast.error(failureTitle, { description: apiError.message })
        }
      }
    },
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* Sticky because "Back to details" is the only way out of an edit panel, and the header
          scrolls with the form: a long footprint would otherwise leave the user at "Save changes"
          with no visible way to abandon. */}
      <SheetHeader className="sticky top-0 z-10 bg-background">
        <Button className="self-start" onClick={onCancel} size="sm" variant="ghost">
          <ArrowLeftIcon aria-hidden="true" />
          Back to details
        </Button>
        <SheetTitle>Edit warehouse</SheetTitle>
        <SheetDescription>
          Drag a boundary point, split an edge to add one, or remove one to reshape {warehouse.name}
          .
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
                  {summarisePoints(points.length)}
                </p>
                {outlineModified && (
                  <Button onClick={onRestoreOutline} size="sm" type="button" variant="link">
                    Restore original outline
                  </Button>
                )}
              </div>
              {/* Reshaping on the map is the expected path, so the raw coordinates stay out of the
                  way — folded away, but never removed: they are the only way to reshape a footprint
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
                        idPrefix={`warehouse-boundary-point-${index}`}
                        onChange={(value) => change(index, 'latitude', value)}
                        text={row.latitude}
                      />
                      <CoordinateField
                        axis="longitude"
                        error={rowError(row, 'longitude')}
                        idPrefix={`warehouse-boundary-point-${index}`}
                        onChange={(value) => change(index, 'longitude', value)}
                        text={row.longitude}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => onInsertPoint(index + 1, midpointAfter(points, index))}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Insert point after {index + 1}
                        </Button>
                        <Button
                          disabled={!canRemovePoint}
                          onClick={() => onRemovePoint(index)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Remove point {index + 1}
                        </Button>
                      </div>
                    </fieldset>
                  ))}
                  {!canRemovePoint && (
                    <FieldDescription role="status">
                      A warehouse footprint must keep at least three boundary points.
                    </FieldDescription>
                  )}
                </div>
              </details>
              {problem && (
                <FieldDescription role="status">
                  {FOOTPRINT_PROBLEM_MESSAGES[problem]}
                </FieldDescription>
              )}
              {excludedDoors.length > 0 && (
                <FieldDescription role="status">
                  {`Doors ${excludedDoors.map((door) => door.name).join(', ')} would fall outside the footprint. Adjust the outline around them.`}
                </FieldDescription>
              )}
            </FieldGroup>
            <form.FormError />
            <form.SubmitButton disabled={!canSubmit} pendingLabel={WRITE_PENDING_LABELS.update}>
              Save changes
            </form.SubmitButton>
          </form.Form>
        </form.AppForm>
      </div>
    </div>
  )
}
