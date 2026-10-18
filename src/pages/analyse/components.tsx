import * as React from 'react'
import { Coins } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/controls'
import { SortHeader, TBody, TD, TH, THead, Table, TR } from '@/components/ui/table'
import { Money } from '@/components/shared/money'
import { useI18n, useT } from '@/i18n'
import { formatPct, signClass } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ContributionRow } from '@/domain/types'

/* ------------------------------------------------------------------ */
/* Carte indicateur en pourcentage                                     */
/* ------------------------------------------------------------------ */

export function PctCard({
  label,
  value,
  hint,
  icon,
  signed = true,
}: {
  label: string
  /** Valeur en points de pourcentage (ex: 8.42 pour +8,42 %) — null affiche « — » */
  value: number | null
  hint?: React.ReactNode
  icon?: React.ReactNode
  signed?: boolean
}) {
  const { locale } = useI18n()
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
            {label}
          </p>
          {icon ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-anthracite-100 text-anthracite-500 dark:bg-anthracite-800">
              {icon}
            </span>
          ) : null}
        </div>
        <p
          className={cn(
            'text-2xl font-bold leading-none tabular',
            value === null ? 'text-anthracite-400' : signClass(value),
          )}
        >
          {value === null ? '—' : formatPct(value, { locale, decimals: 2, sign: signed })}
        </p>
        {hint ? <p className="text-xs leading-relaxed text-muted">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Carte monétaire signée                                              */
/* ------------------------------------------------------------------ */

export function SignedMoneyCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: number
  hint?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
            {label}
          </p>
          {icon ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-anthracite-100 text-anthracite-500 dark:bg-anthracite-800">
              {icon}
            </span>
          ) : null}
        </div>
        <Money
          value={value}
          className={cn('text-2xl font-bold leading-none', signClass(value))}
        />
        {hint ? <p className="text-xs leading-relaxed text-muted">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Carte revenus + rendement sur coût                                  */
/* ------------------------------------------------------------------ */

export function IncomeCard({
  label,
  value,
  yieldPct,
  yieldLabel,
  hint,
}: {
  label: string
  /** Revenus cumulés nets (dividendes + coupons) */
  value: number
  /** Rendement sur coût en points de pourcentage */
  yieldPct: number
  yieldLabel: string
  hint?: React.ReactNode
}) {
  const { locale } = useI18n()
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
            {label}
          </p>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-anthracite-100 text-anthracite-500 dark:bg-anthracite-800">
            <Coins className="h-4 w-4" />
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <Money value={value} className="text-2xl font-bold leading-none text-ink" />
          <span className={cn('text-sm font-bold tabular', signClass(yieldPct))}>
            {formatPct(yieldPct, { locale, decimals: 2 })}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          <span className={cn('font-semibold', signClass(yieldPct))}>{yieldLabel}</span>
          {hint ? <> · {hint}</> : null}
        </p>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Tableau de tri — contribution de chaque ligne                       */
/* ------------------------------------------------------------------ */

type ContribSortKey = 'contribution' | 'weight' | 'periodReturn' | 'name'

export function ContributionTable({ rows }: { rows: ContributionRow[] }) {
  const t = useT()
  const { locale } = useI18n()
  const [sort, setSort] = React.useState<{ key: ContribSortKey; dir: 'asc' | 'desc' }>({
    key: 'contribution',
    dir: 'desc',
  })

  const toggle = (key: ContribSortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' },
    )

  const sorted = React.useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name, 'fr') * dir
      return (a[sort.key] - b[sort.key]) * dir
    })
  }, [rows, sort])

  const total = rows.reduce((s, r) => s + r.contribution, 0)

  return (
    <Table>
      <THead>
        <TR>
          <SortHeader
            label={t('common.name', 'Ligne')}
            active={sort.key === 'name'}
            dir={sort.dir}
            onClick={() => toggle('name')}
          />
          <SortHeader
            label={t('common.share', 'Poids')}
            align="end"
            active={sort.key === 'weight'}
            dir={sort.dir}
            onClick={() => toggle('weight')}
          />
          <SortHeader
            label={t('perf.periodReturn', 'Rendement période')}
            align="end"
            active={sort.key === 'periodReturn'}
            dir={sort.dir}
            onClick={() => toggle('periodReturn')}
          />
          <SortHeader
            label={t('perf.contributionCol', 'Contribution (pts)')}
            align="end"
            active={sort.key === 'contribution'}
            dir={sort.dir}
            onClick={() => toggle('contribution')}
          />
        </TR>
      </THead>
      <TBody>
        {sorted.map((r) => (
          <TR key={r.instrumentId}>
            <TD>
              <span className="block max-w-[10rem] truncate text-sm font-semibold text-ink sm:max-w-none">
                {r.name}
              </span>
              <span className="block text-[11px] uppercase text-muted">{r.ticker}</span>
            </TD>
            <TD align="end">{formatPct(r.weight, { locale, decimals: 1, sign: false })}</TD>
            <TD align="end" className={signClass(r.periodReturn)}>
              {formatPct(r.periodReturn, { locale, decimals: 2 })}
            </TD>
            <TD align="end" className={cn('font-semibold', signClass(r.contribution))}>
              {r.contribution > 0 ? '+' : r.contribution < 0 ? '−' : ''}
              {Math.abs(r.contribution).toLocaleString('fr-FR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              pts
            </TD>
          </TR>
        ))}
        <TR className="bg-anthracite-50/70 dark:bg-anthracite-800/40">
          <TD className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
            {t('common.total', 'Total')}
          </TD>
          <TD align="end">—</TD>
          <TD align="end">—</TD>
          <TD align="end" className={cn('font-bold', signClass(total))}>
            {total > 0 ? '+' : total < 0 ? '−' : ''}
            {Math.abs(total).toLocaleString('fr-FR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            pts
          </TD>
        </TR>
      </TBody>
    </Table>
  )
}

/* ------------------------------------------------------------------ */
/* Tableau comparatif des rendements                                   */
/* ------------------------------------------------------------------ */

export interface CompareRow {
  key: string
  label: string
  sub?: string
  /** Rendement sur la période en points de pourcentage */
  value: number | null
  /** Écart vs portefeuille en points de pourcentage (null = « — ») */
  diff?: number | null
}

export function CompareTable({ rows }: { rows: CompareRow[] }) {
  const t = useT()
  const { locale } = useI18n()
  return (
    <Table>
      <THead>
        <TR>
          <TH>{t('common.name', 'Actif / indice')}</TH>
          <TH align="end">{t('perf.returnPeriod', 'Rendement sur la période')}</TH>
          <TH align="end">{t('perf.gapPortfolio', 'Écart vs portefeuille')}</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((r) => (
          <TR key={r.key}>
            <TD>
              <span className="block max-w-[14rem] truncate text-sm font-semibold text-ink">
                {r.label}
              </span>
              {r.sub ? <span className="block truncate text-[11px] text-muted">{r.sub}</span> : null}
            </TD>
            <TD align="end" className={r.value === null ? 'text-muted' : signClass(r.value)}>
              {r.value === null
                ? '—'
                : formatPct(r.value, { locale, decimals: 2 })}
            </TD>
            <TD align="end" className={r.diff == null ? 'text-muted' : signClass(r.diff)}>
              {r.diff == null ? '—' : formatPct(r.diff, { locale, decimals: 2 })}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  )
}

/* ------------------------------------------------------------------ */
/* Liste de concentration avec barres                                  */
/* ------------------------------------------------------------------ */

export function ConcentrationList({
  rows,
  threshold,
}: {
  rows: Array<{ instrumentId: string; name: string; weight: number }>
  threshold: number
}) {
  const { locale } = useI18n()
  if (rows.length === 0) return null
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const over = r.weight > threshold
        return (
          <li key={r.instrumentId}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium text-ink">{r.name}</span>
              <span
                className={cn(
                  'shrink-0 tabular text-sm font-semibold',
                  over ? 'text-amber-700 dark:text-amber-400' : 'text-anthracite-600 dark:text-anthracite-300',
                )}
              >
                {formatPct(r.weight, { locale, decimals: 1, sign: false })}
              </span>
            </div>
            <Progress
              value={Math.max(0, Math.min(100, r.weight))}
              className="mt-1.5"
              barClassName={over ? 'bg-amber-500' : 'bg-anthracite-400 dark:bg-anthracite-500'}
            />
          </li>
        )
      })}
    </ul>
  )
}
