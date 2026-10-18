import * as React from 'react'
import {
  Calculator,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Landmark,
  Printer,
  ReceiptText,
  Save,
  Wallet,
} from 'lucide-react'
import { EmptyState, PageHeader, SkeletonCards } from '@/components/shared/page'
import { StatCard } from '@/components/shared/stat-card'
import { Money } from '@/components/shared/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { summarizeTaxYear, summarizeYear } from '@/domain/calc'
import type { TaxSettings } from '@/domain/types'
import { useI18n, useT } from '@/i18n'
import { formatPct, signClass } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useStore } from '@/state/store'

/* ------------------------------------------------------------------ */
/* Valeurs de repli (settings absents) — alignées sur le jeu de démo   */
/* ------------------------------------------------------------------ */
const FALLBACK_TAX: TaxSettings = {
  capitalGainsRate: 10,
  dividendWithholdingRate: 15,
  exemptionThreshold: 0,
  fiscalYear: new Date().getFullYear(),
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

interface TaxForm {
  capitalGainsRate: string
  dividendWithholdingRate: string
  exemptionThreshold: string
  fiscalYear: string
}

function taxToForm(tax: TaxSettings): TaxForm {
  return {
    capitalGainsRate: String(tax.capitalGainsRate),
    dividendWithholdingRate: String(tax.dividendWithholdingRate),
    exemptionThreshold: String(tax.exemptionThreshold),
    fiscalYear: String(tax.fiscalYear),
  }
}

function sameForm(a: TaxForm, b: TaxForm): boolean {
  return (
    a.capitalGainsRate === b.capitalGainsRate &&
    a.dividendWithholdingRate === b.dividendWithholdingRate &&
    a.exemptionThreshold === b.exemptionThreshold &&
    a.fiscalYear === b.fiscalYear
  )
}

function parseNum(raw: string): number {
  const n = Number(String(raw).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Nombre FR pour l'Excel (virgule décimale, sans séparateur de milliers) */
function csvNumber(v: number): string {
  const n = Number.isFinite(v) ? v : 0
  return n.toFixed(2).replace('.', ',')
}

/** Export CSV : BOM UTF-8, séparateur « ; » — compatible Excel FR */
function exportCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>,
): void {
  const cell = (v: string | number): string => {
    const s = String(v)
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const content = [headers, ...rows]
    .map((row) => row.map(cell).join(';'))
    .join('\r\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/* ------------------------------------------------------------------ */
/* Champ de paramétrage contrôlé                                      */
/* ------------------------------------------------------------------ */

function TaxField({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  inputMode,
  disabled,
  onChange,
}: {
  id: string
  label: string
  hint: string
  value: string
  min: number
  max: number
  step: number
  inputMode: 'decimal' | 'numeric'
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="w-full">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode={inputMode}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(e.target.value)}
      />
      <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
        {hint}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function FiscalitePage() {
  const t = useT()
  const { locale } = useI18n()
  const { push } = useToast()
  const { transactions, settings, updateSettings, loading } = useStore()

  const tax: TaxSettings = settings?.tax ?? FALLBACK_TAX
  const taxKey = `${tax.capitalGainsRate}|${tax.dividendWithholdingRate}|${tax.exemptionThreshold}|${tax.fiscalYear}`

  const mention = t(
    'tax.ratesHint',
    'Les taux évoluent avec les lois de finances : ils sont paramétrables',
  )

  /* --------------------------- état local --------------------------- */

  const [form, setForm] = React.useState<TaxForm>(() => taxToForm(tax))
  const [dirty, setDirty] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [year, setYear] = React.useState<number | null>(null)

  // Resynchronise le formulaire sur les paramètres enregistrés
  React.useEffect(() => {
    if (dirty) return
    setForm((prev) => {
      const next = taxToForm(tax)
      return sameForm(prev, next) ? prev : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxKey, dirty])

  /* ------------------------- calculs annuels ------------------------ */

  const summaries = React.useMemo(
    () => summarizeTaxYear(transactions, tax),
    [transactions, tax],
  )

  const availableYears = summaries.map((s) => s.year)
  const yearOptions = Array.from(
    new Set<number>([...availableYears, tax.fiscalYear]),
  ).sort((a, b) => b - a)

  const selectedYear = year ?? tax.fiscalYear
  const selected = React.useMemo(
    () => summarizeYear(transactions, tax, selectedYear),
    [transactions, tax, selectedYear],
  )

  const isEmpty = summaries.length === 0

  /* --------------------------- actions ------------------------------ */

  function handleField(key: keyof TaxForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  async function handleSave() {
    const rawYear = parseNum(form.fiscalYear)
    const next: TaxSettings = {
      capitalGainsRate: clamp(parseNum(form.capitalGainsRate), 0, 100),
      dividendWithholdingRate: clamp(parseNum(form.dividendWithholdingRate), 0, 100),
      exemptionThreshold: clamp(parseNum(form.exemptionThreshold), 0, 100_000_000),
      fiscalYear:
        rawYear >= 2000 && rawYear <= 2100 ? Math.round(rawYear) : tax.fiscalYear,
    }

    setSaving(true)
    try {
      await updateSettings({ tax: next })
      setDirty(false)
      if (next.fiscalYear !== tax.fiscalYear) setYear(null)
      push({
        tone: 'success',
        title: t('tax.toastSaved', 'Paramètres fiscaux enregistrés'),
        description: t(
          'tax.toastSavedDesc',
          'Les estimations de la page utilisent désormais ces taux.',
        ),
      })
    } catch {
      push({
        tone: 'error',
        title: t('tax.toastError', 'Enregistrement impossible'),
        description: t(
          'tax.toastErrorDesc',
          'Vérifiez votre connexion puis réessayez.',
        ),
      })
    } finally {
      setSaving(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  function handleExportCsv() {
    if (isEmpty) return
    const headers = [
      'Année',
      'Plus-values réalisées (MAD)',
      'Pertes (MAD)',
      'Assiette imposable (MAD)',
      'Impôt TPCVM (MAD)',
      'Dividendes bruts (MAD)',
      'Retenue dividendes (MAD)',
      'Coupons bruts (MAD)',
      'Retenue coupons (MAD)',
      'Total (MAD)',
    ]
    const rows = summaries.map((s) => [
      s.year,
      csvNumber(s.realizedGains),
      csvNumber(s.realizedLosses),
      csvNumber(s.taxableGains),
      csvNumber(s.capitalGainsTax),
      csvNumber(s.grossDividends),
      csvNumber(s.withheldDividends),
      csvNumber(s.grossCoupons),
      csvNumber(s.withheldCoupons),
      csvNumber(s.totalTax),
    ])
    const first = summaries[0]?.year ?? tax.fiscalYear
    const last = summaries[summaries.length - 1]?.year ?? tax.fiscalYear
    exportCsv(`recapitulatif-fiscalite-${first}-${last}.csv`, headers, rows)
    push({
      tone: 'success',
      title: t('tax.csvDone', 'Export CSV généré'),
      description: `${summaries.length} ${t('tax.csvLines', 'année(s) exportée(s)')}`,
    })
  }

  const rateCg = formatPct(tax.capitalGainsRate, { locale, decimals: 0, sign: false })
  const rateWh = formatPct(tax.dividendWithholdingRate, { locale, decimals: 0, sign: false })

  /* --------------------------- chargement --------------------------- */

  if (loading) {
    return (
      <>
        <PageHeader title={t('tax.title', 'Fiscalité')} description={mention} />
        <SkeletonCards count={4} />
      </>
    )
  }

  /* ----------------------------- rendu ------------------------------ */

  return (
    <>
      <PageHeader
        title={t('tax.title', 'Fiscalité')}
        description={mention}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="no-print"
              onClick={handlePrint}
            >
              <Printer />
              {t('common.print', 'Imprimer / PDF')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="no-print"
              disabled={isEmpty}
              onClick={handleExportCsv}
            >
              <Download />
              {t('tax.exportCsv', 'Export CSV')}
            </Button>
          </>
        }
      />

      {/* --------------------- 1. Paramétrage --------------------- */}
      <Card className="mb-5 no-print">
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>{t('tax.rates', 'Taux paramétrables (loi de finances)')}</CardTitle>
            <CardDescription className="mt-1">
              {t(
                'tax.settingsHint',
                'Ajustez les taux appliqués à vos estimations, puis enregistrez.',
              )}
            </CardDescription>
          </div>
          {dirty ? (
            <Badge variant="warning">{t('tax.unsaved', 'Modifications non enregistrées')}</Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <TaxField
              id="tax-cg-rate"
              label={t(
                'tax.capitalGainsRate',
                'Taux d’imposition des plus-values (TPCVM, %)',
              )}
              hint={t(
                'tax.cgHint',
                'Appliqué à l’assiette imposable de chaque année.',
              )}
              value={form.capitalGainsRate}
              min={0}
              max={100}
              step={0.5}
              inputMode="decimal"
              disabled={saving}
              onChange={(v) => handleField('capitalGainsRate', v)}
            />
            <TaxField
              id="tax-wh-rate"
              label={t(
                'tax.dividendRate',
                'Taux de retenue à la source sur dividendes / coupons (%)',
              )}
              hint={t(
                'tax.whHint',
                'Retenue estimée sur les revenus distribués.',
              )}
              value={form.dividendWithholdingRate}
              min={0}
              max={100}
              step={0.5}
              inputMode="decimal"
              disabled={saving}
              onChange={(v) => handleField('dividendWithholdingRate', v)}
            />
            <TaxField
              id="tax-threshold"
              label={t('tax.exemption', 'Seuil d’annulation annuel (MAD)')}
              hint={t(
                'tax.thresholdHint',
                'Déduit de la plus-value nette annuelle avant impôt.',
              )}
              value={form.exemptionThreshold}
              min={0}
              max={100_000_000}
              step={1000}
              inputMode="decimal"
              disabled={saving}
              onChange={(v) => handleField('exemptionThreshold', v)}
            />
            <TaxField
              id="tax-fiscal-year"
              label={t('tax.fiscalYear', 'Année fiscale')}
              hint={t(
                'tax.fiscalYearHint',
                'Année de référence du récapitulatif.',
              )}
              value={form.fiscalYear}
              min={2000}
              max={2100}
              step={1}
              inputMode="numeric"
              disabled={saving}
              onChange={(v) => handleField('fiscalYear', v)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl">
            {t(
              'tax.settingsNote',
              'Ces paramètres ne modifient que les estimations affichées ici : ils ne changent ni vos opérations enregistrées, ni votre situation fiscale réelle.',
            )}
          </p>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            aria-busy={saving}
          >
            <Save />
            {saving ? t('common.loading', 'Chargement…') : t('common.save', 'Enregistrer')}
          </Button>
        </CardFooter>
      </Card>

      {/* ---------------- 2. Récapitulatif annuel ----------------- */}
      <Card className="mb-5">
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>{t('tax.recap', 'Récapitulatif annuel')}</CardTitle>
            <CardDescription className="mt-1">
              {t(
                'tax.recapHint',
                'Opérations réalisées par année civile — sélectionnez une année pour la mettre en avant.',
              )}
            </CardDescription>
          </div>
          <div className="no-print w-full sm:w-44">
            <Label htmlFor="tax-year-select">{t('tax.year', 'Année')}</Label>
            <Select
              id="tax-year-select"
              value={String(selectedYear)}
              disabled={yearOptions.length === 0}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <EmptyState
              icon={<FileSpreadsheet className="h-5 w-5" />}
              title={t('tax.emptyTitle', 'Aucune opération imposable enregistrée')}
              description={t(
                'tax.emptyDesc',
                'Ajoutez des achats, ventes, dividendes ou coupons pour constituer votre récapitulatif annuel.',
              )}
            />
          ) : (
            <Table className="min-w-[54rem]">
              <caption className="pb-2 text-start text-xs text-muted">
                {t('tax.tableCaption', 'Cliquez sur une année pour la sélectionner.')}
              </caption>
              <THead>
                <TR>
                  <TH>{t('tax.year', 'Année')}</TH>
                  <TH align="end">{t('tax.colRealized', 'Plus-values réalisées')}</TH>
                  <TH align="end">{t('tax.colLosses', 'Pertes')}</TH>
                  <TH align="end">{t('tax.colTaxable', 'Assiette imposable')}</TH>
                  <TH align="end">{t('tax.colTax', 'Impôt TPCVM')}</TH>
                  <TH align="end">{t('tax.colGrossDiv', 'Dividendes bruts')}</TH>
                  <TH align="end">{t('tax.colWhDiv', 'Retenue dividendes')}</TH>
                  <TH align="end">{t('tax.colGrossCpn', 'Coupons bruts')}</TH>
                  <TH align="end">{t('tax.colWhCpn', 'Retenue coupons')}</TH>
                  <TH align="end">{t('common.total', 'Total')}</TH>
                </TR>
              </THead>
              <TBody>
                {summaries.map((s) => {
                  const active = s.year === selectedYear
                  return (
                    <TR
                      key={s.year}
                      className={cn(active && 'bg-brand-50/70 dark:bg-brand-950/40')}
                    >
                      <TD>
                        <button
                          type="button"
                          onClick={() => setYear(s.year)}
                          aria-current={active ? 'true' : undefined}
                          className={cn(
                            'rounded px-1.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40',
                            active
                              ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-300'
                              : 'text-anthracite-600 hover:bg-anthracite-100 hover:text-ink dark:text-anthracite-300 dark:hover:bg-anthracite-800',
                          )}
                        >
                          {s.year}
                        </button>
                      </TD>
                      <TD align="end">
                        <Money value={s.realizedGains} />
                      </TD>
                      <TD align="end">
                        <Money value={s.realizedLosses} className={signClass(s.realizedLosses)} />
                      </TD>
                      <TD align="end">
                        <Money value={s.taxableGains} />
                      </TD>
                      <TD align="end">
                        <Money value={s.capitalGainsTax} className="font-semibold" />
                      </TD>
                      <TD align="end">
                        <Money value={s.grossDividends} />
                      </TD>
                      <TD align="end">
                        <Money value={s.withheldDividends} />
                      </TD>
                      <TD align="end">
                        <Money value={s.grossCoupons} />
                      </TD>
                      <TD align="end">
                        <Money value={s.withheldCoupons} />
                      </TD>
                      <TD align="end">
                        <Money value={s.totalTax} className="font-semibold text-ink" />
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
              <TBody>
                <TR className="bg-anthracite-50 font-semibold dark:bg-anthracite-800/60">
                  <TD className="text-[11px] font-bold uppercase tracking-wide text-anthracite-600 dark:text-anthracite-300">
                    {`${t('common.total', 'Total')} ${selectedYear}`}
                  </TD>
                  <TD align="end">
                    <Money value={selected.realizedGains} />
                  </TD>
                  <TD align="end">
                    <Money
                      value={selected.realizedLosses}
                      className={signClass(selected.realizedLosses)}
                    />
                  </TD>
                  <TD align="end">
                    <Money value={selected.taxableGains} />
                  </TD>
                  <TD align="end">
                    <Money value={selected.capitalGainsTax} />
                  </TD>
                  <TD align="end">
                    <Money value={selected.grossDividends} />
                  </TD>
                  <TD align="end">
                    <Money value={selected.withheldDividends} />
                  </TD>
                  <TD align="end">
                    <Money value={selected.grossCoupons} />
                  </TD>
                  <TD align="end">
                    <Money value={selected.withheldCoupons} />
                  </TD>
                  <TD align="end">
                    <Money value={selected.totalTax} className="text-ink" />
                  </TD>
                </TR>
              </TBody>
            </Table>
          )}
        </CardContent>
        <CardFooter>
          {`${t('tax.thresholdLabel', 'Seuil d’annulation annuel')} : `}
          <Money value={tax.exemptionThreshold} className="font-semibold text-ink" />
          {` — ${t(
            'tax.thresholdNote',
            'il est déduit de la plus-value nette annuelle avant application du taux.',
          )}`}
        </CardFooter>
      </Card>

      {/* ------------- 3. Cartes de synthèse de l'année ------------ */}
      <section className="mb-5" aria-labelledby="tax-synth-title">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="tax-synth-title" className="text-sm font-semibold text-ink">
            {`${t('tax.synthesis', 'Synthèse de l’année')} ${selectedYear}`}
          </h2>
          <p className="text-xs text-muted">
            {t('tax.synthesisHint', 'Estimations calculées avec les taux enregistrés.')}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t('tax.gains', 'Impôt estimé sur plus-values (TPCVM)')}
            value={selected.capitalGainsTax}
            icon={<Landmark className="h-4 w-4" />}
            hint={`${t('tax.atRate', 'Taux retenu')} : ${rateCg}`}
          />
          <StatCard
            label={t('tax.cardDiv', 'Retenue sur dividendes')}
            value={selected.withheldDividends}
            icon={<Wallet className="h-4 w-4" />}
            hint={`${t('tax.atRate', 'Taux retenu')} : ${rateWh}`}
          />
          <StatCard
            label={t('tax.cardCpn', 'Retenue sur coupons')}
            value={selected.withheldCoupons}
            icon={<ReceiptText className="h-4 w-4" />}
            hint={`${t('tax.atRate', 'Taux retenu')} : ${rateWh}`}
          />
          <StatCard
            label={t('tax.cardTotal', 'Total estimé')}
            value={selected.totalTax}
            accent="brand"
            icon={<Calculator className="h-4 w-4" />}
            hint={`${t('tax.forYear', 'Année')} ${selectedYear}`}
          />
        </div>
      </section>

      {/* ---------------- 4. Repères pédagogiques ----------------- */}
      <section className="mb-5" aria-labelledby="tax-guide-title">
        <h2 id="tax-guide-title" className="mb-3 text-sm font-semibold text-ink">
          {t('tax.guide', 'Comprendre la fiscalité des placements')}
        </h2>
        <div className="space-y-3">
          <details className="card group overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {t('tax.q1', 'Qu’est-ce que la TPCVM ?')}
              <ChevronDown className="h-4 w-4 shrink-0 text-anthracite-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border px-4 py-3 text-xs leading-relaxed text-muted">
              <p>
                {t(
                  'tax.a1',
                  'La Taxe sur les Plus-values de Capitaux Mobiles (TPCVM) concerne les plus-values réalisées lors de la vente de valeurs mobilières (actions cotées, parts d’OPCVM, certains titres non cotés). Le taux en vigueur dépend de la loi de finances et peut varier selon la nature des titres et la durée de détention.',
                )}
              </p>
              <p className="mt-2">
                {t(
                  'tax.a1b',
                  'Ici, le taux appliqué est celui que vous avez paramétré : l’application le calcule sur la plus-value nette de l’année, après déduction du seuil et des moins-values constatées. Seule l’administration fiscale — ou un professionnel qualifié — peut confirmer le traitement applicable à votre situation.',
                )}
              </p>
            </div>
          </details>

          <details className="card group overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {t('tax.q2', 'Comment déclarer')}
              <ChevronDown className="h-4 w-4 shrink-0 text-anthracite-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border px-4 py-3 text-xs leading-relaxed text-muted">
              <p>
                {t(
                  'tax.a2',
                  'Les plus-values réalisées et les revenus de capitaux mobiliers figurent dans votre déclaration annuelle de revenus. Selon votre situation, des prélèvements ont pu être opérés à la source par votre intermédiaire (société de gestion, courtier, établissement teneur).',
                )}
              </p>
              <p className="mt-2">
                {t(
                  'tax.a2b',
                  'Conservez vos relevés d’opération et vos avis d’imposition : les montants proposés ici sont recalculés à partir de votre portefeuille et ne remplacent ni votre déclaration, ni les documents établis par vos intermédiaires. En cas de doute, adressez-vous à l’administration fiscale ou à un conseil.',
                )}
              </p>
            </div>
          </details>

          <details className="card group overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {t('tax.q3', 'Dividendes : retenue à la source')}
              <ChevronDown className="h-4 w-4 shrink-0 text-anthracite-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border px-4 py-3 text-xs leading-relaxed text-muted">
              <p>
                {t(
                  'tax.a3',
                  'Les dividendes et coupons versés au Maroc sont généralement soumis à une retenue à la source, prélevée à l’encaissement par l’intermédiaire qui verse le revenu. Le montant brut affiché ici provient de vos opérations enregistrées ; la retenue est recalculée au taux que vous avez paramétré.',
                )}
              </p>
              <p className="mt-2">
                {t(
                  'tax.a3b',
                  'Les exonérations, réductions ou abattements éventuels (notamment selon la durée de détention) relèvent de votre situation personnelle et ne sont pas simulés par l’application.',
                )}
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* ------------------- 5. Mention légale -------------------- */}
      <p className="rounded-xl border border-border bg-anthracite-50 px-3.5 py-3 text-xs leading-relaxed text-anthracite-600 dark:bg-anthracite-800/60 dark:text-anthracite-300">
        <strong className="font-semibold text-ink dark:text-anthracite-100">
          {t(
            'tax.legalMain',
            'Estimation à titre indicatif — ne remplace pas une déclaration fiscale.',
          )}
        </strong>{' '}
        {t(
          'tax.legalRest',
          'Patrimoine.ma n’est ni un conseiller fiscal, ni un intermédiaire financier : les montants sont recalculés à partir de vos opérations et des taux que vous avez saisis. Pour votre situation personnelle, consultez l’administration fiscale ou un professionnel qualifié.',
        )}
      </p>
    </>
  )
}
