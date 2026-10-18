import { NavLink } from 'react-router-dom'
import { Bell, LineChart, PieChart, Wallet } from 'lucide-react'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'actions', to: '/actions', labelKey: 'nav.actions', fallback: 'Mes actions', icon: Wallet },
  { key: 'opcvm', to: '/opcvm', labelKey: 'nav.opcvm', fallback: 'Mes OPCVM', icon: PieChart },
  { key: 'watchlist', to: '/alertes', labelKey: 'nav.watchlist', fallback: 'Watchlist', icon: Bell },
] as const

/** Onglets de navigation « Portefeuille » (Actions / OPCVM / Watchlist) */
export function PortfolioTabs({ current }: { current: (typeof TABS)[number]['key'] }) {
  const t = useT()
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto no-scrollbar border-b border-border">
      {TABS.map((tab) => (
        <NavLink
          key={tab.key}
          to={tab.to}
          className={cn(
            'relative -mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors',
            current === tab.key
              ? 'border-brand-600 text-brand-700 dark:text-brand-400'
              : 'border-transparent text-anthracite-500 hover:text-ink',
          )}
        >
          <tab.icon className="h-4 w-4" />
          {t(tab.labelKey, tab.fallback)}
        </NavLink>
      ))}
      <NavLink
        to="/analyse"
        className={cn(
          'relative -mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors',
          'border-transparent text-anthracite-500 hover:text-ink',
        )}
      >
        <LineChart className="h-4 w-4" />
        {t('nav.analysis', 'Analyse')}
      </NavLink>
    </div>
  )
}
