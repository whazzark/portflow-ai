import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { Moon, Sun } from 'lucide-react'
import { useId } from 'react'
import type { Theme } from '@/libraries/theme/theme-provider'
import { useTheme } from '@/libraries/theme/use-theme'

const APPEARANCES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

/**
 * The appearance switch of the user menu: a row of two menu radio items rather than a toggle, so
 * each theme is named and reachable with the menu's own arrow keys. It must render inside a
 * `DropdownMenu`, whose radio group it borrows; choosing a theme keeps the menu open.
 */
function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const labelId = useId()

  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1.5 text-sm">
      <span id={labelId}>Appearance</span>
      <MenuPrimitive.RadioGroup
        aria-labelledby={labelId}
        value={theme}
        onValueChange={(value: Theme) => setTheme(value)}
        className="flex gap-0.5 rounded-md border bg-background p-0.5"
      >
        {APPEARANCES.map(({ value, label, icon: Icon }) => (
          <MenuPrimitive.RadioItem
            key={value}
            value={value}
            closeOnClick={false}
            aria-label={label}
            className="flex h-7 w-8.5 cursor-default items-center justify-center rounded-sm text-muted-foreground outline-hidden transition-colors data-checked:bg-accent data-checked:text-foreground data-highlighted:text-foreground data-highlighted:ring-1 data-highlighted:ring-ring [&_svg]:size-4"
          >
            <Icon aria-hidden={true} />
          </MenuPrimitive.RadioItem>
        ))}
      </MenuPrimitive.RadioGroup>
    </div>
  )
}

export { ThemeToggle }
