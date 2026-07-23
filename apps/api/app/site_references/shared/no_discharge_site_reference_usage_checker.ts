import SiteReferenceUsageChecker, {
  type SiteReferenceUsageInput,
} from '#site_references/shared/site_reference_usage_checker'

/**
 * Transitional adapter for deployments that cannot persist Discharges yet.
 *
 * Issue #53 must replace this production binding with a persistence-backed
 * checker when Customer and Dock usage becomes durable. Issue #54 must extend
 * that checker before Weighing Area assignments can be persisted.
 */
export default class NoDischargeSiteReferenceUsageChecker extends SiteReferenceUsageChecker {
  isUsedByPlannedOrActiveDischarge(_input: SiteReferenceUsageInput): Promise<boolean> {
    return Promise.resolve(false)
  }
}
