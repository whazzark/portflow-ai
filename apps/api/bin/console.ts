import 'reflect-metadata'

import { Ignitor, prettyPrintError } from '@adonisjs/core'

const APP_ROOT = new URL('../', import.meta.url)

new Ignitor(APP_ROOT, { importer: (file) => import(file) })
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env')
    })
  })
  .ace()
  .handle(process.argv.splice(2))
  .catch((error) => {
    process.exitCode = 1
    void prettyPrintError(error)
  })
