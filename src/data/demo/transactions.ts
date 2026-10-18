import type { Portfolio, Transaction } from '@/domain/types'
import { priceHistoryOf, navHistoryOf } from './market'

/** Prix de référence d'un actif à une date (dernier cours / VL publié ≤ date) */
export function priceAt(instrumentId: string, date: string): number {
  const isFund = instrumentId.startsWith('OPC_')
  const history = isFund ? navHistoryOf(instrumentId) : priceHistoryOf(instrumentId)
  if (history.length === 0) return 0
  let last = history[0].close
  for (const p of history) {
    if (p.date <= date) last = p.close
    else break
  }
  return last
}

export const SEED_USER = {
  id: 'user_demo',
  email: 'investisseur@patrimoine.ma',
  fullName: 'Youssef El Amrani',
  phone: '+212 6 61 23 45 67',
  createdAt: '2023-02-01T09:12:00.000Z',
}

export const SEED_PORTFOLIOS: Portfolio[] = [
  {
    id: 'pf_cto',
    userId: SEED_USER.id,
    name: 'Compte-titres perso',
    kind: 'Compte-titres ordinaire (CTO)',
    color: '#d13c18',
    createdAt: '2023-02-01T09:15:00.000Z',
    note: 'Portefeuille principal — actions cotées à Casablanca + 2 OPCVM.',
  },
  {
    id: 'pf_retraite',
    userId: SEED_USER.id,
    name: 'PEA / Retraite',
    kind: 'Épargne longue (assurance-vie)',
    color: '#474d5d',
    createdAt: '2023-02-01T09:20:00.000Z',
    note: 'Horizon 15 ans, majoritairement OPCVM.',
  },
  {
    id: 'pf_enfants',
    userId: SEED_USER.id,
    name: 'Enfants',
    kind: 'Épargne pour les enfants',
    color: '#0f9d58',
    createdAt: '2024-05-01T10:00:00.000Z',
    note: 'Petit portefeuille de valorisation.',
  },
]

type Seed = Omit<Transaction, 'id' | 'createdAt' | 'portfolioId'> & {
  portfolioId?: string
}

