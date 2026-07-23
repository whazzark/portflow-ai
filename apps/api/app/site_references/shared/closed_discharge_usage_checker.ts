import SiteReferenceUsageChecker, {
  type SiteReferenceUsageInput,
} from './site_reference_usage_checker.ts'

export default class ClosedDischargeUsageChecker extends SiteReferenceUsageChecker {
  findUsedByPlannedOrActiveDischarge(_input: SiteReferenceUsageInput) {
    return Promise.resolve(new Set<string>())
  }
}
