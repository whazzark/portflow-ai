import vine from '@vinejs/vine'

export const createCustomerValidator = vine.create({
  code: vine.string().trim().minLength(1).maxLength(255),
  companyName: vine.string().trim().minLength(1).maxLength(255),
})

export const updateCustomerValidator = vine.create(
  vine.object({
    code: vine.string().minLength(1).maxLength(255).optional().requiredIfMissing('companyName'),
    companyName: vine.string().minLength(1).maxLength(255).optional(),
  }),
)

export const archiveCustomerValidator = vine.create({
  comment: vine.string().nullable().optional(),
})

export const reactivateCustomerValidator = vine.create({
  comment: vine.string().nullable().optional(),
})
