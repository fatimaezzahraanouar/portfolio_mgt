import * as React from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { usePreferences } from '@/state/preferences'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { formatDate, formatMoney, formatNumber, formatPct } from '@/lib/format'
import type { RangeKey } from '@/domain/types'
import { Money } from './money'

export const CHART_COLORS = {
  brand: '#d13c18',
  brandLight: '#f07150',
  gain: '#0f9d58',
  loss: '#d92d20',
  anthracite: '#474d5d',
  muted: '#9aa1b2',
  grid: '#e6e8ec',
  gridDark: '#272b34',
}

/* ------------------------------------------------------------------ */
/* Sélecteur de plage (1J … MAX)                                       */
/* ------------------------------------------------------------------ */

const RANGES: RangeKey[] = ['1J', '1S', '1M', '3M', '6M', '1A', 'MAX']

export function RangeTabs({
  value,
  onChange,
  className,
}: {
  value: RangeKey
  onChange: (r: RangeKey) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label="Plage d’affichage"
      className={cn('inline-flex flex-wrap gap-1 rounded-lg bg-anthracite-100 p-1 dark:bg-anthracite-800/70', className)}
    >
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          role="tab"
          aria-selected={value === r}
          onClick={() => onChange(r)}
          className={cn(
            'h-7 rounded-md px-2.5 text-[11px] font-bold transition-colors',
            value === r
              ? 'bg-card text-brand-700 shadow-sm dark:bg-anthracite-900 dark:text-brand-300'
              : 'text-anthracite-500 hover:text-ink',
          )}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tooltip réutilisable                                                 */
/* ------------------------------------------------------------------ */

interface TipPayloadItem {
  name?: string
  value?: number | string
  color?: string
  dataKey?: string | number
}

function ChartTooltip({
  active,
  payload,
  label,
  mode = 'money',
}: {
  active?: boolean
  payload?: TipPayloadItem[]
  label?: string
  mode?: 'money' | 'pct' | 'number' | 'drawdown'
}) {
  const { locale } = useI18n()
  const { maskAmounts } = usePreferences()
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-semibold text-ink">{label ? formatDate(label, locale) : ''}</p>
      {payload.map((entry, i) => {
        const v = typeof entry.value === 'number' ? entry.value : Number(entry.value)
        const text =
          mode === 'pct'
            ? formatPct(v, { locale, decimals: 2 })
            : mode === 'number'
              ? formatNumber(v, { locale, decimals: 0 })
              : mode === 'drawdown'
                ? `${formatNumber(v, { locale, decimals: 2 })} %`
                : maskAmounts
                  ? '•••••'
                  : formatMoney(v, { locale })
        return (
          <p key={i} className="flex items-center gap-2 text-anthracite-600 dark:text-anthracite-300">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color ?? CHART_COLORS.brand }}
            />
            <span className="font-medium">{entry.name ?? entry.dataKey}</span>
            <span className="ms-auto font-semibold text-ink tabular">{text}</span>
          </p>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Graphique d'évolution du portefeuille + benchmark                    */
/* ------------------------------------------------------------------ */

export interface SeriesPointChart {
  date: string
  value: number
  pct: number
}

export function PortfolioChart({
  data,
  benchmark,
  benchmarkName = 'MASI',
  height = 260,
  showBenchmark = true,
}: {
  data: SeriesPointChart[]
  benchmark?: Array<{ date: string; pct: number }>
  benchmarkName?: string
  height?: number
  showBenchmark?: boolean
}) {
  const { locale } = useI18n()
  const rows = React.useMemo(() => {
    const map = new Map(data.map((d) => [d.date, d]))
    const benchMap = new Map((benchmark ?? []).map((b) => [b.date, b.pct]))
    return data.map((d) => ({
      ...d,
      bench: benchMap.get(d.date) ?? null,
      name: d.date,
    }))
  }, [data, benchmark])

  if (rows.length === 0) return null

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 6, right: 6, left: -6, bottom: 0 }}>
          <defs>
            <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.brand} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART_COLORS.brand} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradBench" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.anthracite} stopOpacity={0.16} />
              <stop offset="100%" stopColor={CHART_COLORS.anthracite} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            tickLine={false}
            axisLine={false}
            minTickGap={42}
            tickFormatter={(d: string) => formatDate(d, locale).replace(/\s\d{4}$/, '')}
          />
          <YAxis
            yAxisId="left"
            orientation={locale === 'ar' ? 'right' : 'left'}
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            tickLine={false}
            axisLine={false}
            width={72}
            tickFormatter={(v: number) =>
              Math.abs(v) >= 1_000_000
                ? `${(v / 1_000_000).toFixed(1)} M`
                : Math.abs(v) >= 1000
                  ? `${Math.round(v / 1000)} k`
                  : String(v)
            }
          />
          {showBenchmark ? (
            <YAxis
              yAxisId="right"
              orientation={locale === 'ar' ? 'left' : 'right'}
              tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
              tickLine={false}
              axisLine={false}
              width={46}
              tickFormatter={(v: number) => `${v.toFixed(0)} %`}
            />
          ) : null}
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART_COLORS.muted, strokeWidth: 1 }} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="value"
            name="Portefeuille"
            stroke={CHART_COLORS.brand}
            strokeWidth={2}
            fill="url(#gradValue)"
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0 }}
            isAnimationActive={false}
          />
          {showBenchmark ? (
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="bench"
              name={benchmarkName}
              stroke={CHART_COLORS.anthracite}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="url(#gradBench)"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              isAnimationActive={false}
              connectNulls
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Donut de répartition                                                 */
/* ------------------------------------------------------------------ */

export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  height = 240,
}: {
  slices: Array<{ key: string; label: string; value: number; weight: number; color: string }>
  centerLabel?: string
  centerValue?: React.ReactNode
  height?: number
}) {
  const { locale } = useI18n()
  const { maskAmounts } = usePreferences()
  if (slices.length === 0) return null

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
      <div style={{ height, width: '100%', maxWidth: 240 }} className="relative shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                const p = payload?.[0]
                if (!active || !p) return null
                const raw = p.payload as (typeof slices)[number]
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-pop">
                    <p className="font-semibold text-ink">{raw.label}</p>
                    <p className="tabular text-anthracite-600">
                      {maskAmounts ? '•••••' : formatMoney(raw.value, { locale })} ·{' '}
                      {formatPct(raw.weight, { locale, decimals: 1, sign: false })}
                    </p>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerValue ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-lg font-bold text-ink">{centerValue}</span>
            {centerLabel ? (
              <span className="text-[10px] uppercase tracking-wide text-anthracite-500">
                {centerLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <ul className="w-full min-w-0 space-y-1.5">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="min-w-0 flex-1 truncate text-anthracite-600 dark:text-anthracite-300">
              {s.label}
            </span>
            <span className="tabular text-xs font-semibold text-ink">
              {formatPct(s.weight, { locale, decimals: 1, sign: false })}
            </span>
            <span className="w-20 text-end text-xs text-muted">
              <Money value={s.value} hideMaskable reveal decimals={0} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Barres horizontales (secteurs, contributions)                        */
/* ------------------------------------------------------------------ */

export function HBarList({
  rows,
  unit = '%',
  height = 220,
}: {
  rows: Array<{ key: string; label: string; value: number; color?: string }>
  unit?: '%' | 'pts'
  height?: number
}) {
  const { locale } = useI18n()
  if (rows.length === 0) return null
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={130}
            tick={{ fontSize: 11, fill: CHART_COLORS.muted }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: 'rgba(150,150,150,0.08)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const v = Number(payload[0].value)
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-pop">
                  <p className="font-semibold text-ink">{label}</p>
                  <p className="tabular text-anthracite-600">
                    {formatNumber(v, { locale, decimals: 2 })} {unit}
                  </p>
                </div>
              )
            }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false} barSize={14}>
            {rows.map((r, i) => (
              <Cell key={r.key} fill={r.color ?? (r.value < 0 ? CHART_COLORS.loss : CHART_COLORS.brand)} />
            ))}
          </Bar>
          <ReferenceLine x={0} stroke={CHART_COLORS.grid} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Courbe simple (cours, VL)                                            */
/* ------------------------------------------------------------------ */

export function PriceChart({
  data,
  height = 240,
  color = CHART_COLORS.brand,
  label = 'Cours',
}: {
  data: Array<{ date: string; close: number }>
  height?: number
  color?: string
  label?: string
}) {
  const { locale } = useI18n()
  const rows = data.map((d) => ({ ...d, name: d.date }))
  if (rows.length === 0) return null
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 6, right: 8, left: -4, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            tickLine={false}
            axisLine={false}
            minTickGap={46}
            tickFormatter={(d: string) => formatDate(d, locale).replace(/\s\d{4}$/, '')}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART_COLORS.muted }} />
          <Line
            type="monotone"
            dataKey="close"
            name={label}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Drawdown (aire sous zéro)                                            */
/* ------------------------------------------------------------------ */

export function DrawdownChart({
  data,
  height = 170,
}: {
  data: Array<{ date: string; drawdown: number }>
  height?: number
}) {
  const { locale } = useI18n()
  const rows = data.map((d) => ({ ...d, name: d.date }))
  if (rows.length === 0) return null
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 6, right: 8, left: -4, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            tickLine={false}
            axisLine={false}
            minTickGap={46}
            tickFormatter={(d: string) => formatDate(d, locale).replace(/\s\d{4}$/, '')}
          />
          <YAxis
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => `${v} %`}
          />
          <Tooltip content={<ChartTooltip mode="drawdown" />} />
          <ReferenceLine y={0} stroke={CHART_COLORS.grid} />
          <Area
            type="monotone"
            dataKey="drawdown"
            name="Drawdown"
            stroke={CHART_COLORS.loss}
            strokeWidth={1.5}
            fill="rgba(217,45,32,0.18)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
