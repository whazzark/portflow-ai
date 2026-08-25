import vine from '@vinejs/vine'
import { lifecycleComment, lifecycleIds, nonBlank } from '#shared/validators/lifecycle_validator'

/** The upper bound is a payload guard rather than a product limit: real footprints are a handful to
 * a few dozen vertices (`research.md` R2). */
export const MAX_FOOTPRINT_POINTS = 500

export const createWarehouseValidator = vine.create({
  name: vine.string().use(nonBlank()).minLength(1).maxLength(255),
  footprint: vine.object({
    points: vine
      .array(
        vine.object({
          latitude: vine.number().min(-90).max(90),
          longitude: vine.number().min(-180).max(180),
        }),
      )
      .minLength(3)
      .maxLength(MAX_FOOTPRINT_POINTS),
  }),
})

export const archiveWarehouseValidator = vine.create({
  comment: lifecycleComment(),
})

export const archiveWarehousesValidator = vine.create({
  ids: lifecycleIds(),
  comment: lifecycleComment(),
})

export const reactivateWarehouseValidator = vine.create({
  comment: lifecycleComment(),
})

export const reactivateWarehousesValidator = vine.create({
  ids: lifecycleIds(),
  comment: lifecycleComment(),
})
