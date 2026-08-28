import { HttpResponse, http } from 'msw'
import type { WarehouseDto } from '@/features/warehouses/types'
import {
  API_BASE_URL,
  type ArchivedWarehouseDoorDto,
  type CreatedWarehouseDoorDto,
  type ReactivatedWarehouseDoorDto,
  type UpdatedWarehouseDoorDto,
} from './fixtures'

export function warehousesHandler(warehouses: WarehouseDto[]) {
  return http.get(`${API_BASE_URL}/api/v1/warehouses`, () =>
    HttpResponse.json({ data: warehouses }),
  )
}

export function warehousesErrorHandler(status = 503) {
  return http.get(`${API_BASE_URL}/api/v1/warehouses`, () =>
    HttpResponse.json({ error: { code: 'E_WAREHOUSES_UNAVAILABLE' } }, { status }),
  )
}

export function warehousesSequenceHandler(
  responses: Array<{ warehouses: WarehouseDto[] } | { errorStatus: number }>,
) {
  let requestIndex = 0

  return http.get(`${API_BASE_URL}/api/v1/warehouses`, () => {
    const response = responses[Math.min(requestIndex, responses.length - 1)]
    requestIndex += 1
    return 'warehouses' in response
      ? HttpResponse.json({ data: response.warehouses })
      : HttpResponse.json(
          { error: { code: 'E_WAREHOUSES_UNAVAILABLE' } },
          { status: response.errorStatus },
        )
  })
}

export function createWarehouseHandler(created: WarehouseDto) {
  return http.post(`${API_BASE_URL}/api/v1/warehouses`, () =>
    HttpResponse.json({ data: created }, { status: 201 }),
  )
}

export function createWarehouseConflictHandler() {
  return http.post(`${API_BASE_URL}/api/v1/warehouses`, () =>
    HttpResponse.json(
      {
        error: {
          code: 'E_WAREHOUSE_NAME_CONFLICT',
          message: 'Warehouse name is already in use',
        },
      },
      { status: 409 },
    ),
  )
}

export function createWarehouseInvalidFootprintHandler() {
  return http.post(`${API_BASE_URL}/api/v1/warehouses`, () =>
    HttpResponse.json(
      {
        error: {
          code: 'E_WAREHOUSE_INVALID_FOOTPRINT',
          message: 'Warehouse footprint outline must not cross itself',
        },
      },
      { status: 422 },
    ),
  )
}

export function createWarehouseFailureHandler(status = 500) {
  return http.post(`${API_BASE_URL}/api/v1/warehouses`, () =>
    HttpResponse.json(
      { error: { code: 'E_INTERNAL_SERVER_ERROR', message: 'Something went wrong' } },
      { status },
    ),
  )
}

const warehouseUrl = (id: string) => `${API_BASE_URL}/api/v1/warehouses/${id}`

export function updateWarehouseHandler(updated: WarehouseDto) {
  return http.patch(warehouseUrl(updated.id), () => HttpResponse.json({ data: updated }))
}

export function updateWarehouseErrorHandler(
  id: string,
  error: { code: string; message: string },
  status: number,
) {
  return http.patch(warehouseUrl(id), () => HttpResponse.json({ error }, { status }))
}

export const updateWarehouseConflictHandler = (id: string) =>
  updateWarehouseErrorHandler(
    id,
    { code: 'E_WAREHOUSE_NAME_CONFLICT', message: 'Warehouse name is already in use' },
    409,
  )

export const updateWarehouseArchivedHandler = (id: string) =>
  updateWarehouseErrorHandler(
    id,
    {
      code: 'E_WAREHOUSE_ARCHIVED',
      message: 'Archived warehouses are read-only. Reactivate the warehouse first.',
    },
    409,
  )

export const updateWarehouseDoorsOutsideHandler = (id: string, doorNames: string[]) =>
  updateWarehouseErrorHandler(
    id,
    {
      code: 'E_WAREHOUSE_DOORS_OUTSIDE_FOOTPRINT',
      message: `Doors ${doorNames.join(', ')} would fall outside the new footprint`,
    },
    409,
  )

export const updateWarehouseNotFoundHandler = (id: string) =>
  updateWarehouseErrorHandler(
    id,
    { code: 'E_WAREHOUSE_NOT_FOUND', message: 'Warehouse not found' },
    404,
  )

export const updateWarehouseInvalidFootprintHandler = (id: string) =>
  updateWarehouseErrorHandler(
    id,
    {
      code: 'E_WAREHOUSE_INVALID_FOOTPRINT',
      message: 'Warehouse footprint outline must not cross itself',
    },
    422,
  )

export function updateWarehouseFailureHandler(id: string, status = 500) {
  return updateWarehouseErrorHandler(
    id,
    { code: 'E_INTERNAL_SERVER_ERROR', message: 'Something went wrong' },
    status,
  )
}

const warehouseDoorsUrl = `${API_BASE_URL}/api/v1/warehouse-doors`

