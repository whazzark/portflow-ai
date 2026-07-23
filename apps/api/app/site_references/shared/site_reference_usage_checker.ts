export const SITE_REFERENCE_TYPES = ['CUSTOMER', 'DOCK', 'WEIGHING_AREA'] as const
export type SiteReferenceType = (typeof SITE_REFERENCE_TYPES)[number]

export type SiteReferenceUsageInput = {
  referenceType: SiteReferenceType
  referenceIds: readonly string[]
}

export default abstract class SiteReferenceUsageChecker {
  abstract findUsedByPlannedOrActiveDischarge(input: SiteReferenceUsageInput): Promise<Set<string>>
}
