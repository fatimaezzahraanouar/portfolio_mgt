import * as React from 'react'
import { Link } from 'react-router-dom'
import { Download, PieChart, Plus, Search } from 'lucide-react'
import { useI18n, useT } from '@/i18n'
import { useStore } from '@/state/store'
import type { OpcvmCategory, Position } from '@/domain/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { EmptyState, PageHeader, SkeletonRows } from '@/components/shared/page'
import { Delta, StatCard } from '@/components/shared/stat-card'
import { Money } from '@/components/shared/money'
import { PortfolioTabs } from '@/components/shared/portfolio-tabs'
import { downloadCsv } from '@/lib/export'
import { formatDate, formatNumber, formatPct, signClass } from '@/lib/format'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<OpcvmCategory, string> = {
  ACTIONS: 'Actions',
  OBLIGATAIRE_CT: 'Obligataire court terme',
  OBLIGATAIRE_MLT: 'Obligataire moyen-long terme',
  MONETAIRE: 'Monétaire',
  DIVERSIFIE: 'Diversifié',
  CONTRACTUEL: 'Contractuel',
}

const CATEGORY_BADGE: Record<OpcvmCategory, 'default' | 'secondary' | 'gain' | 'warning'> = {
  ACTIONS: 'gain',
  OBLIGATAIRE_CT: 'secondary',
  OBLIGATAIRE_MLT: 'secondary',
  MONETAIRE: 'default',
  DIVERSIFIE: 'warning',
  CONTRACTUEL: 'default',
}

function FundCard({ p }: { p: Position }) {
  const { locale } = useI18n()
  return (
    <Link
      to={`/opcvm/${p.instrumentId}`}
      className="block rounded-xl border border-border bg-card p-3.5 shadow-sm transition-colors hover:border-brand-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
          <p className="text-[11px] text-muted">{p.category ? CATEGORY_LABELS[p.category] : '—'}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {formatPct(p.weight, { locale, decimals: 1, sign: false })}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] uppercase text-anthracite-500">Parts</p>
          <p className="text-sm font-bold tabular">{formatNumber(p.quantity, { locale, decimals: 2 })}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-anthracite-500">VL moy. d'achat</p>
          <p className="text-sm font-bold tabular">{formatNumber(p.pru, { locale, decimals: 3 })}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-anthracite-500">Dernière VL</p>
          <p className="text-sm font-bold tabular">{formatNumber(p.lastPrice, { locale, decimals: 3 })}</p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between border-t border-border pt-2.5">
        <div>
          <p className="text-[10px] uppercase text-anthracite-500">Valorisation</p>
          <Money value={p.marketValue} className="text-base font-bold text-ink" />
        </div>
        <div className="text-end">
          <p className="text-[10px] uppercase text-anthracite-500">+/- value</p>
          <p className={cn('text-sm font-bold tabular', signClass(p.unrealizedPnl))}>
            <Money value={p.unrealizedPnl} reveal hideMaskable />
          </p>
          <Delta value={p.unrealizedPnlPct} iconSize="xs" className="text-[11px]" />
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted">VL au {formatDate(p.priceDate, locale)} · publication J / J+1</p>
    </Link>
  )
}

