import type { Alert, CorporateEvent, WatchlistItem } from '@/domain/types'

/**
 * Événements à venir — détachements de dividendes, assemblées générales,
 * publications de VL. Données de démonstration.
 */
export const SEED_EVENTS: CorporateEvent[] = [
  { id: 'ev_01', instrumentId: 'OPC_RIF', type: 'VL_PUBLISHED', date: '2026-10-22', label: 'Publication de la VL hebdomadaire' },
  { id: 'ev_02', instrumentId: 'MNG', type: 'DIVIDEND_DETACH', date: '2026-10-26', label: 'Détachement du dividende Managem', amount: 45 },
  { id: 'ev_03', instrumentId: 'ATW', type: 'DIVIDEND_DETACH', date: '2026-11-04', label: 'Détachement du dividende Attijariwafa Bank', amount: 17.5 },
  { id: 'ev_04', instrumentId: 'ATW', type: 'AG', date: '2026-11-05', label: 'Assemblée générale ordinaire' },
  { id: 'ev_05', instrumentId: 'IAM', type: 'AG', date: '2026-11-12', label: 'Assemblée générale extraordinaire' },
  { id: 'ev_06', instrumentId: 'BCP', type: 'DIVIDEND_DETACH', date: '2026-11-20', label: 'Détachement du dividende BCP', amount: 8.2 },
  { id: 'ev_07', instrumentId: 'MSA', type: 'DIVIDEND_DETACH', date: '2026-11-27', label: 'Détachement du dividende Marsa Maroc', amount: 6.8 },
  { id: 'ev_08', instrumentId: 'LBV', type: 'AG', date: '2026-12-03', label: 'Assemblée générale annuelle' },
  { id: 'ev_09', instrumentId: 'OPC_ATM', type: 'VL_PUBLISHED', date: '2026-12-04', label: 'Publication de la VL — Atlas Monétaire 7 Jours' },
  { id: 'ev_10', instrumentId: 'CSR', type: 'DIVIDEND_DETACH', date: '2026-12-15', label: 'Détachement du dividende Cosumar', amount: 7.2 },
  { id: 'ev_11', instrumentId: 'TAQ', type: 'AG', date: '2026-10-29', label: 'Assemblée générale Taqa Morocco' },
  { id: 'ev_12', instrumentId: 'ADH', type: 'CAPITAL', date: '2027-01-15', label: 'Libération d’actions Addoha (démo)' },
]

export const SEED_WATCHLIST: WatchlistItem[] = [
  { id: 'wl_1', portfolioId: null, instrumentId: 'ATW', createdAt: '2026-02-10T10:00:00.000Z' },
  { id: 'wl_2', portfolioId: null, instrumentId: 'MNG', createdAt: '2026-02-10T10:01:00.000Z' },
  { id: 'wl_3', portfolioId: null, instrumentId: 'LBV', createdAt: '2026-03-04T08:30:00.000Z' },
  { id: 'wl_4', portfolioId: null, instrumentId: 'OPC_MGE', createdAt: '2026-03-04T08:32:00.000Z' },
  { id: 'wl_5', portfolioId: null, instrumentId: 'TAQ', createdAt: '2026-05-19T14:12:00.000Z' },
  { id: 'wl_6', portfolioId: null, instrumentId: 'OPC_SOU', createdAt: '2026-09-08T11:05:00.000Z' },
]

export const SEED_ALERTS: Alert[] = [
  {
    id: 'al_1',
    portfolioId: null,
    instrumentId: 'ATW',
    type: 'PRICE_ABOVE',
    threshold: 800,
    active: true,
    channels: ['IN_APP', 'EMAIL'],
    createdAt: '2026-04-02T09:00:00.000Z',
  },
  {
    id: 'al_2',
    portfolioId: null,
    instrumentId: 'MNG',
    type: 'PRICE_BELOW',
    threshold: 1_950,
    active: true,
    channels: ['IN_APP'],
    createdAt: '2026-06-18T16:20:00.000Z',
    triggeredAt: '2026-08-12T10:15:00.000Z',
  },
  {
    id: 'al_3',
    portfolioId: null,
    instrumentId: 'IAM',
    type: 'DAY_CHANGE',
    threshold: 2,
    active: true,
    channels: ['IN_APP', 'EMAIL'],
    createdAt: '2026-07-01T08:45:00.000Z',
  },
  {
    id: 'al_4',
    portfolioId: null,
    instrumentId: 'OPC_ATQ',
    type: 'VL_PUBLISHED',
    threshold: 0,
    active: true,
    channels: ['EMAIL'],
    createdAt: '2026-07-14T12:00:00.000Z',
  },
  {
    id: 'al_5',
    portfolioId: 'pf_cto',
    instrumentId: 'MSA',
    type: 'DIVIDEND_DETACH',
    threshold: 0,
    active: false,
    channels: ['IN_APP'],
    createdAt: '2026-09-22T18:30:00.000Z',
  },
]
