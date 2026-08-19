import type { SiteReferenceUsageInput } from '#site_references/shared/site_reference_usage_checker'

export default abstract class DischargeUsageRepository {
  abstract findUsedByPlannedOrActiveDischarge(input: SiteReferenceUsageInput): Promise<Set<string>>
}
