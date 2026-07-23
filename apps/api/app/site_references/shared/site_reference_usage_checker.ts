export const SITE_REFERENCE_TYPES = ['CUSTOMER', 'DOCK', 'WEIGHING_AREA'] as const
export type SiteReferenceType = (typeof SITE_REFERENCE_TYPES)[number]

export type SiteReferenceUsageInput = {
  referenceType: SiteReferenceType
  referenceId: string
}

export default abstract class SiteReferenceUsageChecker {
  abstract isUsedByPlannedOrActiveDischarge(input: SiteReferenceUsageInput): Promise<boolean>
}