const RAW: Seed[] = [
  /* ---------------- Portefeuille 1 : compte-titres perso ---------------- */
  { portfolioId: 'pf_cto', type: 'DEPOT', instrumentId: null, date: '2023-03-13', amount: 500_000, comment: 'Versement initial' },
  { portfolioId: 'pf_cto', type: 'ACHAT', instrumentId: 'ATW', date: '2023-03-15', quantity: 300, price: priceAt('ATW', '2023-03-15'), fees: 210, taxes: 7, comment: 'Prise de position banques' },
  { portfolioId: 'pf_cto', type: 'ACHAT', instrumentId: 'BCP', date: '2023-03-15', quantity: 400, price: priceAt('BCP', '2023-03-15'), fees: 180, taxes: 9 },
  { portfolioId: 'pf_cto', type: 'ACHAT', instrumentId: 'IAM', date: '2023-06-12', quantity: 800, price: priceAt('IAM', '2023-06-12'), fees: 145, taxes: 6 },
  { portfolioId: 'pf_cto', type: 'ACHAT', instrumentId: 'LHM', date: '2023-09-11', quantity: 300, price: priceAt('LHM', '2023-09-11'), fees: 130, taxes: 5 },
  { portfolioId: 'pf_cto', type: 'ACHAT', instrumentId: 'MNG', date: '2024-01-16', quantity: 50, price: priceAt('MNG', '2024-01-16'), fees: 240, taxes: 8 },
  { portfolioId: 'pf_cto', type: 'DIVIDENDE', instrumentId: 'ATW', date: '2024-04-15', amount: 5_250, taxes: 787.5, comment: 'Dividende 2023 — détachement' },
  { portfolioId: 'pf_cto', type: 'VENTE', instrumentId: 'LHM', date: '2024-05-27', quantity: 100, price: priceAt('LHM', '2024-05-27'), fees: 65, taxes: 3, comment: 'Allègement ligne matériaux' },
  { portfolioId: 'pf_cto', type: 'DEPOT', instrumentId: null, date: '2024-06-04', amount: 350_000, comment: 'Épargne annuelle' },
  { portfolioId: 'pf_cto', type: 'ACHAT', instrumentId: 'TAQ', date: '2024-06-10', quantity: 500, price: priceAt('TAQ', '2024-06-10'), fees: 155, taxes: 6 },
  { portfolioId: 'pf_cto', type: 'ACHAT', instrumentId: 'MSA', date: '2024-07-15', quantity: 400, price: priceAt('MSA', '2024-07-15'), fees: 140, taxes: 6 },
  { portfolioId: 'pf_cto', type: 'ACHAT', instrumentId: 'BOA', date: '2024-09-09', quantity: 300, price: priceAt('BOA', '2024-09-09'), fees: 135, taxes: 5 },
  { portfolioId: 'pf_cto', type: 'ACHAT', instrumentId: 'ADH', date: '2025-01-14', quantity: 1000, price: priceAt('ADH', '2025-01-14'), fees: 175, taxes: 7 },
  { portfolioId: 'pf_cto', type: 'ACHAT', instrumentId: 'LBV', date: '2025-03-04', quantity: 200, price: priceAt('LBV', '2025-03-04'), fees: 165, taxes: 6 },
  { portfolioId: 'pf_cto', type: 'DIVIDENDE', instrumentId: 'ATW', date: '2025-04-07', amount: 5_250, taxes: 787.5 },
  { portfolioId: 'pf_cto', type: 'DIVIDENDE', instrumentId: 'BCP', date: '2025-04-07', amount: 3_280, taxes: 492 },
  { portfolioId: 'pf_cto', type: 'DIVIDENDE', instrumentId: 'IAM', date: '2025-04-22', amount: 4_920, taxes: 738 },
  { portfolioId: 'pf_cto', type: 'DEPOT', instrumentId: null, date: '2025-09-15', amount: 300_000, comment: 'Prime annuelle' },
  { portfolioId: 'pf_cto', type: 'SOUSCRIPTION', instrumentId: 'OPC_ATQ', date: '2025-10-02', quantity: 300, price: priceAt('OPC_ATQ', '2025-10-02'), fees: 175, taxes: 0, comment: 'Diversification actions via OPCVM' },
  { portfolioId: 'pf_cto', type: 'ACHAT', instrumentId: 'TMA', date: '2026-01-19', quantity: 300, price: priceAt('TMA', '2026-01-19'), fees: 120, taxes: 5 },
  { portfolioId: 'pf_cto', type: 'DEPOT', instrumentId: null, date: '2026-02-02', amount: 100_000, comment: 'Renforcement de la trésorerie' },
  { portfolioId: 'pf_cto', type: 'VENTE', instrumentId: 'ADH', date: '2026-03-11', quantity: 400, price: priceAt('ADH', '2026-03-11'), fees: 70, taxes: 3, comment: 'Réduction du poids immobilier' },
  { portfolioId: 'pf_cto', type: 'DIVIDENDE', instrumentId: 'ATW', date: '2026-04-13', amount: 5_250, taxes: 787.5 },
  { portfolioId: 'pf_cto', type: 'DIVIDENDE', instrumentId: 'BCP', date: '2026-04-13', amount: 3_280, taxes: 492 },
  { portfolioId: 'pf_cto', type: 'DIVIDENDE', instrumentId: 'IAM', date: '2026-04-20', amount: 4_920, taxes: 738 },
  { portfolioId: 'pf_cto', type: 'DIVIDENDE', instrumentId: 'MSA', date: '2026-04-20', amount: 2_720, taxes: 408 },
  { portfolioId: 'pf_cto', type: 'RETRAIT', instrumentId: null, date: '2026-05-06', amount: 50_000, comment: 'Retrait partiel' },
  { portfolioId: 'pf_cto', type: 'SOUSCRIPTION', instrumentId: 'OPC_RIF', date: '2026-06-08', quantity: 1200, price: priceAt('OPC_RIF', '2026-06-08'), fees: 0, comment: 'Poche obligataire court terme' },
  { portfolioId: 'pf_cto', type: 'ACHAT', instrumentId: 'MNG', date: '2026-08-03', quantity: 30, price: priceAt('MNG', '2026-08-03'), fees: 190, taxes: 6 },
  { portfolioId: 'pf_cto', type: 'FRAIS', instrumentId: null, date: '2026-09-14', amount: 150, comment: 'Frais de garde annuels' },
  { portfolioId: 'pf_cto', type: 'ACHAT', instrumentId: 'CSR', date: '2026-09-21', quantity: 200, price: priceAt('CSR', '2026-09-21'), fees: 95, taxes: 4 },

  /* ---------------- Portefeuille 2 : PEA / Retraite ---------------- */
  { portfolioId: 'pf_retraite', type: 'DEPOT', instrumentId: null, date: '2023-02-06', amount: 500_000, comment: 'Ouverture du plan' },
  { portfolioId: 'pf_retraite', type: 'SOUSCRIPTION', instrumentId: 'OPC_MGE', date: '2023-02-10', quantity: 800, price: priceAt('OPC_MGE', '2023-02-10'), fees: 280 },
  { portfolioId: 'pf_retraite', type: 'SOUSCRIPTION', instrumentId: 'OPC_RIF', date: '2023-05-08', quantity: 1500, price: priceAt('OPC_RIF', '2023-05-08'), fees: 0 },
  { portfolioId: 'pf_retraite', type: 'ACHAT', instrumentId: 'IAM', date: '2023-11-06', quantity: 1000, price: priceAt('IAM', '2023-11-06'), fees: 165, taxes: 7 },
  { portfolioId: 'pf_retraite', type: 'COUPON', instrumentId: 'OPC_RIF', date: '2024-01-15', amount: 1_950, taxes: 292.5, comment: 'Distribution mensuelle' },
  { portfolioId: 'pf_retraite', type: 'SOUSCRIPTION', instrumentId: 'OPC_CH2', date: '2024-03-11', quantity: 900, price: priceAt('OPC_CH2', '2024-03-11'), fees: 180 },
  { portfolioId: 'pf_retraite', type: 'DEPOT', instrumentId: null, date: '2024-06-03', amount: 400_000 },
  { portfolioId: 'pf_retraite', type: 'SOUSCRIPTION', instrumentId: 'OPC_LIX', date: '2024-06-10', quantity: 1100, price: priceAt('OPC_LIX', '2024-06-10'), fees: 275 },
  { portfolioId: 'pf_retraite', type: 'ACHAT', instrumentId: 'CSR', date: '2024-09-09', quantity: 400, price: priceAt('CSR', '2024-09-09'), fees: 140, taxes: 6 },
  { portfolioId: 'pf_retraite', type: 'COUPON', instrumentId: 'OPC_CH2', date: '2025-01-13', amount: 3_600, taxes: 540, comment: 'Distribution annuelle' },
  { portfolioId: 'pf_retraite', type: 'SOUSCRIPTION', instrumentId: 'OPC_CHA', date: '2025-02-10', quantity: 1500, price: priceAt('OPC_CHA', '2025-02-10'), fees: 525 },
  { portfolioId: 'pf_retraite', type: 'DEPOT', instrumentId: null, date: '2025-05-12', amount: 300_000 },
  { portfolioId: 'pf_retraite', type: 'SOUSCRIPTION', instrumentId: 'OPC_ATM', date: '2025-06-02', quantity: 1800, price: priceAt('OPC_ATM', '2025-06-02'), fees: 0, comment: 'Réserve de liquidités rémunérée' },
  { portfolioId: 'pf_retraite', type: 'ACHAT', instrumentId: 'TAQ', date: '2025-07-14', quantity: 600, price: priceAt('TAQ', '2025-07-14'), fees: 175, taxes: 7 },
  { portfolioId: 'pf_retraite', type: 'ACHAT', instrumentId: 'DSW', date: '2025-11-10', quantity: 500, price: priceAt('DSW', '2025-11-10'), fees: 70, taxes: 3 },
  { portfolioId: 'pf_retraite', type: 'SPLIT', instrumentId: 'DSW', date: '2026-01-12', quantity: 2, comment: 'Détail en action 2 pour 1 (démo)' },
  { portfolioId: 'pf_retraite', type: 'DIVIDENDE', instrumentId: 'IAM', date: '2026-04-14', amount: 6_150, taxes: 922.5 },
  { portfolioId: 'pf_retraite', type: 'DIVIDENDE', instrumentId: 'CSR', date: '2026-04-20', amount: 2_880, taxes: 432 },
  { portfolioId: 'pf_retraite', type: 'COUPON', instrumentId: 'OPC_ATM', date: '2026-05-15', amount: 1_620, taxes: 243, comment: 'Distribution du fonds monétaire' },
  { portfolioId: 'pf_retraite', type: 'COUPON', instrumentId: 'OPC_RIF', date: '2026-06-15', amount: 2_250, taxes: 337.5 },
  { portfolioId: 'pf_retraite', type: 'RACHAT', instrumentId: 'OPC_MGE', date: '2026-07-06', quantity: 200, price: priceAt('OPC_MGE', '2026-07-06'), fees: 90, comment: 'Équilibrage de la poche actions' },
  { portfolioId: 'pf_retraite', type: 'DEPOT', instrumentId: null, date: '2026-09-07', amount: 350_000 },
  { portfolioId: 'pf_retraite', type: 'SOUSCRIPTION', instrumentId: 'OPC_SOU', date: '2026-09-08', quantity: 400, price: priceAt('OPC_SOU', '2026-09-08'), fees: 120 },

  /* ---------------- Portefeuille 3 : Enfants ---------------- */
  { portfolioId: 'pf_enfants', type: 'DEPOT', instrumentId: null, date: '2024-05-15', amount: 120_000, comment: 'Épargne de naissance' },
  { portfolioId: 'pf_enfants', type: 'ACHAT', instrumentId: 'SMR', date: '2024-05-20', quantity: 300, price: priceAt('SMR', '2024-05-20'), fees: 65, taxes: 3 },
  { portfolioId: 'pf_enfants', type: 'SOUSCRIPTION', instrumentId: 'OPC_OUA', date: '2024-08-12', quantity: 500, price: priceAt('OPC_OUA', '2024-08-12'), fees: 0 },
  { portfolioId: 'pf_enfants', type: 'ACHAT', instrumentId: 'TMA', date: '2025-06-10', quantity: 150, price: priceAt('TMA', '2025-06-10'), fees: 55, taxes: 2 },
  { portfolioId: 'pf_enfants', type: 'ACHAT', instrumentId: 'BOA', date: '2025-06-10', quantity: 200, price: priceAt('BOA', '2025-06-10'), fees: 85, taxes: 3 },
  { portfolioId: 'pf_enfants', type: 'AUGMENTATION_CAPITAL', instrumentId: 'SMR', date: '2025-10-20', quantity: 100, price: priceAt('SMR', '2025-10-20') * 0.95, fees: 30, taxes: 2, comment: 'Libération d’actions (démo augmentation de capital)' },
  { portfolioId: 'pf_enfants', type: 'DEPOT', instrumentId: null, date: '2025-12-15', amount: 60_000, comment: 'Versement annuel' },
  { portfolioId: 'pf_enfants', type: 'DIVIDENDE', instrumentId: 'SMR', date: '2026-04-16', amount: 1_240, taxes: 186 },
  { portfolioId: 'pf_enfants', type: 'DIVIDENDE', instrumentId: 'BOA', date: '2026-04-23', amount: 1_420, taxes: 213 },
  { portfolioId: 'pf_enfants', type: 'COUPON', instrumentId: 'OPC_OUA', date: '2026-06-15', amount: 640, taxes: 96 },
  { portfolioId: 'pf_enfants', type: 'RETRAIT', instrumentId: null, date: '2026-08-11', amount: 10_000, comment: 'Achat équipement scolaire' },
]

export const SEED_TRANSACTIONS: Transaction[] = RAW.map((s, i) => {
  const { portfolioId, ...rest } = s
  return {
    ...rest,
    id: `tx_${String(i + 1).padStart(3, '0')}`,
    portfolioId: portfolioId ?? 'pf_cto',
    createdAt: `${rest.date}T09:30:00.${String(i).padStart(3, '0')}Z`,
    price: rest.price ? Math.round(rest.price * 100) / 100 : undefined,
  }
})
