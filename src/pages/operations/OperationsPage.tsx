import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Download,
  FileUp,
  PencilLine,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useI18n, useT } from '@/i18n'
import { useStore } from '@/state/store'
import type { Transaction, TransactionType } from '@/domain/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Alert } from '@/components/ui/alert'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { EmptyState, PageHeader, SkeletonRows } from '@/components/shared/page'
import { Money } from '@/components/shared/money'
import { downloadCsv, downloadText, printPdf } from '@/lib/export'
import { formatDate, formatNumber, signClass, todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Libellés & catégories de types                                      */
/* ------------------------------------------------------------------ */

const BUY_TYPES: TransactionType[] = ['ACHAT', 'SOUSCRIPTION', 'AUGMENTATION_CAPITAL']
const SELL_TYPES: TransactionType[] = ['VENTE', 'RACHAT']
const INCOME_TYPES: TransactionType[] = ['DIVIDENDE', 'COUPON']
const CASH_TYPES: TransactionType[] = ['DEPOT', 'RETRAIT', 'FRAIS']
const EVENT_TYPES: TransactionType[] = ['SPLIT', 'ATTRIBUTION_GRATUITE']

const TYPE_GROUPS: Array<{ label: string; types: TransactionType[] }> = [
  { label: 'Titres — acquisition', types: BUY_TYPES },
  { label: 'Titres — cession', types: SELL_TYPES },
  { label: 'Revenus', types: INCOME_TYPES },
  { label: 'Trésorerie', types: CASH_TYPES },
  { label: 'Événements sur titres', types: EVENT_TYPES },
]

const ALL_TYPES: TransactionType[] = [
  ...BUY_TYPES,
  ...SELL_TYPES,
  ...INCOME_TYPES,
  ...CASH_TYPES,
  ...EVENT_TYPES,
]

const TYPE_BADGE: Partial<Record<TransactionType, 'gain' | 'loss' | 'default' | 'secondary' | 'warning'>> = {
  ACHAT: 'gain',
  SOUSCRIPTION: 'gain',
  AUGMENTATION_CAPITAL: 'gain',
  VENTE: 'loss',
  RACHAT: 'loss',
  DIVIDENDE: 'default',
  COUPON: 'default',
  DEPOT: 'secondary',
  RETRAIT: 'secondary',
  FRAIS: 'warning',
  SPLIT: 'secondary',
  ATTRIBUTION_GRATUITE: 'secondary',
}

/** Flux de trésorerie généré par une opération (signé, hors variation de cours) */
function cashFlowOf(tx: Transaction): number {
  const qty = tx.quantity ?? 0
  const price = tx.price ?? 0
  const fees = tx.fees ?? 0
  const taxes = tx.taxes ?? 0
  const amount = tx.amount ?? 0
  switch (tx.type) {
    case 'ACHAT':
    case 'SOUSCRIPTION':
    case 'AUGMENTATION_CAPITAL':
      return -(qty * price + fees + taxes)
    case 'VENTE':
    case 'RACHAT':
      return qty * price - fees - taxes
    case 'DIVIDENDE':
    case 'COUPON':
      return amount - taxes
    case 'DEPOT':
      return amount
    case 'RETRAIT':
    case 'FRAIS':
      return -amount
    default:
      return 0
  }
}

/** Montant brut mis en avant dans le journal */
function amountOf(tx: Transaction): number {
  switch (tx.type) {
    case 'ACHAT':
    case 'SOUSCRIPTION':
    case 'AUGMENTATION_CAPITAL':
      return (tx.quantity ?? 0) * (tx.price ?? 0)
    case 'VENTE':
    case 'RACHAT':
      return (tx.quantity ?? 0) * (tx.price ?? 0)
    case 'DIVIDENDE':
    case 'COUPON':
    case 'DEPOT':
    case 'RETRAIT':
    case 'FRAIS':
      return tx.amount ?? 0
    default:
      return 0
  }
}

function needsInstrument(type: TransactionType): boolean {
  return !CASH_TYPES.includes(type)
}

/* ------------------------------------------------------------------ */
/* Parsing CSV                                                         */
/* ------------------------------------------------------------------ */

/** Découpe une ligne CSV (guillemets, séparateur ; ou ,) */
function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === sep) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/** Nombre « 1 234,56 » ou « 1234.56 » → 1234.56 */
function parseNum(s: string): number | undefined {
  if (!s) return undefined
  const cleaned = s.replace(/\s|\u00a0/g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

/* ------------------------------------------------------------------ */
/* Formulaire d'ajout / modification                                   */
/* ------------------------------------------------------------------ */

interface TxFormState {
  type: TransactionType
  portfolioId: string
  instrumentId: string
  date: string
  quantity: string
  price: string
  fees: string
  taxes: string
  amount: string
  comment: string
}

function TxDialog({
  open,
  onOpenChange,
  editTx,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editTx?: Transaction | null
}) {
  const t = useT()
  const { portfolios, activeId, instrumentById, saveTransaction, settings } = useStore()
  const { push } = useToast()

  const [form, setForm] = React.useState<TxFormState>(() => emptyForm(activeId))
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    if (editTx) {
      setForm({
        type: editTx.type,
        portfolioId: editTx.portfolioId,
        instrumentId: editTx.instrumentId ?? '',
        date: editTx.date,
        quantity: editTx.quantity !== undefined ? String(editTx.quantity) : '',
        price: editTx.price !== undefined ? String(editTx.price) : '',
        fees: editTx.fees !== undefined ? String(editTx.fees) : '',
        taxes: editTx.taxes !== undefined ? String(editTx.taxes) : '',
        amount: editTx.amount !== undefined ? String(editTx.amount) : '',
        comment: editTx.comment ?? '',
      })
    } else {
      setForm(emptyForm(activeId))
    }
  }, [open, editTx, activeId])

  const set = <K extends keyof TxFormState>(key: K, value: TxFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const withInstrument = needsInstrument(form.type)
  const isCash = CASH_TYPES.includes(form.type)
  const isEvent = EVENT_TYPES.includes(form.type)

  // Instruments triés : d'abord ceux du portefeuille actif, puis le reste
  const instrumentOptions = React.useMemo(() => {
    const all = [...instrumentById.values()].filter((i) => i.active)
    return all.sort((a, b) => a.name.localeCompare(b.name))
  }, [instrumentById])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const tx: Transaction = {
        id: editTx?.id ?? '',
        portfolioId: form.portfolioId,
        instrumentId: withInstrument ? form.instrumentId : null,
        type: form.type,
        date: form.date,
        quantity: form.type === 'SPLIT' ? Number(form.quantity || '1') : parseNum(form.quantity),
        price: withInstrument && !isEvent ? parseNum(form.price) : undefined,
        fees: withInstrument && !isEvent ? parseNum(form.fees) : undefined,
        taxes: parseNum(form.taxes),
        amount: isCash || INCOME_TYPES.includes(form.type) ? parseNum(form.amount) : undefined,
        comment: form.comment.trim() || undefined,
        createdAt: editTx?.createdAt ?? new Date().toISOString(),
      }
      if (withInstrument && !tx.instrumentId) return
      await saveTransaction(tx)
      onOpenChange(false)
      push({
        title: editTx ? 'Opération mise à jour' : 'Opération enregistrée',
        description: `${tx.type.replace('_', ' ')} du ${formatDate(tx.date, 'fr')}`,
        tone: 'success',
      })
    } finally {
      setBusy(false)
    }
  }

  const previewFlow: number = (() => {
    const qty = parseNum(form.quantity) ?? 0
    const price = parseNum(form.price) ?? 0
    const fees = parseNum(form.fees) ?? 0
    const taxes = parseNum(form.taxes) ?? 0
    const amount = parseNum(form.amount) ?? 0
    switch (form.type) {
      case 'ACHAT':
      case 'SOUSCRIPTION':
      case 'AUGMENTATION_CAPITAL':
        return -(qty * price + fees + taxes)
      case 'VENTE':
      case 'RACHAT':
        return qty * price - fees - taxes
      case 'DIVIDENDE':
      case 'COUPON':
        return amount - taxes
      case 'DEPOT':
        return amount
      case 'RETRAIT':
      case 'FRAIS':
        return -amount
      default:
        return 0
    }
  })()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent sheet>
        <DialogHeader>
          <DialogTitle>{editTx ? t('common.edit') : t('ops.add')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="tx-type" required>
                  {t('ops.kind')}
                </Label>
                <Select
                  id="tx-type"
                  value={form.type}
                  onChange={(e) => set('type', e.target.value as TransactionType)}
                >
                  {TYPE_GROUPS.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.types.map((ty) => (
                        <option key={ty} value={ty}>
                          {ty.replace('_', ' ')}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="tx-portfolio" required>
                  {t('common.portfolio')}
                </Label>
                <Select
                  id="tx-portfolio"
                  value={form.portfolioId}
                  onChange={(e) => set('portfolioId', e.target.value)}
                >
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {withInstrument ? (
              <div>
                <Label htmlFor="tx-instrument" required>
                  {form.type === 'SOUSCRIPTION' || form.type === 'RACHAT' ? t('opcvm.fund') : 'Valeur'}
                </Label>
                <Select
                  id="tx-instrument"
                  value={form.instrumentId}
                  onChange={(e) => set('instrumentId', e.target.value)}
                  required
                >
                  <option value="">— Choisir —</option>
                  {instrumentOptions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.ticker})
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="tx-date" required>
                  {t('ops.dateLabel')}
                </Label>
                <Input
                  id="tx-date"
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => set('date', e.target.value)}
                />
              </div>

              {isCash || INCOME_TYPES.includes(form.type) ? (
                <div>
                  <Label htmlFor="tx-amount" required>
                    {t('common.amount')} (MAD)
                  </Label>
                  <Input
                    id="tx-amount"
                    inputMode="decimal"
                    required
                    placeholder="0,00"
                    value={form.amount}
                    onChange={(e) => set('amount', e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="tx-qty" required={form.type !== 'SPLIT'}>
                    {isEvent && form.type === 'SPLIT' ? 'Ratio (2 = « 2 pour 1 »)' : t('common.quantity')}
                  </Label>
                  <Input
                    id="tx-qty"
                    inputMode="decimal"
                    required={form.type !== 'SPLIT'}
                    placeholder={form.type === 'SPLIT' ? '2' : '0'}
                    value={form.quantity}
                    onChange={(e) => set('quantity', e.target.value)}
                  />
                </div>
              )}

              {!isCash && !isEvent ? (
                <>
                  <div>
                    <Label htmlFor="tx-price" required>
                      {form.type === 'SOUSCRIPTION' || form.type === 'RACHAT'
                        ? `${t('common.price')} / VL (MAD)`
                        : `${t('common.price')} (MAD)`}
                    </Label>
                    <Input
                      id="tx-price"
                      inputMode="decimal"
                      required
                      placeholder="0,00"
                      value={form.price}
                      onChange={(e) => set('price', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tx-fees">{t('common.fees')} (MAD)</Label>
                    <Input
                      id="tx-fees"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.fees}
                      onChange={(e) => set('fees', e.target.value)}
                    />
                  </div>
                </>
              ) : null}

              {!isEvent ? (
                <div>
                  <Label htmlFor="tx-taxes">
                    {INCOME_TYPES.includes(form.type) ? 'Retenue à la source (MAD)' : `${t('common.taxes')} (MAD)`}
                  </Label>
                  <Input
                    id="tx-taxes"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={form.taxes}
                    onChange={(e) => set('taxes', e.target.value)}
                  />
                </div>
              ) : null}
            </div>

            <div>
              <Label htmlFor="tx-comment">{t('common.comment')}</Label>
              <Textarea
                id="tx-comment"
                rows={2}
                placeholder="Ordre passé via ma banque en ligne…"
                value={form.comment}
                onChange={(e) => set('comment', e.target.value)}
              />
            </div>

            {previewFlow !== 0 ? (
              <div className="flex items-center justify-between rounded-xl border border-border bg-anthracite-50 px-4 py-3 dark:bg-anthracite-900/40">
                <span className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
                  {t('ops.cashFlow')}
                </span>
                <span className={cn('text-base font-bold tabular', signClass(previewFlow))}>
                  <Money value={previewFlow} hideMaskable reveal />
                </span>
              </div>
            ) : null}

            {settings ? (
              <p className="text-[11px] text-muted">
                Frais par défaut : {settings.defaultFeePct} % (min. {settings.defaultFeeMin} MAD) —
                modifiables dans {t('settings.title')}.
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              <Check /> {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function emptyForm(portfolioId: string): TxFormState {
  return {
    type: 'ACHAT',
    portfolioId,
    instrumentId: '',
    date: todayISO(),
    quantity: '',
    price: '',
    fees: '',
    taxes: '',
    amount: '',
    comment: '',
  }
}

/* ------------------------------------------------------------------ */
/* Import CSV                                                          */
/* ------------------------------------------------------------------ */

const CSV_MODEL_HEADERS = [
  'date',
  'type',
  'valeur',
  'quantite',
  'prix',
  'frais',
  'taxes',
  'montant',
  'commentaire',
]

const MAPPING_FIELDS = [
  { value: '', label: '— Ignorer —' },
  { value: 'date', label: 'Date' },
  { value: 'type', label: 'Nature' },
  { value: 'instrument', label: 'Valeur / Fonds' },
  { value: 'quantity', label: 'Quantité / Parts' },
  { value: 'price', label: 'Prix / VL' },
  { value: 'fees', label: 'Frais' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'amount', label: 'Montant' },
  { value: 'comment', label: 'Commentaire' },
] as const

type MappingField = (typeof MAPPING_FIELDS)[number]['value']

/** Devine le mapping à partir des en-têtes du fichier */
function guessMapping(headers: string[]): MappingField[] {
  return headers.map((h) => {
    const s = h.toLowerCase()
    if (s.includes('date')) return 'date'
    if (s.includes('type') || s.includes('nature') || s.includes('op')) return 'type'
    if (s.includes('isin') || s.includes('valeur') || s.includes('titre') || s.includes('fonds') || s.includes('libelle'))
      return 'instrument'
    if (s.includes('qty') || s.includes('quant') || s.includes('part')) return 'quantity'
    if (s.includes('cours') || s.includes('prix') || s.includes('vl') || s.includes('price')) return 'price'
    if (s.includes('frais') || s.includes('comm')) return 'fees'
    if (s.includes('tax') || s.includes('retenu') || s.includes('droit')) return 'taxes'
    if (s.includes('montant') || s.includes('amount') || s.includes('total')) return 'amount'
    if (s.includes('comment') || s.includes('note')) return 'comment'
    return ''
  })
}

function normalizeType(raw: string): TransactionType | null {
  const s = raw
    .trim()
    .toUpperCase()
    .replace(/[éèê]/g, 'e')
    .replace(/[\s-]+/g, '_')
  const aliases: Record<string, TransactionType> = {
    ACHAT: 'ACHAT',
    BUY: 'ACHAT',
    SOUSCRIPTION: 'SOUSCRIPTION',
    VENTE: 'VENTE',
    SELL: 'VENTE',
    RACHAT: 'RACHAT',
    DIVIDENDE: 'DIVIDENDE',
    DIVIDEND: 'DIVIDENDE',
    COUPON: 'COUPON',
    DEPOT: 'DEPOT',
    VERSEMENT: 'DEPOT',
    RETRAIT: 'RETRAIT',
    FRAIS: 'FRAIS',
    SPLIT: 'SPLIT',
    BONUS: 'ATTRIBUTION_GRATUITE',
    ATTRIBUTION_GRATUITE: 'ATTRIBUTION_GRATUITE',
    AUGMENTATION_CAPITAL: 'AUGMENTATION_CAPITAL',
  }
  return aliases[s] ?? null
}

function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const t = useT()
  const { activeId, portfolios, instrumentById, saveTransaction } = useStore()
  const { push } = useToast()

  const [fileName, setFileName] = React.useState('')
  const [headers, setHeaders] = React.useState<string[]>([])
  const [rows, setRows] = React.useState<string[][]>([])
  const [mapping, setMapping] = React.useState<MappingField[]>([])
  const [portfolioId, setPortfolioId] = React.useState(activeId)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setFileName('')
      setHeaders([])
      setRows([])
      setMapping([])
    } else {
      setPortfolioId(activeId === 'all' ? portfolios[0]?.id ?? '' : activeId)
    }
  }, [open, activeId, portfolios])

  async function onFile(file: File) {
    const text = await file.text()
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '')
    if (lines.length < 2) return
    const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
    const parsed = lines.map((l) => parseCsvLine(l, sep))
    setFileName(file.name)
    setHeaders(parsed[0])
    setRows(parsed.slice(1))
    setMapping(guessMapping(parsed[0]))
  }

  /** Résout un identifiant de valeur depuis une cellule (ticker, ISIN ou nom) */
  function resolveInstrument(raw: string): string | null {
    const s = raw.trim().toLowerCase()
    if (!s) return null
    for (const inst of instrumentById.values()) {
      if (inst.id.toLowerCase() === s || inst.ticker.toLowerCase() === s) return inst.id
      if (inst.isin?.toLowerCase() === s) return inst.id
    }
    for (const inst of instrumentById.values()) {
      if (inst.name.toLowerCase().includes(s)) return inst.id
    }
    return null
  }

  async function doImport() {
    setBusy(true)
    let ok = 0
    let skipped = 0
    try {
      for (const row of rows) {
        const get = (field: MappingField) => {
          const idx = mapping.indexOf(field)
          return idx >= 0 ? (row[idx] ?? '') : ''
        }
        const type = normalizeType(get('type'))
        const date = get('date')
        if (!type || !date) {
          skipped++
          continue
        }
        const instrumentId = needsInstrument(type) ? resolveInstrument(get('instrument')) : null
        if (needsInstrument(type) && !instrumentId) {
          skipped++
          continue
        }
        await saveTransaction({
          id: '',
          portfolioId,
          instrumentId,
          type,
          date: date.slice(0, 10),
          quantity: parseNum(get('quantity')),
          price: parseNum(get('price')),
          fees: parseNum(get('fees')),
          taxes: parseNum(get('taxes')),
          amount: parseNum(get('amount')),
          comment: get('comment') || undefined,
          createdAt: new Date().toISOString(),
        })
        ok++
      }
      onOpenChange(false)
      push({
        title: `${ok} opération(s) importée(s)`,
        description: skipped > 0 ? `${skipped} ligne(s) ignorée(s) (date ou nature manquante).` : undefined,
        tone: skipped > 0 ? 'warning' : 'success',
      })
    } finally {
      setBusy(false)
    }
  }

  function downloadModel() {
    downloadText(
      'modele-import-operations.csv',
      `${CSV_MODEL_HEADERS.join(';')}\n2026-01-15;ACHAT;ATW;20;680,50;25;1,20;;Ordre du 15/01\n2026-03-20;DIVIDENDE;IAM;;;5;92,25;;Dividende 2025\n2026-04-02;DEPOT;;;;;;;50000;;Versement\n`,
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('ops.import')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-anthracite-50 dark:hover:bg-anthracite-800">
              <FileUp className="h-4 w-4" />
              {t('ops.importFile')}
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onFile(f)
                }}
              />
            </label>
            <Button variant="ghost" size="sm" onClick={downloadModel}>
              <Download /> {t('ops.downloadModel')}
            </Button>
          </div>

          {fileName ? (
            <p className="text-xs text-muted">
              Fichier : <span className="font-medium text-ink">{fileName}</span> · {rows.length} ligne(s)
              détectée(s)
            </p>
          ) : (
            <Alert variant="info">
              Sélectionnez un fichier CSV exporté de votre banque ou d'un tableur. Le séparateur « ; »
              ou « , » est détecté automatiquement, les guillemets sont pris en charge.
            </Alert>
          )}

          {headers.length > 0 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="import-portfolio">{t('common.portfolio')}</Label>
                  <Select
                    id="import-portfolio"
                    value={portfolioId}
                    onChange={(e) => setPortfolioId(e.target.value)}
                  >
                    {portfolios.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-anthracite-500">
                  {t('ops.mapping')}
                </p>
                <div className="space-y-2">
                  {headers.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-36 truncate text-xs font-medium text-anthracite-600 dark:text-anthracite-300">
                        {h || `Colonne ${i + 1}`}
                      </span>
                      <Select
                        aria-label={`Mapping colonne ${h}`}
                        value={mapping[i] ?? ''}
                        onChange={(e) =>
                          setMapping((m) => {
                            const next = [...m]
                            next[i] = e.target.value as MappingField
                            return next
                          })
                        }
                      >
                        {MAPPING_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {rows.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-anthracite-50 dark:bg-anthracite-900/40">
                      <tr>
                        {headers.map((h, i) => (
                          <th
                            key={i}
                            className="whitespace-nowrap px-2 py-1.5 text-start font-semibold text-anthracite-600 dark:text-anthracite-300"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          {r.map((c, j) => (
                            <td key={j} className="whitespace-nowrap px-2 py-1.5 text-anthracite-600 dark:text-anthracite-300">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={doImport} disabled={busy || rows.length === 0}>
            <Check /> Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Page principale                                                     */
/* ------------------------------------------------------------------ */

export default function OperationsPage() {
  const t = useT()
  const { locale } = useI18n()
  const { transactions, portfolios, instrumentById, loading, removeTransaction } = useStore()
  const { push } = useToast()

  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('all')
  const [portfolioFilter, setPortfolioFilter] = React.useState('all')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [txDialog, setTxDialog] = React.useState(false)
  const [importDialog, setImportDialog] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Transaction | null>(null)
  const [editTarget, setEditTarget] = React.useState<Transaction | null>(null)

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactions
      .filter((tx) => {
        const inst = tx.instrumentId ? instrumentById.get(tx.instrumentId) : null
        const matchQ =
          !q ||
          (inst?.name.toLowerCase().includes(q) ?? false) ||
          (inst?.ticker.toLowerCase().includes(q) ?? false) ||
          (tx.comment ?? '').toLowerCase().includes(q)
        const matchT = typeFilter === 'all' || tx.type === typeFilter
        const matchP = portfolioFilter === 'all' || tx.portfolioId === portfolioFilter
        const matchFrom = !from || tx.date >= from
        const matchTo = !to || tx.date <= to
        return matchQ && matchT && matchP && matchFrom && matchTo
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1
        return (b.createdAt || '').localeCompare(a.createdAt || '')
      })
  }, [transactions, instrumentById, search, typeFilter, portfolioFilter, from, to])

  const totals = React.useMemo(() => {
    const inSum = filtered.reduce((s, tx) => s + Math.max(0, cashFlowOf(tx)), 0)
    const outSum = filtered.reduce((s, tx) => s + Math.max(0, -cashFlowOf(tx)), 0)
    const fees = filtered.reduce((s, tx) => s + (tx.fees ?? 0) + (tx.taxes ?? 0), 0)
    return { inSum, outSum, net: inSum - outSum, fees }
  }, [filtered])

  const portfolioName = React.useCallback(
    (id: string) => portfolios.find((p) => p.id === id)?.name ?? id,
    [portfolios],
  )

  function exportCsv() {
    downloadCsv(
      'journal-operations',
      [
        'Date',
        'Portefeuille',
        'Nature',
        'Valeur',
        'Quantité',
        'Prix (MAD)',
        'Frais (MAD)',
        'Taxes (MAD)',
        'Montant (MAD)',
        'Flux (MAD)',
        'Commentaire',
      ],
      filtered.map((tx) => {
        const inst = tx.instrumentId ? instrumentById.get(tx.instrumentId) : null
        return [
          tx.date,
          portfolioName(tx.portfolioId),
          tx.type.replace('_', ' '),
          inst ? `${inst.name} (${inst.ticker})` : '—',
          tx.quantity ?? '',
          tx.price ?? '',
          tx.fees ?? '',
          tx.taxes ?? '',
          tx.amount ?? amountOf(tx),
          cashFlowOf(tx).toFixed(2),
          tx.comment ?? '',
        ]
      }),
    )
    push({ title: 'Export CSV généré', description: `${filtered.length} opération(s)`, tone: 'success' })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await removeTransaction(deleteTarget.id)
    push({
      title: 'Opération supprimée',
      description: 'La modification a été consignée dans le journal d’audit.',
      tone: 'success',
    })
    setDeleteTarget(null)
  }

  return (
    <>
      <PageHeader
        title={t('ops.title')}
        description={`${filtered.length} opération(s) · ${t('app.disclaimer')}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportDialog(true)}>
              <FileUp /> {t('ops.import')}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={printPdf} className="hidden sm:inline-flex">
              {t('common.print')}
            </Button>
            <Button size="sm" onClick={() => setTxDialog(true)}>
              <Plus /> {t('ops.add')}
            </Button>
          </>
        }
      />

      {/* Cartes de synthèse */}
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
              Entrées filtrées
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-lg font-bold text-gain-600 tabular">
              <ArrowDownToLine className="h-4 w-4" />
              <Money value={totals.inSum} hideMaskable reveal />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
              Sorties filtrées
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-lg font-bold text-loss-600 tabular">
              <ArrowUpFromLine className="h-4 w-4" />
              <Money value={totals.outSum} hideMaskable reveal />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
              Flux net
            </p>
            <p className={`mt-1 text-lg font-bold tabular ${signClass(totals.net)}`}>
              <Money value={totals.net} hideMaskable reveal />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
              Frais & taxes (filtre)
            </p>
            <p className="mt-1 text-lg font-bold text-ink tabular">
              <Money value={totals.fees} hideMaskable reveal />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card className="mb-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-anthracite-400" />
            <Input
              className="ps-9"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('common.search')}
            />
          </div>
          <Select
            aria-label={t('common.type')}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">Toutes natures</option>
            {ALL_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {ty.replace('_', ' ')}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t('common.portfolio')}
            value={portfolioFilter}
            onChange={(e) => setPortfolioFilter(e.target.value)}
          >
            <option value="all">{t('common.all')} — {t('common.portfolio')}</option>
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <div>
            <Label htmlFor="ops-from" className="sr-only">
              {t('common.from')}
            </Label>
            <Input
              id="ops-from"
              type="date"
              aria-label={t('common.from')}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ops-to" className="sr-only">
              {t('common.to')}
            </Label>
            <Input
              id="ops-to"
              type="date"
              aria-label={t('common.to')}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <Card>
          <CardContent>
            <SkeletonRows rows={8} />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucune opération"
          description="Ajoutez vos achats, ventes, dividendes et versements pour construire l'historique de votre patrimoine. Vous pouvez aussi importer un CSV exporté de votre banque."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setTxDialog(true)}>
                <Plus /> {t('ops.add')}
              </Button>
              <Button variant="outline" onClick={() => setImportDialog(true)}>
                <FileUp /> {t('ops.import')}
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* Desktop */}
          <Card className="hidden p-0 md:block">
            <Table>
              <THead>
                <TR>
                  <TH>{t('common.date')}</TH>
                  <TH>{t('common.portfolio')}</TH>
                  <TH>{t('common.type')}</TH>
                  <TH>Valeur / Fonds</TH>
                  <TH align="end">{t('common.quantity')}</TH>
                  <TH align="end">{t('common.price')}</TH>
                  <TH align="end">{t('common.fees')}</TH>
                  <TH align="end">{t('common.taxes')}</TH>
                  <TH align="end">Flux</TH>
                  <TH>{t('common.comment')}</TH>
                  <TH align="end" className="no-print" />
                </TR>
              </THead>
              <TBody>
                {filtered.map((tx) => {
                  const inst = tx.instrumentId ? instrumentById.get(tx.instrumentId) : null
                  const flow = cashFlowOf(tx)
                  return (
                    <TR key={tx.id}>
                      <TD className="whitespace-nowrap text-xs">{formatDate(tx.date, locale)}</TD>
                      <TD className="text-xs text-muted">{portfolioName(tx.portfolioId)}</TD>
                      <TD>
                        <Badge variant={TYPE_BADGE[tx.type] ?? 'secondary'}>
                          {tx.type.replace('_', ' ')}
                        </Badge>
                      </TD>
                      <TD>
                        {inst ? (
                          <Link
                            to={inst.type === 'OPCVM' ? `/opcvm/${inst.id}` : `/actions/${inst.id}`}
                            className="font-medium text-ink hover:text-brand-700"
                          >
                            {inst.name}
                            <span className="block text-[11px] text-muted">{inst.ticker}</span>
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TD>
                      <TD align="end">
                        {tx.quantity !== undefined
                          ? formatNumber(tx.quantity, {
                              locale,
                              decimals: tx.type === 'SPLIT' ? 2 : 0,
                            })
                          : '—'}
                      </TD>
                      <TD align="end">
                        {tx.price !== undefined ? formatNumber(tx.price, { locale, decimals: 3 }) : '—'}
                      </TD>
                      <TD align="end">
                        {tx.fees ? formatNumber(tx.fees, { locale, decimals: 2 }) : '—'}
                      </TD>
                      <TD align="end">
                        {tx.taxes ? formatNumber(tx.taxes, { locale, decimals: 2 }) : '—'}
                      </TD>
                      <TD align="end">
                        {flow !== 0 ? (
                          <span className={signClass(flow)}>
                            <Money value={flow} hideMaskable reveal />
                          </span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </TD>
                      <TD className="max-w-40">
                        <span className="block truncate text-xs text-muted" title={tx.comment}>
                          {tx.comment ?? ''}
                        </span>
                      </TD>
                      <TD align="end" className="no-print">
                        <Button
                          variant="ghost"
                          size="iconSm"
                          aria-label={t('common.edit')}
                          title={t('common.edit')}
                          onClick={() => {
                            setEditTarget(tx)
                            setTxDialog(true)
                          }}
                        >
                          <PencilLine className="text-anthracite-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="iconSm"
                          aria-label={t('common.delete')}
                          title={t('ops.confirmDelete')}
                          onClick={() => setDeleteTarget(tx)}
                        >
                          <Trash2 className="text-anthracite-400" />
                        </Button>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </Card>

          {/* Mobile */}
          <div className="grid gap-2 md:hidden">
            {filtered.map((tx) => {
              const inst = tx.instrumentId ? instrumentById.get(tx.instrumentId) : null
              const flow = cashFlowOf(tx)
              return (
                <Card key={tx.id} className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {inst?.name ?? t('ops.noPortfolio')}
                      </p>
                      <p className="text-[11px] text-muted">
                        {formatDate(tx.date, locale)} · {portfolioName(tx.portfolioId)}
                      </p>
                    </div>
                    <Badge variant={TYPE_BADGE[tx.type] ?? 'secondary'}>
                      {tx.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                    <div className="text-xs text-muted">
                      {tx.quantity !== undefined
                        ? `${formatNumber(tx.quantity, { locale, decimals: 0 })} × ${
                            tx.price !== undefined ? formatNumber(tx.price, { locale, decimals: 2 }) : '—'
                          }`
                        : tx.amount !== undefined
                          ? formatNumber(tx.amount, { locale, decimals: 2 })
                          : '—'}{' '}
                      MAD
                    </div>
                    <div className="flex items-center gap-1">
                      {flow !== 0 ? (
                        <span className={cn('text-sm font-bold tabular', signClass(flow))}>
                          <Money value={flow} hideMaskable reveal />
                        </span>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="iconSm"
                        aria-label={t('common.edit')}
                        onClick={() => {
                          setEditTarget(tx)
                          setTxDialog(true)
                        }}
                      >
                        <PencilLine className="h-4 w-4 text-anthracite-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        aria-label={t('common.delete')}
                        onClick={() => setDeleteTarget(tx)}
                      >
                        <Trash2 className="h-4 w-4 text-anthracite-400" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          <p className="mt-3 text-[11px] text-muted">
            {t('ops.audit')} : chaque création, modification et suppression d'opération est horodatée
            et rattachée à votre compte (voir le schéma Supabase).
          </p>
        </>
      )}

      {/* Dialogs */}
      <TxDialog
        open={txDialog}
        onOpenChange={(v) => {
          setTxDialog(v)
          if (!v) setEditTarget(null)
        }}
        editTx={editTarget}
      />
      <ImportDialog open={importDialog} onOpenChange={setImportDialog} />

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('ops.confirmDelete')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {deleteTarget ? (
              <div className="space-y-2 text-sm">
                <p>
                  <Badge variant={TYPE_BADGE[deleteTarget.type] ?? 'secondary'}>
                    {deleteTarget.type.replace('_', ' ')}
                  </Badge>
                </p>
                <p className="text-anthracite-600 dark:text-anthracite-300">
                  {deleteTarget.instrumentId
                    ? instrumentById.get(deleteTarget.instrumentId)?.name ?? deleteTarget.instrumentId
                    : t('ops.noPortfolio')}{' '}
                  · {formatDate(deleteTarget.date, locale)}
                </p>
                <Alert variant="warning">
                  Cette opération participera au recalcul des positions et des performances du
                  portefeuille. L'action est irréversible.
                </Alert>
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 /> {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
