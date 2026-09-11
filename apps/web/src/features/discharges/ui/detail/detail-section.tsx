import { type ReactNode, useId } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type DetailSectionProps = {
  title: string
  children: ReactNode
}

/** One card of the discharge page, a region named by its own heading. */
export function DetailSection({ title, children }: DetailSectionProps) {
  const titleId = useId()

  return (
    <Card aria-labelledby={titleId} role="region">
      <CardHeader>
        <CardTitle aria-level={2} className="text-base" id={titleId} role="heading">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
