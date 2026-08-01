/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_MAP_STYLE_DARK_URL?: string
  readonly VITE_MAP_STYLE_LIGHT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