/** The 201 body is the standalone door DTO — `warehouseId` and `createdAt` included — not the
 * shape embedded under a warehouse. */
export function createWarehouseDoorHandler(created: CreatedWarehouseDoorDto) {
  return http.post(warehouseDoorsUrl, () => HttpResponse.json({ data: created }, { status: 201 }))
}

export function createWarehouseDoorErrorHandler(
  error: { code: string; message: string },
  status: number,
) {
  return http.post(warehouseDoorsUrl, () => HttpResponse.json({ error }, { status }))
}

export const createWarehouseDoorConflictHandler = () =>
  createWarehouseDoorErrorHandler(
    {
      code: 'E_WAREHOUSE_DOOR_NAME_CONFLICT',
      message: 'Warehouse door name is already in use in this warehouse',
    },
    409,
  )

export const createWarehouseDoorOutsideFootprintHandler = () =>
  createWarehouseDoorErrorHandler(
    {
      code: 'E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT',
      message: 'Warehouse door must be placed within its warehouse footprint',
    },
    422,
  )

export const createWarehouseDoorArchivedWarehouseHandler = () =>
  createWarehouseDoorErrorHandler(
    {
      code: 'E_WAREHOUSE_ARCHIVED',
      message: 'Archived warehouses are read-only. Reactivate the warehouse first.',
    },
    409,
  )

export const createWarehouseDoorFailureHandler = (status = 500) =>
  createWarehouseDoorErrorHandler(
    { code: 'E_INTERNAL_SERVER_ERROR', message: 'Something went wrong' },
    status,
  )

/** Fails once, then succeeds — the retry-after-a-transient-failure path. */
export function createWarehouseDoorRecoveringHandler(created: CreatedWarehouseDoorDto) {
  let attempts = 0

  return http.post(warehouseDoorsUrl, () => {
    attempts += 1

    return attempts === 1
      ? HttpResponse.json(
          { error: { code: 'E_INTERNAL_SERVER_ERROR', message: 'Something went wrong' } },
          { status: 500 },
        )
      : HttpResponse.json({ data: created }, { status: 201 })
  })
}

const warehouseDoorUrl = (id: string) => `${warehouseDoorsUrl}/${id}`

/** The 200 body is the standalone door DTO — `warehouseId`, `createdAt`, and the advanced
 * `updatedAt` included — not the shape embedded under a warehouse. */
export function updateWarehouseDoorHandler(updated: UpdatedWarehouseDoorDto) {
  return http.patch(warehouseDoorUrl(updated.id), () => HttpResponse.json({ data: updated }))
}

export function updateWarehouseDoorErrorHandler(
  id: string,
  error: { code: string; message: string },
  status: number,
) {
  return http.patch(warehouseDoorUrl(id), () => HttpResponse.json({ error }, { status }))
}

export const updateWarehouseDoorConflictHandler = (id: string) =>
  updateWarehouseDoorErrorHandler(
    id,
    {
      code: 'E_WAREHOUSE_DOOR_NAME_CONFLICT',
      message: 'Warehouse door name is already in use in this warehouse',
    },
    409,
  )

export const updateWarehouseDoorOutsideFootprintHandler = (id: string) =>
  updateWarehouseDoorErrorHandler(
    id,
    {
      code: 'E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT',
      message: 'Warehouse door must be placed within its warehouse footprint',
    },
    422,
  )

export const updateWarehouseDoorArchivedHandler = (id: string) =>
  updateWarehouseDoorErrorHandler(
    id,
    {
      code: 'E_WAREHOUSE_DOOR_ARCHIVED',
      message: 'Archived warehouse doors are read-only. Reactivate the door first.',
    },
    409,
  )

export const updateWarehouseDoorNotFoundHandler = (id: string) =>
  updateWarehouseDoorErrorHandler(
    id,
    { code: 'E_WAREHOUSE_DOOR_NOT_FOUND', message: 'Warehouse door not found' },
    404,
  )

export const updateWarehouseDoorFailureHandler = (id: string, status = 500) =>
  updateWarehouseDoorErrorHandler(
    id,
    { code: 'E_INTERNAL_SERVER_ERROR', message: 'Something went wrong' },
    status,
  )

/** Fails once, then succeeds — the retry-after-a-transient-failure path. */
export function updateWarehouseDoorRecoveringHandler(updated: UpdatedWarehouseDoorDto) {
  let attempts = 0

  return http.patch(warehouseDoorUrl(updated.id), () => {
    attempts += 1

    return attempts === 1
      ? HttpResponse.json(
          { error: { code: 'E_INTERNAL_SERVER_ERROR', message: 'Something went wrong' } },
          { status: 500 },
        )
      : HttpResponse.json({ data: updated })
  })
}

const warehouseDoorArchiveUrl = (id: string) => `${warehouseDoorsUrl}/${id}/archive`

/** The 200 body is the standalone door DTO plus the archive context the transition recorded. */
export function archiveWarehouseDoorHandler(archived: ArchivedWarehouseDoorDto) {
  return http.post(warehouseDoorArchiveUrl(archived.id), () =>
    HttpResponse.json({ data: archived }),
  )
}

