import { type ReactNode, useId } from 'react'

import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type DetailSectionProps = {
  title: string
  children: ReactNode
  /** Actions on the whole section, placed in the header beside its title. */
  actions?: ReactNode
  /** Makes the section a target that can receive focus, for a link elsewhere on the page. */
  id?: string
}

/** One card of the discharge page, a region named by its own heading. */
export function DetailSection({ title, children, actions, id }: DetailSectionProps) {
  const titleId = useId()

  return (
    <Card
      aria-labelledby={titleId}
      className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
      id={id}
      role="region"
      tabIndex={id ? -1 : undefined}
    >
      <CardHeader>
        <CardTitle aria-level={2} className="text-base" id={titleId} role="heading">
          {title}
        </CardTitle>
        {actions && <CardAction>{actions}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
