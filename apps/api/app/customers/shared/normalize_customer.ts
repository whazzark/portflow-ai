import { InvalidSiteReferenceCodeException } from '#site_references/shared/site_reference_exceptions'

export const normalizeCustomerCode = (code: string) => code.trim().toUpperCase()

export const assertValidCustomerCode = (code: string) => {
  const normalizedCode = normalizeCustomerCode(code)

  if (!normalizedCode || normalizedCode.length > 255) {
    throw new InvalidSiteReferenceCodeException()
  }

  return normalizedCode
}
