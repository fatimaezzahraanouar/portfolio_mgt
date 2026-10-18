import type { Instrument, OpcvmCategory } from '@/domain/types'

export interface ActionSpec {
  ticker: string
  name: string
  sector: string
  isin: string
  lotSize: number
  /** Cours de référence à la dernière séance (MAD) */
  price: number
  shares: number
  eps: number
  dividendPerShare: number
  /** Volatilité journalière */
  vol: number
  /** Dérive journalière attendue */
  drift: number
}

/**
 * Actions cotées à la Bourse de Casablanca — données de démonstration
 * réalistes mais TITUAIRES : à remplacer par les données d'un DataProvider réel.
 */
export const ACTION_SPECS: ActionSpec[] = [
  {
    ticker: 'ATW',
    name: 'Attijariwafa Bank',
    sector: 'Banques',
    isin: 'MA0000011888',
    lotSize: 10,
    price: 742.5,
    shares: 504_000_000,
    eps: 48.6,
    dividendPerShare: 17.5,
    vol: 0.0115,
    drift: 0.00045,
  },
  {
    ticker: 'BCP',
    name: 'Banque Centrale Populaire',
    sector: 'Banques',
    isin: 'MA0000011442',
    lotSize: 10,
    price: 312.8,
    shares: 275_000_000,
    eps: 24.1,
    dividendPerShare: 8.2,
    vol: 0.0121,
    drift: 0.00038,
  },
  {
    ticker: 'BOA',
    name: 'Bank of Africa',
    sector: 'Banques',
    isin: 'MA0000011559',
    lotSize: 10,
    price: 248.4,
    shares: 118_000_000,
    eps: 21.4,
    dividendPerShare: 7.1,
    vol: 0.0125,
    drift: 0.00031,
  },
  {
    ticker: 'IAM',
    name: 'Itissalat Al-Maghrib (Maroc Telecom)',
    sector: 'Télécoms',
    isin: 'MA0000011096',
    lotSize: 10,
    price: 106.35,
    shares: 875_000_000,
    eps: 8.9,
    dividendPerShare: 6.15,
    vol: 0.0098,
    drift: 0.00012,
  },
  {
    ticker: 'LHM',
    name: 'LafargeHolcim Maroc',
    sector: 'Matériaux de construction',
    isin: 'MA0000011211',
    lotSize: 10,
    price: 214.7,
    shares: 151_000_000,
    eps: 16.4,
    dividendPerShare: 9.5,
    vol: 0.0134,
    drift: 0.00018,
  },
  {
    ticker: 'MSA',
    name: 'Marsa Maroc',
    sector: 'Transport & Logistique',
    isin: 'MA0000011995',
    lotSize: 10,
    price: 176.9,
    shares: 84_000_000,
    eps: 14.2,
    dividendPerShare: 6.8,
    vol: 0.0142,
    drift: 0.00026,
  },
  {
    ticker: 'TAQ',
    name: 'Taqa Morocco',
    sector: 'Énergie & Services publics',
    isin: 'MA0000012019',
    lotSize: 10,
    price: 138.45,
    shares: 671_000_000,
    eps: 9.1,
    dividendPerShare: 3.6,
    vol: 0.0129,
    drift: 0.00015,
  },
  {
    ticker: 'MNG',
    name: 'Managem',
    sector: 'Mines & Métaux précieux',
    isin: 'MA0000011666',
    lotSize: 10,
    price: 2_145.0,
    shares: 44_000_000,
    eps: 118.4,
    dividendPerShare: 45.0,
    vol: 0.0176,
    drift: 0.00036,
  },
  {
    ticker: 'LBV',
    name: "Label'Vie",
    sector: 'Distribution',
    isin: 'MA0000012451',
    lotSize: 10,
    price: 418.6,
    shares: 26_800_000,
    eps: 32.5,
    dividendPerShare: 12.0,
    vol: 0.0151,
    drift: 0.00041,
  },
  {
    ticker: 'SMR',
    name: 'Marjane Holding',
    sector: 'Distribution',
    isin: 'MA0000011773',
    lotSize: 10,
    price: 104.2,
    shares: 55_000_000,
    eps: 7.6,
    dividendPerShare: 3.1,
    vol: 0.0163,
    drift: 0.00009,
  },
  {
    ticker: 'ADH',
    name: 'Addoha Groupe',
    sector: 'Immobilier',
    isin: 'MA0000011328',
    lotSize: 10,
    price: 97.85,
    shares: 118_000_000,
    eps: 6.9,
    dividendPerShare: 2.6,
    vol: 0.0187,
    drift: 0.00007,
  },
  {
    ticker: 'TMA',
    name: 'TotalEnergies Marketing Maroc',
    sector: 'Énergie & Distribution',
    isin: 'MA0000012568',
    lotSize: 10,
    price: 131.6,
    shares: 30_000_000,
    eps: 11.2,
    dividendPerShare: 4.4,
    vol: 0.0117,
    drift: 0.00019,
  },
  {
    ticker: 'CSR',
    name: 'Cosumar',
    sector: 'Agroalimentaire',
    isin: 'MA0000012100',
    lotSize: 10,
    price: 198.4,
    shares: 49_500_000,
    eps: 14.8,
    dividendPerShare: 7.2,
    vol: 0.0108,
    drift: 0.00022,
  },
  {
    ticker: 'DSW',
    name: 'Disway',
    sector: 'Distribution & Technologies',
    isin: 'MA0000012782',
    lotSize: 10,
    price: 58.9,
    shares: 36_000_000,
    eps: 4.1,
    dividendPerShare: 1.5,
    vol: 0.0194,
    drift: 0.00013,
  },
]

