import { BaseSeeder } from '@adonisjs/lucid/seeders'

import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'
import WeighingArea from '#models/weighing_area'

type DemoWeighingArea = {
  name: string
  latitude: number
  longitude: number
}

// Port Atlantique La Rochelle operates two weighbridges for merchandise weighing.
// Coordinates are positioned on the commercial port / La Pallice site.
const DEMO_WEIGHING_AREAS: DemoWeighingArea[] = [
  {
    name: 'Pont-bascule Nord',
    latitude: 46.1602,
    longitude: -1.2378,
  },
  {
    name: 'Pont-bascule Sud',
    latitude: 46.1528,
    longitude: -1.231,
  },
]

export default class WeighingAreaSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    for (const demoWeighingArea of DEMO_WEIGHING_AREAS) {
      const existingWeighingArea = await WeighingArea.query()
        .whereRaw('LOWER(name) = ?', [demoWeighingArea.name.toLowerCase()])
        .first()

      if (existingWeighingArea) {
        continue
      }

      await WeighingAreaFactory.merge(demoWeighingArea).create()
    }
  }
}
