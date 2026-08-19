import { DischargeFactory } from '#database/factories/discharge_factory'
import { DockFactory } from '#database/factories/dock_factory'
import type { DischargeStatus } from '#models/discharge'

export async function createPersistedDockUsageScenario({
  status = 'PLANNED' as DischargeStatus,
}: {
  status?: DischargeStatus
} = {}) {
  const dock = await DockFactory.create()
  const discharge = await DischargeFactory.merge({ dockId: dock.id, status }).create()

  return { dock, discharge }
}
