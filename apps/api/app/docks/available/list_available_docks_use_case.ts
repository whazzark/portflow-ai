import { inject } from '@adonisjs/core'
import DockRepository from '#docks/shared/repositories/dock_repository'

@inject()
export default class ListAvailableDocksUseCase {
  constructor(private dockRepository: DockRepository) {}

  handle() {
    return this.dockRepository.listAvailable()
  }
}
