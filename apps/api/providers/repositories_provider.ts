import type { ApplicationService } from '@adonisjs/core/types'

import CustomerRepository from '#customers/shared/repositories/customer_repository'
import LucidCustomerRepository from '#customers/shared/repositories/lucid_customer_repository'
import DockRepository from '#docks/shared/repositories/dock_repository'
import LucidDockRepository from '#docks/shared/repositories/lucid_dock_repository'
import NoDischargeSiteReferenceUsageChecker from '#site_references/shared/no_discharge_site_reference_usage_checker'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import LucidUserRepository from '#users/shared/repositories/lucid_user_repository'
import UserRepository from '#users/shared/repositories/user_repository'
import LucidWeighingAreaRepository from '#weighing_areas/shared/repositories/lucid_weighing_area_repository'
import WeighingAreaRepository from '#weighing_areas/shared/repositories/weighing_area_repository'

export default class RepositoriesProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.bind(UserRepository, () => {
      return this.app.container.make(LucidUserRepository)
    })

    this.app.container.bind(CustomerRepository, () => {
      return this.app.container.make(LucidCustomerRepository)
    })

    this.app.container.bind(DockRepository, () => {
      return this.app.container.make(LucidDockRepository)
    })

    this.app.container.bind(WeighingAreaRepository, () => {
      return this.app.container.make(LucidWeighingAreaRepository)
    })

    this.app.container.bind(SiteReferenceUsageChecker, () => {
      return this.app.container.make(NoDischargeSiteReferenceUsageChecker)
    })
  }
}