export function archiveWarehouseDoorErrorHandler(
  id: string,
  error: { code: string; message: string },
  status: number,
) {
  return http.post(warehouseDoorArchiveUrl(id), () => HttpResponse.json({ error }, { status }))
}

export const archiveWarehouseDoorAlreadyArchivedHandler = (id: string) =>
  archiveWarehouseDoorErrorHandler(
    id,
    { code: 'E_WAREHOUSE_DOOR_ALREADY_ARCHIVED', message: 'Warehouse door is already archived' },
    409,
  )

export const archiveWarehouseDoorInUseHandler = (id: string) =>
  archiveWarehouseDoorErrorHandler(
    id,
    {
      code: 'E_WAREHOUSE_DOOR_IN_USE',
      message: 'Warehouse door is used by a planned or active discharge',
    },
    409,
  )

export const archiveWarehouseDoorNotFoundHandler = (id: string) =>
  archiveWarehouseDoorErrorHandler(
    id,
    { code: 'E_WAREHOUSE_DOOR_NOT_FOUND', message: 'Warehouse door not found' },
    404,
  )

export const archiveWarehouseDoorFailureHandler = (id: string, status = 500) =>
  archiveWarehouseDoorErrorHandler(
    id,
    { code: 'E_INTERNAL_SERVER_ERROR', message: 'Something went wrong' },
    status,
  )

/** Fails once, then succeeds — the retry-after-a-transient-failure path. */
export function archiveWarehouseDoorRecoveringHandler(archived: ArchivedWarehouseDoorDto) {
  let attempts = 0

  return http.post(warehouseDoorArchiveUrl(archived.id), () => {
    attempts += 1

    return attempts === 1
      ? HttpResponse.json(
          { error: { code: 'E_INTERNAL_SERVER_ERROR', message: 'Something went wrong' } },
          { status: 500 },
        )
      : HttpResponse.json({ data: archived })
  })
}

const reactivateWarehouseDoorUrl = (id: string) => `${warehouseDoorsUrl}/${id}/reactivate`

/** The 200 body is the standalone door DTO, now AVAILABLE. */
export function reactivateWarehouseDoorHandler(reactivated: ReactivatedWarehouseDoorDto) {
  return http.post(reactivateWarehouseDoorUrl(reactivated.id), () =>
    HttpResponse.json({ data: reactivated }),
  )
}

export function reactivateWarehouseDoorErrorHandler(
  id: string,
  error: { code: string; message: string; details?: Array<{ field: string; message: string }> },
  status: number,
) {
  return http.post(reactivateWarehouseDoorUrl(id), () => HttpResponse.json({ error }, { status }))
}

export const reactivateWarehouseDoorAlreadyAvailableHandler = (id: string) =>
  reactivateWarehouseDoorErrorHandler(
    id,
    {
      code: 'E_WAREHOUSE_DOOR_ALREADY_AVAILABLE',
      message: 'Warehouse door is already available',
    },
    409,
  )

export const reactivateWarehouseDoorArchivedWithWarehouseHandler = (id: string) =>
  reactivateWarehouseDoorErrorHandler(
    id,
    {
      code: 'E_WAREHOUSE_DOOR_ARCHIVED_WITH_WAREHOUSE',
      message:
        'This warehouse door was archived with its warehouse. Reactivate the warehouse and the door returns with it.',
    },
    409,
  )

export const reactivateWarehouseDoorNotFoundHandler = (id: string) =>
  reactivateWarehouseDoorErrorHandler(
    id,
    { code: 'E_WAREHOUSE_DOOR_NOT_FOUND', message: 'Warehouse door not found' },
    404,
  )

/** A 422's top-level message is only "Validation failure"; the field-level detail is the useful one. */
export const reactivateWarehouseDoorCommentTooLongHandler = (id: string) =>
  reactivateWarehouseDoorErrorHandler(
    id,
    {
      code: 'E_VALIDATION_ERROR',
      message: 'Validation failure',
      details: [
        { field: 'comment', message: 'The comment field must not be greater than 1000 characters' },
      ],
    },
    422,
  )

export const reactivateWarehouseDoorFailureHandler = (id: string, status = 500) =>
  reactivateWarehouseDoorErrorHandler(
    id,
    { code: 'E_INTERNAL_SERVER_ERROR', message: 'Something went wrong' },
    status,
  )

/** Fails once, then succeeds — the retry-after-a-transient-failure path. */
export function reactivateWarehouseDoorRecoveringHandler(reactivated: ReactivatedWarehouseDoorDto) {
  let attempts = 0

  return http.post(reactivateWarehouseDoorUrl(reactivated.id), () => {
    attempts += 1

    return attempts === 1
      ? HttpResponse.json(
          { error: { code: 'E_INTERNAL_SERVER_ERROR', message: 'Something went wrong' } },
          { status: 500 },
        )
      : HttpResponse.json({ data: reactivated })
  })
}
