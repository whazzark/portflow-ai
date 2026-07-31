import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'

import { CustomerFactory } from '#database/factories/customer_factory'
import Customer from '#models/customer'

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
    const now = DateTime.now()

    for (const [index, demoCustomer] of DEMO_CUSTOMERS.entries()) {
      const existingCustomer = await Customer.query()
        .whereRaw('LOWER(code) = ?', [demoCustomer.code.toLowerCase()])
        .first()

      if (existingCustomer) {
        continue
      }

      const createdAt = now.minus({ days: 120 + index * 17 })
      const customer = {
        code: demoCustomer.code,
        companyName: demoCustomer.companyName,
        createdAt,
        updatedAt: now.minus({ days: 3 + ((index * 13) % 90) }),
      }

      if (!demoCustomer.lifecycle) {
        await CustomerFactory.merge(customer).create()
        continue
      }

      const occurredAt = now.minus({ days: demoCustomer.lifecycle.occurredDaysAgo })

      if (demoCustomer.lifecycle.kind === 'ARCHIVED') {
        await CustomerFactory.apply('archived')
          .merge({
            ...customer,
            archivedAt: occurredAt,
            archiveComment: demoCustomer.lifecycle.comment,
            updatedAt: occurredAt,
          })
          .create()
        continue
      }

      await CustomerFactory.apply('reactivated')
        .merge({
          ...customer,
          reactivatedAt: occurredAt,
          reactivationComment: demoCustomer.lifecycle.comment,
          updatedAt: occurredAt,
        })
        .create()
    }
  }
}
