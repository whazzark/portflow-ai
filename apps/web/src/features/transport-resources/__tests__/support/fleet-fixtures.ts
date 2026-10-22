import type { TransportCompanyDto } from '@/features/transport-companies/types'
import type { TruckDto } from '@/features/trucks/types'

/**
 * The fleet drawn on the *Retenue* artboards of the design canvas, so a failing test reads like
 * the screen it is checking: three available companies, one archived, seven trucks in service or
 * suspended and one archived.
 */

const CLAIRE = { id: 'admin-claire', firstName: 'Claire', lastName: 'Martin' }
const THOMAS = { id: 'admin-thomas', firstName: 'Thomas', lastName: 'Bernard' }

export const ATLANTIC_ID = '00000000-0000-4000-8000-000000000a01'
export const BRETAGNE_ID = '00000000-0000-4000-8000-000000000a02'
export const LOIRE_ID = '00000000-0000-4000-8000-000000000a03'
export const MORVAN_ID = '00000000-0000-4000-8000-000000000a04'

function company(
  values: Pick<TransportCompanyDto, 'id' | 'name' | 'contactPhone' | 'contactEmail'> &
    Partial<TransportCompanyDto>,
): TransportCompanyDto {
  return {
    status: 'AVAILABLE',
    archivedAt: null,
    archivedByUserId: null,
    archivedBy: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivatedBy: null,
    reactivationComment: null,
    createdAt: '2026-02-04T10:30:00.000Z',
    updatedAt: '2026-09-10T15:02:00.000Z',
    ...values,
  }
}

export const FLEET_COMPANIES: TransportCompanyDto[] = [
  company({
    id: ATLANTIC_ID,
    name: 'Atlantic Transport',
    contactPhone: '+33 2 40 12 34 56',
    contactEmail: 'dispatch@atlantic-transport.example',
  }),
  company({
    id: BRETAGNE_ID,
    name: 'Bretagne Vrac',
    contactPhone: '+33 2 97 45 10 22',
    contactEmail: 'planning@bretagne-vrac.example',
  }),
  company({
    id: LOIRE_ID,
    name: 'Loire Logistique',
    contactPhone: '+33 2 41 88 03 17',
    contactEmail: 'exploitation@loire-logistique.example',
  }),
  company({
    id: MORVAN_ID,
    name: 'Transports Morvan',
    contactPhone: '+33 3 86 22 41 09',
    contactEmail: 'contact@transports-morvan.example',
    status: 'ARCHIVED',
    archivedAt: '2026-07-02T09:00:00.000Z',
    archivedByUserId: THOMAS.id,
    archivedBy: THOMAS,
    archiveComment: 'Company closed its bulk activity',
  }),
]

let truckSequence = 0

function truck(
  values: Pick<TruckDto, 'registration' | 'vehicleModel' | 'capacityTonnes' | 'transportCompanyId'> &
    Partial<TruckDto>,
): TruckDto {
  truckSequence += 1

  return {
    id: `00000000-0000-4000-8000-000000000b${String(truckSequence).padStart(2, '0')}`,
    status: 'AVAILABLE',
    archivedAt: null,
    archivedByUserId: null,
    archivedBy: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivatedBy: null,
    reactivationComment: null,
    suspendedAt: null,
    suspendedByUserId: null,
    suspendedBy: null,
    suspensionComment: null,
    returnedToServiceAt: null,
    returnedToServiceByUserId: null,
    returnedToServiceBy: null,
    returnToServiceComment: null,
    createdAt: '2026-03-12T10:05:00.000Z',
    updatedAt: '2026-03-12T10:05:00.000Z',
    ...values,
  }
}

export const AB_123_CD = truck({
  registration: 'AB-123-CD',
  vehicleModel: 'Volvo FMX',
  capacityTonnes: 32.5,
  transportCompanyId: ATLANTIC_ID,
})
export const CD_456_EF = truck({
  registration: 'CD-456-EF',
  vehicleModel: 'Scania R 450',
  capacityTonnes: 30,
  transportCompanyId: ATLANTIC_ID,
})
export const NP_901_QR = truck({
  registration: 'NP-901-QR',
  vehicleModel: 'Scania G 410',
  capacityTonnes: 27,
  transportCompanyId: ATLANTIC_ID,
  status: 'SUSPENDED',
  suspendedAt: '2026-09-23T08:15:00.000Z',
  suspendedByUserId: CLAIRE.id,
  suspendedBy: CLAIRE,
  suspensionComment: 'Tyre replacement, back on Friday',
})
export const JK_345_LM = truck({
  registration: 'JK-345-LM',
  vehicleModel: 'DAF XF',
  capacityTonnes: 28.5,
  transportCompanyId: BRETAGNE_ID,
})
export const LM_678_NP = truck({
  registration: 'LM-678-NP',
  vehicleModel: 'Volvo FH',
  capacityTonnes: 32,
  transportCompanyId: BRETAGNE_ID,
})
export const EF_789_GH = truck({
  registration: 'EF-789-GH',
  vehicleModel: 'Renault T 480',
  capacityTonnes: 29,
  transportCompanyId: LOIRE_ID,
})
export const GH_012_JK = truck({
  registration: 'GH-012-JK',
  vehicleModel: 'MAN TGX',
  capacityTonnes: 31,
  transportCompanyId: LOIRE_ID,
  status: 'SUSPENDED',
  suspendedAt: '2026-09-22T07:48:00.000Z',
  suspendedByUserId: THOMAS.id,
  suspendedBy: THOMAS,
  suspensionComment: 'Brake inspection after a warning light',
  returnedToServiceAt: '2026-06-14T15:20:00.000Z',
  returnedToServiceByUserId: CLAIRE.id,
  returnedToServiceBy: CLAIRE,
  returnToServiceComment: 'Gearbox repaired',
  updatedAt: '2026-09-22T07:48:00.000Z',
})
export const QR_234_ST = truck({
  registration: 'QR-234-ST',
  vehicleModel: 'Iveco S-Way',
  capacityTonnes: 30,
  transportCompanyId: MORVAN_ID,
  status: 'ARCHIVED',
  archivedAt: '2026-07-01T16:40:00.000Z',
  archivedByUserId: THOMAS.id,
  archivedBy: THOMAS,
  archiveComment: 'Sold',
})

export const FLEET_TRUCKS: TruckDto[] = [
  AB_123_CD,
  CD_456_EF,
  NP_901_QR,
  JK_345_LM,
  LM_678_NP,
  EF_789_GH,
  GH_012_JK,
  QR_234_ST,
]

/** What `GET /trucks/available` and `GET /trucks/suspended` return: no lifecycle actors. */
export function withoutActors(trucks: TruckDto[]) {
  return trucks.map(
    ({ archivedBy, reactivatedBy, suspendedBy, returnedToServiceBy, ...rest }) => rest,
  )
}
