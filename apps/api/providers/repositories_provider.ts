import type { ApplicationService } from '@adonisjs/core/types'

import CustomerRepository from '#customers/shared/repositories/customer_repository'
import LucidCustomerRepository from '#customers/shared/repositories/lucid_customer_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import DischargeUsageRepository from '#discharges/shared/repositories/discharge_usage_repository'
import LucidDischargeRepository from '#discharges/shared/repositories/lucid_discharge_repository'
import LucidDischargeUsageRepository from '#discharges/shared/repositories/lucid_discharge_usage_repository'
import DockRepository from '#docks/shared/repositories/dock_repository'
import LucidDockRepository from '#docks/shared/repositories/lucid_dock_repository'
import PersistedSiteReferenceUsageChecker from '#site_references/shared/persisted_site_reference_usage_checker'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import LucidTransportCompanyRepository from '#transport_companies/shared/repositories/lucid_transport_company_repository'
import TransportCompanyRepository from '#transport_companies/shared/repositories/transport_company_repository'
import LucidTruckRepository from '#trucks/shared/repositories/lucid_truck_repository'
import TruckRepository from '#trucks/shared/repositories/truck_repository'
import ActivationLinkReissuer, {
  UnavailableActivationLinkReissuer,
} from '#users/shared/activation_link_reissuer'
import LucidUserRepository from '#users/shared/repositories/lucid_user_repository'
import UserRepository from '#users/shared/repositories/user_repository'
import LucidWarehouseDoorRepository from '#warehouse_doors/shared/repositories/lucid_warehouse_door_repository'
import WarehouseDoorRepository from '#warehouse_doors/shared/repositories/warehouse_door_repository'
import LucidWarehouseRepository from '#warehouses/shared/repositories/lucid_warehouse_repository'
import WarehouseRepository from '#warehouses/shared/repositories/warehouse_repository'
import LucidWeighingAreaRepository from '#weighing_areas/shared/repositories/lucid_weighing_area_repository'
import WeighingAreaRepository from '#weighing_areas/shared/repositories/weighing_area_repository'

export default class RepositoriesProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.bind(UserRepository, () => {
      return this.app.container.make(LucidUserRepository)
    })

    // Replacing a pending user's link needs the correction to hand the new secret back to the
    // administrator, which its contract does not carry yet. Until it does, the only implementation
    // reports the capability unavailable, which is what makes a pending user's email correction fail
    // closed instead of leaving the previous link usable.
    this.app.container.bind(ActivationLinkReissuer, () => {
      return this.app.container.make(UnavailableActivationLinkReissuer)
    })

    this.app.container.bind(CustomerRepository, () => {
      return this.app.container.make(LucidCustomerRepository)
    })

    this.app.container.bind(TransportCompanyRepository, () => {
      return this.app.container.make(LucidTransportCompanyRepository)
    })

    this.app.container.bind(TruckRepository, () => {
      return this.app.container.make(LucidTruckRepository)
    })

    this.app.container.bind(DischargeRepository, () => {
      return this.app.container.make(LucidDischargeRepository)
    })

    this.app.container.bind(DockRepository, () => {
      return this.app.container.make(LucidDockRepository)
    })

    this.app.container.bind(WeighingAreaRepository, () => {
      return this.app.container.make(LucidWeighingAreaRepository)
    })

    this.app.container.bind(WarehouseRepository, () => {
      return this.app.container.make(LucidWarehouseRepository)
    })

    this.app.container.bind(WarehouseDoorRepository, () => {
      return this.app.container.make(LucidWarehouseDoorRepository)
    })

    this.app.container.bind(SiteReferenceUsageChecker, () => {
      return this.app.container.make(PersistedSiteReferenceUsageChecker)
    })

    this.app.container.bind(DischargeUsageRepository, () => {
      return this.app.container.make(LucidDischargeUsageRepository)
    })
  }
}
