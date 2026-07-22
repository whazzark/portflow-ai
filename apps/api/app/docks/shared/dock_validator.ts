import vine from '@vinejs/vine'

export const createDockValidator = vine.create({
  name: vine.string().minLength(1).maxLength(255),
  latitude: vine.number().min(-90).max(90),
  longitude: vine.number().min(-180).max(180),
})

export const updateDockValidator = vine.create(
  vine.object({
    name: vine
      .string()
      .minLength(1)
      .maxLength(255)
      .optional()
      .requiredIfMissing(['latitude', 'longitude']),
    latitude: vine.number().min(-90).max(90).optional(),
    longitude: vine.number().min(-180).max(180).optional(),
  }),
)

export const archiveDockValidator = vine.create({
  comment: vine.string().nullable().optional(),
})

export const reactivateDockValidator = vine.create({
  comment: vine.string().nullable().optional(),
})
