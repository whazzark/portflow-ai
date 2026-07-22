import { inject } from '@adonisjs/core'
import { DockNotFoundException } from '#docks/shared/dock_exceptions'
import DockRepository from '#docks/shared/repositories/dock_repository'

@inject()
export default class GetDockUseCase {
  constructor(private dockRepository: DockRepository) {}
  async handle(id: string) {
    const dock = await this.dockRepository.findById(id)
    if (!dock) {
      throw new DockNotFoundException()
    }
    return dock
  }
}
