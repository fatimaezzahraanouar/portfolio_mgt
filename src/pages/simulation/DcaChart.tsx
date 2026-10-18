import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_COLORS } from '@/components/shared/charts'
import { useI18n } from '@/i18n'
import { formatDate, formatMoney } from '@/lib/format'

export interface DcaPoint {
  date: string
  /** Valeur du plan d'épargne à ce mois */
  plan: number
  /** Valeur si les mêmes versements étaient placés sur un fonds monétaire à 3,5 % */
  monetaire: number
}

function DcaTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string }>
  label?: string
}) {
  const { locale } = useI18n()
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-semibold text-ink">{label ? formatDate(label, locale) : ''}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2 text-anthracite-600 dark:text-anthracite-300">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color ?? CHART_COLORS.brand }}
          />
          <span className="font-medium">{entry.name}</span>
          <span className="ms-auto font-semibold text-ink tabular">
            {formatMoney(Number(entry.value ?? 0), { locale })}
          </span>
        </p>
      ))}
    </div>
  )
}

/** Évolution mois par mois : plan d'épargne vs fonds monétaire (3,5 %) */
export function DcaChart({ data, height = 260 }: { data: DcaPoint[]; height?: number }) {
  const { locale } = useI18n()
  if (data.length === 0) return null
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, left: -4, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
            tickFormatter={(d: string) => formatDate(d, locale).replace(/\s\d{4}$/, '')}
          />
          <YAxis
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(v: number) =>
              Math.abs(v) >= 1_000_000
                ? `${(v / 1_000_000).toFixed(1)} M`
                : Math.abs(v) >= 1000
                  ? `${Math.round(v / 1000)} k`
                  : String(v)
            }
          />
          <Tooltip content={<DcaTooltip />} cursor={{ stroke: CHART_COLORS.muted }} />
          <Line
            type="monotone"
            dataKey="plan"
            name="Plan d’épargne"
            stroke={CHART_COLORS.brand}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="monetaire"
            name="Fonds monétaire (3,5 %)"
            stroke={CHART_COLORS.anthracite}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
