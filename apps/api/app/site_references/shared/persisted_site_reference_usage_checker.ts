import { inject } from '@adonisjs/core'
import DischargeUsageRepository from '#discharges/shared/repositories/discharge_usage_repository'
import SiteReferenceUsageChecker, {
  type SiteReferenceUsageInput,
} from '#site_references/shared/site_reference_usage_checker'

@inject()
export default class PersistedSiteReferenceUsageChecker extends SiteReferenceUsageChecker {
  constructor(private readonly repository: DischargeUsageRepository) {
    super()
  }

  findUsedByPlannedOrActiveDischarge(input: SiteReferenceUsageInput) {
    return this.repository.findUsedByPlannedOrActiveDischarge(input)
  }
}
