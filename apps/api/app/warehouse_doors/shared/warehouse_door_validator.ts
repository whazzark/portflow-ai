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

/**
 * Every member is optional on its own, but the body must carry at least one, and the two
 * coordinates must travel together: a position is replaced as a whole, so a lone latitude is a
 * transport error rather than a half-move the use case would have to reason about.
 *
 * Deliberately stricter than `updateDockValidator`, which leaves its coordinates untied and so
 * accepts a latitude with no longitude.
 */
export const updateWarehouseDoorValidator = vine.create(
  vine.object({
    name: vine
      .string()
      .use(nonBlank())
      .minLength(1)
      .maxLength(255)
      .optional()
      .requiredWhen((field) => Object.hasOwn(field.parent, field.name))
      .requiredIfMissing(['latitude', 'longitude']),
    latitude: vine
      .number()
      .min(-90)
      .max(90)
      .optional()
      .requiredWhen((field) => Object.hasOwn(field.parent, field.name))
      .requiredIfExists('longitude'),
    longitude: vine
      .number()
      .min(-180)
      .max(180)
      .optional()
      .requiredWhen((field) => Object.hasOwn(field.parent, field.name))
      .requiredIfExists('latitude'),
  }),
)
