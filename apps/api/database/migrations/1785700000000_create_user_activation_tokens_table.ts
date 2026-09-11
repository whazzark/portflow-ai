import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The confidential activation link of a pending user, stored as a digest.
 *
 * A table of its own rather than two columns on `users`, for three reasons: it keeps a
 * credential-bearing secret off the row every read path loads and transforms, it mirrors
 * `remember_me_tokens` — the shape this codebase already uses for exactly that — and it gives the
 * invitation lifecycle slices one row to replace or delete instead of columns to blank in the
 * middle of a user record.
 *
 * `user_id` is unique because a pending user holds **one** live activation link: renewing or
 * restoring an invitation replaces the row. `hash` is unique because a collision would let one
 * secret open two invitations, and it is also the index the acceptance slice looks a presented
 * secret up by.
 *
 * The secret itself is never stored — only its SHA-256 digest — which is what makes "shown exactly
 * once" a property of the schema rather than a discipline.
 */
export default class extends BaseSchema {
  protected tableName = 'user_activation_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()

      table
        .uuid('user_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('hash').notNullable().unique()
      table.timestamp('expires_at').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
