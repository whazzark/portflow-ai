import vine from '@vinejs/vine'

/** The dock whose occupancy is read, named in the query string. */
export const dockOccupancyValidator = vine.create({
  dockId: vine.string().uuid(),
})
