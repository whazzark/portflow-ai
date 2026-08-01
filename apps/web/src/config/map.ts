import { z } from 'zod'

const styleUrlSchema = z.url()

function readStyleUrl(value: string | undefined) {
  const result = styleUrlSchema.safeParse(value)
  return result.success ? result.data : undefined
}

export const mapStyleUrls = {
  light: readStyleUrl(import.meta.env.VITE_MAP_STYLE_LIGHT_URL),
  dark: readStyleUrl(import.meta.env.VITE_MAP_STYLE_DARK_URL),
}

export const hasConfiguredMapStyles = Boolean(mapStyleUrls.light && mapStyleUrls.dark)