export interface FundSpec {
  id: string
  isin: string
  name: string
  managementCompany: string
  category: OpcvmCategory
  benchmark: string
  riskLevel: number
  fees: { entry: number; exit: number; management: number }
  /** Dernière VL publiée (MAD) */
  nav: number
  /** Date de publication de la dernière VL (J ou J+1) */
  navDate: string
  policy: string
  vol: number
  drift: number
}

/**
 * OPCVM de démonstration (sociétés de gestion fictives) couvrant toutes
 * les catégories : Actions, Obligataire CT/MLT, Monétaire, Diversifié, Contractuel.
 */
export const FUND_SPECS: FundSpec[] = [
  {
    id: 'OPC_ATM',
    isin: 'MA0000013012',
    name: 'Atlas Monétaire 7 Jours',
    managementCompany: 'Atlas Capital Gestion',
    category: 'MONETAIRE',
    benchmark: 'TMM Maroc 7 jours',
    riskLevel: 1,
    fees: { entry: 0.5, exit: 0, management: 0.6 },
    nav: 108.42,
    navDate: '2026-10-16',
    policy:
      'Placement de trésorerie à très court terme : titres monétaires, bons de caisse et dépôts bancaires notés élevés. Compartiment sans frais d’entrée sur souscription institutionnelle.',
    vol: 0.0002,
    drift: 0.000165,
  },
  {
    id: 'OPC_ATQ',
    isin: 'MA0000013020',
    name: 'Atlas Actions Maroc',
    managementCompany: 'Atlas Capital Gestion',
    category: 'ACTIONS',
    benchmark: 'MASI (indice large)',
    riskLevel: 4,
    fees: { entry: 3, exit: 0.5, management: 1.75 },
    nav: 214.75,
    navDate: '2026-10-16',
    policy:
      'Sélection de 20 à 30 sociétés cotées à la Bourse de Casablanca, orientée qualité et rendement du dividende. Actif net investi à 95 % minimum en actions cotées.',
    vol: 0.0098,
    drift: 0.00034,
  },
  {
    id: 'OPC_MGE',
    isin: 'MA0000013039',
    name: 'Maghreb Équité',
    managementCompany: 'Maghreb Gestion d’Actifs',
    category: 'ACTIONS',
    benchmark: 'MASI Trimédia',
    riskLevel: 5,
    fees: { entry: 3.5, exit: 1, management: 2 },
    nav: 342.1,
    navDate: '2026-10-15',
    policy:
      'Fonds concentré sur les grandes capitalisations marocaines, avec une poche jusqu’à 15 % en valeurs cotées du Maghreb.',
    vol: 0.0112,
    drift: 0.00031,
  },
  {
    id: 'OPC_CHA',
    isin: 'MA0000013047',
    name: 'Chellah Small Caps Maroc',
    managementCompany: 'Chellah Gestion',
    category: 'ACTIONS',
    benchmark: 'MASI (hors 5 premières)',
    riskLevel: 5,
    fees: { entry: 3.5, exit: 1.5, management: 2.1 },
    nav: 96.2,
    navDate: '2026-10-15',
    policy:
      'Capitalisation sur les sociétés de moyenne capitalisation : immobilier, distribution, industrie. Volatilité attendue supérieure à celle du marché.',
    vol: 0.0134,
    drift: 0.00027,
  },
  {
    id: 'OPC_SOU',
    isin: 'MA0000013055',
    name: 'Souss Actions Internationales',
    managementCompany: 'Souss AM',
    category: 'ACTIONS',
    benchmark: 'MSCI World Europe (en MAD)',
    riskLevel: 4,
    fees: { entry: 3, exit: 1, management: 1.9 },
    nav: 168.9,
    navDate: '2026-10-16',
    policy:
      'Diversification hors Maroc via un portefeuille de fonds actions développés, couvert en devise à 70 % minimum.',
    vol: 0.0104,
    drift: 0.00033,
  },
  {
    id: 'OPC_RIF',
    isin: 'MA0000013063',
    name: 'Rif Obligataire Court Terme',
    managementCompany: 'Rif Asset Management',
    category: 'OBLIGATAIRE_CT',
    benchmark: 'Indice obligataire court terme BMCE',
    riskLevel: 2,
    fees: { entry: 1.5, exit: 0.25, management: 0.9 },
    nav: 126.85,
    navDate: '2026-10-16',
    policy:
      'Obligations de l’État et titres de créance émis par des établissements notés AA, duration cible inférieure à 2 ans.',
    vol: 0.0016,
    drift: 0.000155,
  },
  {
    id: 'OPC_ZER',
    isin: 'MA0000013071',
    name: 'Zerhoun Obligataire Court Terme',
    managementCompany: 'Zerhoun AM',
    category: 'OBLIGATAIRE_CT',
    benchmark: 'TMM 12 mois + spread',
    riskLevel: 2,
    fees: { entry: 1.2, exit: 0, management: 0.85 },
    nav: 112.4,
    navDate: '2026-10-14',
    policy:
      'Portefeuille de créances marocaines à court terme, avec une poche titres islamiques (Sukuk) jusqu’à 20 %.',
    vol: 0.0014,
    drift: 0.00015,
  },
  {
    id: 'OPC_CH2',
    isin: 'MA0000013080',
    name: 'Chaouia Obligataire Moyen-Long Terme',
    managementCompany: 'Chaouia Gestion',
    category: 'OBLIGATAIRE_MLT',
    benchmark: 'Indice obligataire BMCE 5 ans',
    riskLevel: 3,
    fees: { entry: 2, exit: 0.5, management: 1.1 },
    nav: 178.4,
    navDate: '2026-10-16',
    policy:
      'Détention à l’échéance d’obligations de l’État et d’emprunts sociétés notés BBB minimum. Duration cible 4 à 6 ans.',
    vol: 0.0031,
    drift: 0.000205,
  },
  {
    id: 'OPC_LIX',
    isin: 'MA0000013098',
    name: 'Lixus Diversifié',
    managementCompany: 'Lixus Gestion',
    category: 'DIVERSIFIE',
    benchmark: '60 % MASI / 35 % Obligataire / 5 % Monétaire',
    riskLevel: 3,
    fees: { entry: 2.5, exit: 0.5, management: 1.4 },
    nav: 152.3,
    navDate: '2026-10-16',
    policy:
      'Allocation flexible actions/obigataires pilotée mensuellement, poche de couverture jusqu’à 20 % en actions.',
    vol: 0.0056,
    drift: 0.00025,
  },
  {
    id: 'OPC_BRC',
    isin: 'MA0000013106',
    name: 'Bouregreg Contractuel 4 %',
    managementCompany: 'Bouregreg AM',
    category: 'CONTRACTUEL',
    benchmark: 'TMM 12 mois + 1,5 %',
    riskLevel: 2,
    fees: { entry: 1, exit: 0.75, management: 1 },
    nav: 118.6,
    navDate: '2026-10-15',
    policy:
      'Fonds contractuel rattaché à un contrat d’assurance-vie : rendement cible de 4 % net annuel, actifs obligataires et monétaires.',
    vol: 0.0019,
    drift: 0.000175,
  },
  {
    id: 'OPC_OUA',
    isin: 'MA0000013114',
    name: 'Oualidia Monétaire ISR',
    managementCompany: 'Oualidia AM',
    category: 'MONETAIRE',
    benchmark: 'TMM Maroc 3 mois',
    riskLevel: 1,
    fees: { entry: 0.4, exit: 0, management: 0.55 },
    nav: 101.95,
    navDate: '2026-10-16',
    policy:
      'Actifs éligibles Sharia (compartiment monétaire islamique) : dépôts murabaha et titres de créance à court terme.',
    vol: 0.0002,
    drift: 0.000158,
  },
  {
    id: 'OPC_ATC',
    isin: 'MA0000013122',
    name: 'Atlas Crédit Court Terme',
    managementCompany: 'Atlas Capital Gestion',
    category: 'DIVERSIFIE',
    benchmark: '30 % MASI / 70 % Obligataire',
    riskLevel: 3,
    fees: { entry: 2.2, exit: 0.4, management: 1.35 },
    nav: 137.55,
    navDate: '2026-10-16',
    policy:
      'Fonds à horizon de placement 2 à 3 ans, mix obligations de l’État et poche actions limitée à 35 %.',
    vol: 0.0047,
    drift: 0.000235,
  },
]

export function actionInstrument(spec: ActionSpec): Instrument {
  return {
    id: spec.ticker,
    type: 'ACTION',
    ticker: spec.ticker,
    name: spec.name,
    sector: spec.sector,
    currency: 'MAD',
    isin: spec.isin,
    market: 'Bourse de Casablanca — Marché Principal',
    lotSize: spec.lotSize,
    active: true,
  }
}

export function fundInstrument(spec: FundSpec): Instrument {
  return {
    id: spec.id,
    type: 'OPCVM',
    ticker: spec.isin,
    name: spec.name,
    sector: spec.category,
    currency: 'MAD',
    isin: spec.isin,
    managementCompany: spec.managementCompany,
    category: spec.category,
    benchmark: spec.benchmark,
    riskLevel: spec.riskLevel,
    fees: spec.fees,
    policy: spec.policy,
    active: true,
  }
}

export const ALL_INSTRUMENTS: Instrument[] = [
  ...ACTION_SPECS.map(actionInstrument),
  ...FUND_SPECS.map(fundInstrument),
]
