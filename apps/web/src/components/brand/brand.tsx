import { classnames } from '@/libraries/shadcn/helpers'

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

/**
 * Both themes' assets are rendered and the `dark` class on the document picks one, like the guest
 * background does. Choosing the source from the theme in React would not survive hydration: the
 * server renders the default theme, and React keeps that `src` when the stored theme differs.
 */
export function Brand({ className, tone = 'auto', variant = 'full' }: BrandProps) {
  const isMarkOnly = variant === 'mark'
  const sources = logoSources[variant]
  const lightThemeSource = tone === 'inverse' ? sources.dark : sources.light
  const darkThemeSource = tone === 'inverse' ? sources.light : sources.dark
  const imageClassName = isMarkOnly ? 'size-full object-contain' : 'h-auto w-full'

  return (
    <span
      role="img"
      aria-label={isMarkOnly ? 'Portflow' : 'Portflow — Steer. Coordinate. Advance.'}
      className={classnames('block', isMarkOnly ? 'size-8 shrink-0' : 'w-40', className)}
    >
      <img
        src={lightThemeSource}
        alt=""
        data-theme-asset="light"
        className={classnames(imageClassName, 'dark:hidden')}
      />
      <img
        src={darkThemeSource}
        alt=""
        data-theme-asset="dark"
        className={classnames(imageClassName, 'hidden dark:block')}
      />
    </span>
  )
}
