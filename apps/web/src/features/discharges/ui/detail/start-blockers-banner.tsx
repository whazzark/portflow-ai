import { TriangleAlertIcon } from 'lucide-react'

import { Alert, AlertAction, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type StartBlockersBannerProps = {
  /** How many problems the start check reports; the banner is not shown without one. */
  count: number
  /** Opens the start confirmation, which lists each problem where it is fixed. */
  onReview: () => void
}

/**
 * Whether a planned discharge can start, said before anyone tries: how many problems the start
 * check reports. A status rather than an alert, since it describes the plan on arrival and does not
 * interrupt; the warning tone stays on the icon and the border, and the words carry the meaning.
 */
export function StartBlockersBanner({ count, onReview }: StartBlockersBannerProps) {
  return (
    <Alert className="border-warning/60" role="status">
      <TriangleAlertIcon aria-hidden="true" className="text-warning" />
      <AlertTitle>
        {count === 1 ? '1 problem blocks the start' : `${count} problems block the start`}
      </AlertTitle>
      <AlertAction>
        <Button onClick={onReview} size="sm" type="button" variant="outline">
          Review
        </Button>
      </AlertAction>
    </Alert>
  )
}
