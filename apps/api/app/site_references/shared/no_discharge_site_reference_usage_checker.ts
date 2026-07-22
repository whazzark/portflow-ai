import SiteReferenceUsageChecker, {
  type SiteReferenceUsageInput,
} from '#site_references/shared/site_reference_usage_checker'

export default class NoDischargeSiteReferenceUsageChecker extends SiteReferenceUsageChecker {
  isUsedByPlannedOrActiveDischarge(_input: SiteReferenceUsageInput): Promise<boolean> {
    return Promise.resolve(false)
  }
}
