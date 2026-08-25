import vine from '@vinejs/vine'
import { lifecycleComment, lifecycleIds, nonBlank } from '#shared/validators/lifecycle_validator'

export const createWeighingAreaValidator = vine.create({
  name: vine.string().use(nonBlank()).minLength(1).maxLength(255),
  latitude: vine.number().min(-90).max(90),
  longitude: vine.number().min(-180).max(180),
})

export const updateWeighingAreaValidator = vine.create(
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
      .requiredWhen((field) => Object.hasOwn(field.parent, field.name)),
    longitude: vine
      .number()
      .min(-180)
      .max(180)
      .optional()
      .requiredWhen((field) => Object.hasOwn(field.parent, field.name)),
  }),
)

export const archiveWeighingAreaValidator = vine.create({
  comment: lifecycleComment(),
})

export const archiveWeighingAreasValidator = vine.create({
  ids: lifecycleIds(),
  comment: lifecycleComment(),
})

export const reactivateWeighingAreaValidator = vine.create({
  comment: vine.string().nullable().optional(),
})
