import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme } from '@/libraries/theme/use-theme'

function ThemeToggle() {
  const { isMobile, state } = useSidebar()
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  const currentThemeLabel = isDark ? 'Dark' : 'Light'
  const nextThemeLabel = isDark ? 'light' : 'dark'

  function toggleTheme() {
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            role="switch"
            aria-checked={isDark}
            aria-label={`Switch to ${nextThemeLabel} theme`}
            onClick={toggleTheme}
            className="h-10 w-full justify-start gap-2 rounded-lg px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2!"
          />
        }
      >
        {isDark ? <Moon /> : <Sun />}
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
          <span>Appearance</span>
          <span className="text-sidebar-foreground/65 text-xs">{currentThemeLabel}</span>
        </span>
        <span
          aria-hidden="true"
          className="relative ml-auto h-5 w-9 shrink-0 rounded-full bg-sidebar-accent p-0.5 transition-colors group-data-[collapsible=icon]:hidden"
        >
          <span
            className={`block size-4 rounded-full bg-sidebar-primary shadow-sm transition-transform motion-reduce:transition-none ${isDark ? 'translate-x-4' : 'translate-x-0'}`}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" hidden={state !== 'collapsed' || isMobile}>
        {`Switch to ${nextThemeLabel} theme`}
      </TooltipContent>
    </Tooltip>
  )
}

export { ThemeToggle }
