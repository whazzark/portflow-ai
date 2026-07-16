import { classnames } from '@/libraries/shadcn/helpers'
import { useTheme } from '@/libraries/theme/use-theme'

type BrandProps = {
  className?: string
  tone?: 'auto' | 'inverse'
  variant?: 'full' | 'mark'
}

const logoSources = {
  full: {
    dark: '/logo-full-dark.png',
    light: '/logo-full-light.png',
  },
  mark: {
    dark: '/logo-dark.png',
    light: '/logo-light.png',
  },
}

export function Brand({ className, tone = 'auto', variant = 'full' }: BrandProps) {
  const { theme } = useTheme()

  const isMarkOnly = variant === 'mark'
  const logoTheme = tone === 'inverse' ? (theme === 'dark' ? 'light' : 'dark') : theme
  const source = logoSources[variant][logoTheme]

  return (
    <img
      src={source}
      alt={isMarkOnly ? 'Portflow' : 'Portflow — Steer. Coordinate. Advance.'}
      className={classnames(isMarkOnly ? 'size-8 shrink-0' : 'h-auto w-40', className)}
    />
  )
}
