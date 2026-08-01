import { BaseSeeder } from '@adonisjs/lucid/seeders'

import { DockFactory } from '#database/factories/dock_factory'
import Dock, { type DockStatus } from '#models/dock'

type DemoDock = {
  name: string
  latitude: number
  longitude: number
  status?: DockStatus
}

const DEMO_DOCKS: DemoDock[] = [
  { name: "Môle d'Escale Ouest", latitude: 46.16088, longitude: -1.23972 },
  { name: "Môle d'Escale Est", latitude: 46.16052, longitude: -1.23565 },
  { name: 'Anse Saint-Marc 1', latitude: 46.15589, longitude: -1.23648 },
  { name: 'Anse Saint-Marc 2', latitude: 46.15431, longitude: -1.23318 },
  { name: 'Chef de Baie 1', latitude: 46.15163, longitude: -1.22958 },
  { name: 'Chef de Baie 2', latitude: 46.14983, longitude: -1.22664 },
  {
    name: 'Chef de Baie 3',
    latitude: 46.14868,
    longitude: -1.22383,
    status: 'ARCHIVED',
  },
  { name: 'Quai Lombard Nord', latitude: 46.16232, longitude: -1.22537 },
  {
    name: 'Quai Lombard Sud',
    latitude: 46.16078,
    longitude: -1.22284,
    status: 'ARCHIVED',
  },
  { name: 'Appontement pétrolier AP00', latitude: 46.15669, longitude: -1.24291 },
  { name: 'Bassin à flot 1', latitude: 46.15865, longitude: -1.2189 },
  { name: 'Bassin à flot 2', latitude: 46.15747, longitude: -1.21678 },
]

export default class DockSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    for (const demoDock of DEMO_DOCKS) {
      const existingDock = await Dock.query()
        .whereRaw('LOWER(name) = ?', [demoDock.name.toLowerCase()])
        .first()

      if (existingDock) {
        continue
      }

      if (demoDock.status === 'ARCHIVED') {
        await DockFactory.apply('archived').merge(demoDock).create()
        continue
      }

      await DockFactory.merge(demoDock).create()
    }
  }
}
