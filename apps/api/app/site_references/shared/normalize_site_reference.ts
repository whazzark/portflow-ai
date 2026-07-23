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

export const assertLegalSiteReferenceLatitude = (latitude: number) => {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new InvalidSiteReferenceCoordinatesException()
  }
}

export const assertLegalSiteReferenceLongitude = (longitude: number) => {
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new InvalidSiteReferenceCoordinatesException()
  }
}
