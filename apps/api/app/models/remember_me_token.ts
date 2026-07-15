import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class RememberMeToken extends BaseModel {
  static table = 'remember_me_tokens'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tokenableId: string

  @column({ serializeAs: null })
  declare hash: string

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
