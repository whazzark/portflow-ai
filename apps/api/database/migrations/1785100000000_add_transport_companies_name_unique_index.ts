import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transport_companies'

  async up() {
    this.defer(async (db) => {
      await db.rawQuery(
        'CREATE UNIQUE INDEX transport_companies_name_unique ON transport_companies (LOWER(name))',
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery('DROP INDEX transport_companies_name_unique')
    })
  }
}
