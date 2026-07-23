import SiteReferenceUsageChecker, {
  type SiteReferenceUsageInput,
} from './site_reference_usage_checker.ts'

export default class PlannedOrActiveUsageChecker extends SiteReferenceUsageChecker {
  findUsedByPlannedOrActiveDischarge(input: SiteReferenceUsageInput) {
    return Promise.resolve(new Set(input.referenceIds))
  }
}
