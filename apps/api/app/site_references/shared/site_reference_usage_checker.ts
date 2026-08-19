import type { QueryClientContract } from '@adonisjs/lucid/types/database'

export const SITE_REFERENCE_TYPES = ['CUSTOMER', 'DOCK', 'WEIGHING_AREA', 'WAREHOUSE_DOOR'] as const
export type SiteReferenceType = (typeof SITE_REFERENCE_TYPES)[number]

export type SiteReferenceUsageInput = {
  referenceType: SiteReferenceType
  referenceIds: readonly string[]
  client?: QueryClientContract
}

export default abstract class SiteReferenceUsageChecker {
  abstract findUsedByPlannedOrActiveDischarge(input: SiteReferenceUsageInput): Promise<Set<string>>
}
