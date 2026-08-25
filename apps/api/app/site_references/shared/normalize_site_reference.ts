import {
  InvalidSiteReferenceCoordinatesException,
  InvalidSiteReferenceNameException,
} from './site_reference_exceptions.ts'

export const MAX_SITE_REFERENCE_NAME_LENGTH = 255

export const normalizeSiteReferenceName = (name: string) => name.trim()

export const assertValidSiteReferenceName = (name: string) => {
  const normalizedName = normalizeSiteReferenceName(name)

  if (!normalizedName || normalizedName.length > MAX_SITE_REFERENCE_NAME_LENGTH) {
    throw new InvalidSiteReferenceNameException()
  }

  return normalizedName
}

/** The coordinate rules are also exposed as predicates so a slice with its own error vocabulary can
 * reuse the rule without inheriting the site-reference exceptions. */
export const isLegalSiteReferenceLatitude = (latitude: number) =>
  Number.isFinite(latitude) && latitude >= -90 && latitude <= 90

export const isLegalSiteReferenceLongitude = (longitude: number) =>
  Number.isFinite(longitude) && longitude >= -180 && longitude <= 180

export const assertLegalSiteReferenceLatitude = (latitude: number) => {
  if (!isLegalSiteReferenceLatitude(latitude)) {
    throw new InvalidSiteReferenceCoordinatesException()
  }
}

export const assertLegalSiteReferenceLongitude = (longitude: number) => {
  if (!isLegalSiteReferenceLongitude(longitude)) {
    throw new InvalidSiteReferenceCoordinatesException()
  }
}
