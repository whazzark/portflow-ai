import { SearchIcon, XIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { classnames } from '@/libraries/shadcn/helpers'

type InputSearchProps = Omit<ComponentProps<typeof Input>, 'id' | 'onChange' | 'type'> & {
  fieldClassName?: string
  id: string
  label: string
  onValueChange: (value: string) => void
}

function InputSearch({
  className,
  fieldClassName,
  id,
  label,
  onValueChange,
  value,
  ...props
}: InputSearchProps) {
  const hasValue = typeof value === 'string' && value.length > 0

  return (
    <Field className={fieldClassName}>
      <FieldLabel className="sr-only" htmlFor={id}>
        {label}
      </FieldLabel>
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className={classnames('pl-9', hasValue && 'pr-9', className)}
          id={id}
          onChange={(event) => onValueChange(event.target.value)}
          type="text"
          value={value}
          {...props}
        />
        {hasValue && (
          <button
            aria-label={`Clear ${label.toLocaleLowerCase()} input`}
            className="absolute top-1/2 right-1 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onValueChange('')}
            type="button"
          >
            <XIcon aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
    </Field>
  )
}

export type { InputSearchProps }
export { InputSearch }