export default function OpcvmPage() {
  const t = useT()
  const { locale } = useI18n()
  const { snapshot, loading, instrumentById, activeId } = useStore()

  const [search, setSearch] = React.useState('')
  const [category, setCategory] = React.useState('all')

  const rows = React.useMemo(
    () => (snapshot?.positions ?? []).filter((p) => p.type === 'OPCVM'),
    [snapshot],
  )

  const categories = React.useMemo(
    () => [...new Set(rows.map((r) => r.category).filter(Boolean))] as OpcvmCategory[],
    [rows],
  )

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      const inst = instrumentById.get(r.instrumentId)
      const matchQ =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (inst?.isin ?? '').toLowerCase().includes(q) ||
        (inst?.managementCompany ?? '').toLowerCase().includes(q)
      const matchC = category === 'all' || r.category === category
      return matchQ && matchC
    })
  }, [rows, search, category, instrumentById])

  const totals = React.useMemo(() => {
    const value = rows.reduce((s, r) => s + r.marketValue, 0)
    const pnl = rows.reduce((s, r) => s + r.unrealizedPnl, 0)
    const cost = rows.reduce((s, r) => s + r.cost, 0)
    const parts = rows.reduce((s, r) => s + r.quantity, 0)
    const income = rows.reduce((s, r) => s + r.income, 0)
    const avgNav = parts > 0 ? cost / parts : 0
    const pct = snapshot && snapshot.totalValue > 0 ? (value / snapshot.totalValue) * 100 : 0
    return { value, pnl, cost, parts, avgNav, income, pct }
  }, [rows, snapshot])

  function exportCsv() {
    downloadCsv(
      `mes-opcvm-${activeId}`,
      [
        'Fonds',
        'ISIN',
        'Société de gestion',
        'Catégorie',
        'Parts',
        'VL d\'achat moyenne',
        'Dernière VL',
        'Date de VL',
        'Valorisation (MAD)',
        '+/- value (MAD)',
        '+/- value (%)',
        'Poids (%)',
      ],
      filtered.map((r) => {
        const inst = instrumentById.get(r.instrumentId)
        return [
          r.name,
          inst?.isin ?? '',
          inst?.managementCompany ?? '',
          r.category ?? '',
          r.quantity.toFixed(2),
          r.pru.toFixed(4),
          r.lastPrice.toFixed(4),
          r.priceDate,
          r.marketValue.toFixed(2),
          r.unrealizedPnl.toFixed(2),
          r.unrealizedPnlPct.toFixed(2),
          r.weight.toFixed(2),
        ]
      }),
    )
  }

  return (
    <>
      <PageHeader
        title={t('opcvm.title')}
        description={`${rows.length} fonds · ${t('app.disclaimer')}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download /> {t('common.export')} CSV
            </Button>
            <Button asChild size="sm">
              <Link to="/operations">
                <Plus /> {t('ops.add')}
              </Link>
            </Button>
          </>
        }
      />

      <PortfolioTabs current="opcvm" />

      {loading ? (
        <Card>
          <CardContent>
            <SkeletonRows rows={6} />
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Aucun OPCVM dans ce portefeuille"
          description="Saisissez vos souscriptions et rachats de parts (fonds actions, obligataires, monétaires…) pour suivre votre poche OPCVM."
          icon={<PieChart className="h-5 w-5" />}
          action={
            <Button asChild>
              <Link to="/operations">
                <Plus /> {t('ops.add')}
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard
              label="Valorisation OPCVM"
              value={totals.value}
              hint={`${formatPct(totals.pct, { locale, decimals: 1, sign: false })} du portefeuille`}
              icon={<PieChart className="h-4 w-4" />}
            />
            <StatCard
              label={t('dash.unrealized')}
              value={totals.pnl}
              delta={totals.cost > 0 ? (totals.pnl / totals.cost) * 100 : 0}
              deltaLabel="sur coût"
            />
            <Card>
              <CardContent className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
                  {t('opcvm.avgNav')}
                </p>
                <p className="text-2xl font-bold leading-none text-ink tabular">
                  {formatNumber(totals.avgNav, { locale, decimals: 3 })} MAD
                </p>
                <p className="text-xs text-muted">
                  Coût total : {formatNumber(totals.cost, { locale, decimals: 0 })} MAD
                </p>
              </CardContent>
            </Card>
            <StatCard label={t('perf.dividends')} value={totals.income} hint="Distributions encaissées" />
          </div>

          <Card className="mb-4 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-anthracite-400" />
                <Input
                  className="ps-9"
                  placeholder={t('common.search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label={t('common.search')}
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="opcvm-cat-filter" className="sr-only">
                  {t('common.category')}
                </label>
                <Select
                  id="opcvm-cat-filter"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="sm:w-60"
                >
                  <option value="all">Toutes les catégories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </Card>

          {/* Desktop */}
          <Card className="hidden p-0 md:block">
            <Table>
              <THead>
                <TR>
                  <TH>{t('opcvm.fund')}</TH>
                  <TH>{t('common.category')}</TH>
                  <TH align="end">{t('opcvm.parts')}</TH>
                  <TH align="end">{t('opcvm.avgNav')}</TH>
                  <TH align="end">{t('opcvm.nav')}</TH>
                  <TH align="end">{t('opcvm.navDate')}</TH>
                  <TH align="end">Valorisation</TH>
                  <TH align="end">{t('actions.unrealized')}</TH>
                  <TH align="end">{t('common.share')}</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((r) => {
                  const inst = instrumentById.get(r.instrumentId)
                  return (
                    <TR key={r.instrumentId}>
                      <TD>
                        <Link to={`/opcvm/${r.instrumentId}`} className="block min-w-48">
                          <span className="block truncate font-semibold text-ink hover:text-brand-700">
                            {r.name}
                          </span>
                          <span className="block text-[11px] text-muted">
                            {inst?.managementCompany ?? '—'} · {inst?.isin ?? ''}
                          </span>
                        </Link>
                      </TD>
                      <TD>
                        {r.category ? (
                          <Badge variant={CATEGORY_BADGE[r.category]}>
                            {CATEGORY_LABELS[r.category]}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TD>
                      <TD align="end">{formatNumber(r.quantity, { locale, decimals: 2 })}</TD>
                      <TD align="end">{formatNumber(r.pru, { locale, decimals: 3 })}</TD>
                      <TD align="end">
                        <span className="font-semibold">{formatNumber(r.lastPrice, { locale, decimals: 3 })}</span>
                      </TD>
                      <TD align="end">
                        <span className="text-xs text-muted">{formatDate(r.priceDate, locale)}</span>
                      </TD>
                      <TD align="end">
                        <Money value={r.marketValue} className="font-semibold" />
                      </TD>
                      <TD align="end">
                        <span className={cn('block font-semibold', signClass(r.unrealizedPnl))}>
                          <Money value={r.unrealizedPnl} reveal hideMaskable />
                        </span>
                        <Delta value={r.unrealizedPnlPct} iconSize="xs" className="text-[11px]" />
                      </TD>
                      <TD align="end">
                        <div className="ms-auto w-16">
                          <span className="text-xs font-semibold">
                            {formatPct(r.weight, { locale, decimals: 1, sign: false })}
                          </span>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-anthracite-200 dark:bg-anthracite-800">
                            <div
                              className="h-1.5 rounded-full bg-brand-600"
                              style={{ width: `${Math.min(100, r.weight)}%` }}
                            />
                          </div>
                        </div>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </Card>

          {/* Mobile */}
          <div className="grid gap-2.5 md:hidden">
            {filtered.map((r) => (
              <FundCard key={r.instrumentId} p={r} />
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="Aucun résultat"
              description="Modifiez la recherche ou le filtre de catégorie."
              className="mt-4"
            />
          ) : null}
        </>
      )}
    </>
  )
}
