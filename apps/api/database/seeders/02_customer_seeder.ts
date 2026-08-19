import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'

import { CustomerFactory } from '#database/factories/customer_factory'
import Customer from '#models/customer'
import User from '#models/user'

const LIFECYCLE_ACTOR_EMAIL = 'thomas.bernard@portflow.ai'
const DATASET_REFERENCE_DATE = DateTime.fromISO('2025-06-01T10:00:00.000Z')

type CustomerLifecycle =
  | {
      kind: 'ARCHIVED'
      occurredDaysAgo: number
      comment: string
    }
  | {
      kind: 'REACTIVATED'
      occurredDaysAgo: number
      comment: string
    }

type DemoCustomer = {
  code: string
  companyName: string
  lifecycle?: CustomerLifecycle
}

const DEMO_CUSTOMERS: DemoCustomer[] = [
  { code: 'ATL-CER', companyName: 'Atlantique Céréales' },
  {
    code: 'ARM-FROID',
    companyName: 'Armor Chaîne du Froid',
    lifecycle: {
      kind: 'REACTIVATED',
      occurredDaysAgo: 75,
      comment: 'Reprise des escales saisonnières après renouvellement du contrat',
    },
  },
  { code: 'BOR-SHP', companyName: 'Boréal Shipping France' },
  {
    code: 'BAL-ECO',
    companyName: 'Baltic Eco Fuels',
    lifecycle: {
      kind: 'REACTIVATED',
      occurredDaysAgo: 142,
      comment: "Réouverture du compte à la suite de la reprise des flux d'importation",
    },
  },
  { code: 'CAP-HOR', companyName: 'Cap Horizon Logistique' },
  { code: 'CER-AGR', companyName: 'Cérès Agro Négoce' },
  { code: 'DEL-MIN', companyName: 'Delta Minéraux' },
  { code: 'EST-TRN', companyName: 'Estuaire Transit' },
  { code: 'FLA-CTR', companyName: 'Flandres Conteneurs' },
  { code: 'GOF-FRT', companyName: 'Grand Ouest Fret' },
  { code: 'HEL-MAR', companyName: 'Helios Marine Services' },
  { code: 'IBE-BLK', companyName: 'Iberia Bulk Trading' },
  { code: 'KER-MAN', companyName: 'Kermor Manutention' },
  { code: 'LOI-ACI', companyName: 'Loire Acier Distribution' },
  { code: 'MAG-PHO', companyName: 'Maghreb Phosphates Europe' },
  { code: 'NOR-AFF', companyName: 'Noroît Affrètement' },
  { code: 'OCE-REC', companyName: 'Océane Recyclage Industriel' },
  { code: 'PEN-BOIS', companyName: 'Péninsule Bois & Papiers' },
  { code: 'QSE-ENE', companyName: 'Quai Sud Énergies' },
  { code: 'RML-FR', companyName: 'Rhône Maritime Logistics' },
  { code: 'SIL-TMM', companyName: 'Sillage Transport Multimodal' },
  { code: 'TER-ENG', companyName: 'TerraNova Engrais' },
  { code: 'UMP-NAV', companyName: 'Union Maritime du Ponant' },
  { code: 'VAL-PP', companyName: 'Valmer Produits Pétroliers' },
  { code: 'WIN-PC', companyName: 'Windward Project Cargo' },
  { code: 'ZEP-CS', companyName: 'Zéphyr Coastal Shipping' },
  {
    code: 'CVN-001',
    companyName: 'Comptoir des Vracs Normands',
    lifecycle: {
      kind: 'ARCHIVED',
      occurredDaysAgo: 210,
      comment: 'Compte clôturé après absorption par Grand Ouest Fret',
    },
  },
  {
    code: 'DUN-MAR',
    companyName: 'Dunes Marine Supply',
    lifecycle: {
      kind: 'ARCHIVED',
      occurredDaysAgo: 318,
      comment: "Cessation de l'activité d'avitaillement",
    },
  },
  {
    code: 'MED-BULK',
    companyName: 'Méditerranée Bulk Services',
    lifecycle: {
      kind: 'ARCHIVED',
      occurredDaysAgo: 487,
      comment: 'Ancien compte conservé pour consultation des opérations historiques',
    },
  },
  { code: 'NEX-MET', companyName: 'Nexum Métaux Europe' },
]

export default class CustomerSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const actor = await User.query()
      .whereRaw('LOWER(email) = ?', [LIFECYCLE_ACTOR_EMAIL])
      .firstOrFail()
    const now = DATASET_REFERENCE_DATE

    for (const [index, demoCustomer] of DEMO_CUSTOMERS.entries()) {
      const existingCustomer = await Customer.query()
        .whereRaw('LOWER(code) = ?', [demoCustomer.code.toLowerCase()])
        .first()

      const createdAt = now.minus({ days: 120 + index * 17 })
      const common = {
        code: demoCustomer.code,
        companyName: demoCustomer.companyName,
      }
      const occurredAt = demoCustomer.lifecycle
        ? now.minus({ days: demoCustomer.lifecycle.occurredDaysAgo })
        : null
      const lifecycle =
        demoCustomer.lifecycle?.kind === 'ARCHIVED'
          ? {
              status: 'ARCHIVED' as const,
              archivedAt: occurredAt,
              archivedByUserId: actor.id,
              archiveComment: demoCustomer.lifecycle.comment,
              reactivatedAt: null,
              reactivatedByUserId: null,
              reactivationComment: null,
            }
          : demoCustomer.lifecycle?.kind === 'REACTIVATED'
            ? {
                status: 'AVAILABLE' as const,
                archivedAt: occurredAt?.minus({ days: 60 }) ?? null,
                archivedByUserId: actor.id,
                archiveComment: 'Suspension historique du compte avant reprise des opérations',
                reactivatedAt: occurredAt,
                reactivatedByUserId: actor.id,
                reactivationComment: demoCustomer.lifecycle.comment,
              }
            : {
                status: 'AVAILABLE' as const,
                archivedAt: null,
                archivedByUserId: null,
                archiveComment: null,
                reactivatedAt: null,
                reactivatedByUserId: null,
                reactivationComment: null,
              }

      if (existingCustomer) {
        existingCustomer.merge({ ...common, ...lifecycle })
        await existingCustomer.save()
        continue
      }

      await CustomerFactory.merge({
        ...common,
        ...lifecycle,
        createdAt,
        updatedAt: occurredAt ?? now.minus({ days: 3 + ((index * 13) % 90) }),
      }).create()
    }
  }
}
