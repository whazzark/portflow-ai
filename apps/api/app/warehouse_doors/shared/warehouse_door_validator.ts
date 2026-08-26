import vine from '@vinejs/vine'
import { nonBlank } from '#shared/validators/lifecycle_validator'

/**
 * `warehouseId` is deliberately *not* constrained to a UUID here. An identifier that cannot name a
 * row — malformed or merely absent — is one outcome for the client, and the repository's `isUuid`
 * guard turns both into `E_WAREHOUSE_NOT_FOUND` rather than splitting them across a validation
 * error and a 404 the client would have to map separately.
 */
export const createWarehouseDoorValidator = vine.create({
  warehouseId: vine.string().use(nonBlank()),
  name: vine.string().use(nonBlank()).minLength(1).maxLength(255),
  latitude: vine.number().min(-90).max(90),
  longitude: vine.number().min(-180).max(180),
})
