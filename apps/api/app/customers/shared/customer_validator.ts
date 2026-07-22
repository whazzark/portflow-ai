import vine from '@vinejs/vine'

export const createCustomerValidator = vine.create({
  code: vine.string().trim().minLength(1).maxLength(255),
  companyName: vine.string().trim().minLength(1).maxLength(255),
})

export const updateCustomerValidator = vine.create({
  code: vine.string().trim().minLength(1).maxLength(255).optional(),
  companyName: vine.string().trim().minLength(1).maxLength(255).optional(),
})
