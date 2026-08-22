import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transport_companies'

  async up() {
    this.defer(async (db) => {
      const rows = await db.from(this.tableName).select('name')
      const seenNames = new Set<string>()
      const hasDuplicate = rows.some((row) => {
        const normalizedName = String(row.name).toLowerCase()
        if (seenNames.has(normalizedName)) {
          return true
        }
        seenNames.add(normalizedName)
        return false
      })

      if (hasDuplicate) {
        throw new Error(
          'Cannot create a case-insensitive unique index on transport_companies.name: ' +
            'duplicate names already exist. Resolve the duplicates before running this migration.',
        )
      }

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
