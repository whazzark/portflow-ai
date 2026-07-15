import vine from '@vinejs/vine'

export const loginValidator = vine.create({
  email: vine.string().trim().email(),
  password: vine.string().minLength(1),
  rememberMe: vine.boolean().optional(),
})
