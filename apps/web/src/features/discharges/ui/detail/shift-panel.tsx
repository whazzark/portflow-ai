import { useState } from 'react'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { ShiftDetails } from '@/features/discharges/ui/detail/shift-details'
import { ShiftEditPanel } from '@/features/discharges/ui/detail/shift-edit-panel'
import { useIsMobile } from '@/hooks/use-mobile'

type Shift = DischargeDetailDto['shifts'][number]

type ShiftPanelProps = {
  discharge: DischargeDetailDto
  /** The shift the address opens; the panel is closed without one. */
  shift: Shift | undefined
  canCorrect: boolean
  onClose: () => void
}

/**
 * The open shift, over the calendar. Modal: a click outside closes it, as the close button does, and
 * another shift is chosen once it is closed.
 */
export function ShiftPanel({ canCorrect, discharge, onClose, shift }: ShiftPanelProps) {
  const isMobile = useIsMobile()

  return (
    <Sheet onOpenChange={(open) => !open && onClose()} open={Boolean(shift)}>
      <SheetContent
        className="gap-0 data-[side=bottom]:h-[min(75dvh,38rem)]"
        side={isMobile ? 'bottom' : 'right'}
        size="lg"
      >
        {/* Keyed by shift, so another shift the address opens starts on its own details, never on
            an edit left unfinished. */}
        {shift && (
          <ShiftPanelContent
            canCorrect={canCorrect}
            discharge={discharge}
            key={shift.id}
            shift={shift}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function ShiftPanelContent({
  canCorrect,
  discharge,
  shift,
}: {
  canCorrect: boolean
  discharge: DischargeDetailDto
  shift: Shift
}) {
  // Not in the address, as corrections never are (GH-53): a reload returns to the details.
  const [view, setView] = useState<'details' | 'edit'>('details')

  // A discharge started or a shift no longer planned since leaves nothing to correct.
  if (view === 'edit' && canCorrect && shift.status === 'PLANNED') {
    return <ShiftEditPanel discharge={discharge} onBack={() => setView('details')} shift={shift} />
  }

  return (
    <ShiftDetails
      canCorrect={canCorrect}
      discharge={discharge}
      onEdit={() => setView('edit')}
      shift={shift}
    />
  )
}
