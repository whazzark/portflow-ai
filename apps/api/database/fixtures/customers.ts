import {
  availableLifecycle,
  FIXTURE_REFERENCE_DATE,
  fixtureUuid,
  type LifecycleFactoryState,
} from './shared.js'
import { USER_FIXTURE_IDS } from './users.js'

const values = [
  ['ATL-CER', 'Atlantique Céréales'],
  [
    'ARM-FROID',
    'Armor Chaîne du Froid',
    'reactivated',
    75,
    'Reprise des escales saisonnières après renouvellement du contrat',
  ],
  ['BOR-SHP', 'Boréal Shipping France'],
  [
    'BAL-ECO',
    'Baltic Eco Fuels',
    'reactivated',
    142,
    "Réouverture du compte à la suite de la reprise des flux d'importation",
  ],
  ['CAP-HOR', 'Cap Horizon Logistique'],
  ['CER-AGR', 'Cérès Agro Négoce'],
  ['DEL-MIN', 'Delta Minéraux'],
  ['EST-TRN', 'Estuaire Transit'],
  ['FLA-CTR', 'Flandres Conteneurs'],
  ['GOF-FRT', 'Grand Ouest Fret'],
  ['HEL-MAR', 'Helios Marine Services'],
  ['IBE-BLK', 'Iberia Bulk Trading'],
  ['KER-MAN', 'Kermor Manutention'],
  ['LOI-ACI', 'Loire Acier Distribution'],
  ['MAG-PHO', 'Maghreb Phosphates Europe'],
  ['NOR-AFF', 'Noroît Affrètement'],
  ['OCE-REC', 'Océane Recyclage Industriel'],
  ['PEN-BOIS', 'Péninsule Bois & Papiers'],
  ['QSE-ENE', 'Quai Sud Énergies'],
  ['RML-FR', 'Rhône Maritime Logistics'],
  ['SIL-TMM', 'Sillage Transport Multimodal'],
  ['TER-ENG', 'TerraNova Engrais'],
  ['UMP-NAV', 'Union Maritime du Ponant'],
  ['VAL-PP', 'Valmer Produits Pétroliers'],
  ['WIN-PC', 'Windward Project Cargo'],
  ['ZEP-CS', 'Zéphyr Coastal Shipping'],
  [
    'CVN-001',
    'Comptoir des Vracs Normands',
    'archived',
    210,
    'Compte clôturé après absorption par Grand Ouest Fret',
  ],
  ['DUN-MAR', 'Dunes Marine Supply', 'archived', 318, "Cessation de l'activité d'avitaillement"],
  [
    'MED-BULK',
    'Méditerranée Bulk Services',
    'archived',
    487,
    'Ancien compte conservé pour consultation des opérations historiques',
  ],
  ['NEX-MET', 'Nexum Métaux Europe'],
] as const

export const CUSTOMER_FIXTURES = values.map(
  ([code, companyName, rawState = 'available', daysAgo, comment], index) => {
    const state = rawState as LifecycleFactoryState
    const occurredAt = daysAgo ? FIXTURE_REFERENCE_DATE.minus({ days: daysAgo }) : null
    const lifecycle =
      state === 'archived'
        ? {
            status: 'ARCHIVED' as const,
            archivedAt: occurredAt,
            archivedByUserId: USER_FIXTURE_IDS.operationsAdmin,
            archiveComment: comment ?? null,
            reactivatedAt: null,
            reactivatedByUserId: null,
            reactivationComment: null,
          }
        : state === 'reactivated'
          ? {
              status: 'AVAILABLE' as const,
              archivedAt: occurredAt?.minus({ days: 60 }) ?? null,
              archivedByUserId: USER_FIXTURE_IDS.operationsAdmin,
              archiveComment: 'Suspension historique du compte avant reprise des opérations',
              reactivatedAt: occurredAt,
              reactivatedByUserId: USER_FIXTURE_IDS.operationsAdmin,
              reactivationComment: comment ?? null,
            }
          : availableLifecycle()
    return {
      id: fixtureUuid(23500002, index + 1),
      state,
      attributes: {
        code,
        companyName,
        ...lifecycle,
        createdAt: FIXTURE_REFERENCE_DATE.minus({ days: 120 + index * 17 }),
        updatedAt: occurredAt ?? FIXTURE_REFERENCE_DATE.minus({ days: 3 + ((index * 13) % 90) }),
      },
    }
  },
)

export const CUSTOMER_FIXTURE_IDS = { atlantic: CUSTOMER_FIXTURES[0].id } as const
export const CUSTOMER_FIXTURE_EXEMPLARS = {
  available: CUSTOMER_FIXTURES[0],
  reactivated: CUSTOMER_FIXTURES[1],
  archived: CUSTOMER_FIXTURES[26],
} as const
