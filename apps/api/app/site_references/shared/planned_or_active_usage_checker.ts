import SiteReferenceUsageChecker, {
  type SiteReferenceUsageInput,
} from './site_reference_usage_checker.ts'

export default class PlannedOrActiveUsageChecker extends SiteReferenceUsageChecker {
  isUsedByPlannedOrActiveDischarge(_input: SiteReferenceUsageInput) {
    return Promise.resolve(true)
  }
}
