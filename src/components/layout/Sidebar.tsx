import { NavLink } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Calculator,
  Home,
  Percent,
  PieChart,
  Receipt,
  Settings,
  Wallet,
} from 'lucide-react'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  labelKey: string
  fallback: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
}

const GROUPS: Array<{ title: string; fallback: string; items: NavItem[] }> = [
  {
    title: 'Suivi',
    fallback: 'Suivi',
    items: [
      { to: '/', labelKey: 'nav.dashboard', fallback: 'Tableau de bord', icon: Home, end: true },
      { to: '/actions', labelKey: 'nav.actions', fallback: 'Mes actions', icon: Wallet },
      { to: '/opcvm', labelKey: 'nav.opcvm', fallback: 'Mes OPCVM', icon: PieChart },
      { to: '/alertes', labelKey: 'nav.alerts', fallback: 'Alertes & watchlist', icon: Bell },
    ],
  },
  {
    title: 'Analyse',
    fallback: 'Analyse',
    items: [
      { to: '/analyse', labelKey: 'nav.analysis', fallback: 'Performance & analyse', icon: BarChart3 },
      { to: '/fiscalite', labelKey: 'nav.tax', fallback: 'Fiscalité', icon: Percent },
      { to: '/simulation', labelKey: 'nav.simulation', fallback: 'Simulation', icon: Calculator },
    ],
  },
  {
    title: 'Compte',
    fallback: 'Compte',
    items: [
      { to: '/operations', labelKey: 'nav.operations', fallback: 'Opérations', icon: ArrowLeftRight },
      { to: '/profil', labelKey: 'nav.profile', fallback: 'Profil & paramètres', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const t = useT()
  return (
    <aside className="no-print fixed inset-y-0 start-0 z-40 hidden w-64 flex-col border-e border-border bg-card lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm">
          P
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-ink">{t('app.name')}</p>
          <p className="truncate text-[11px] text-muted">{t('app.tagline')}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navigation principale">
        {GROUPS.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-anthracite-400">
              {t(`nav.${group.title.toLowerCase()}`, group.fallback)}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                          : 'text-anthracite-600 hover:bg-anthracite-100 hover:text-ink dark:text-anthracite-300 dark:hover:bg-anthracite-800',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t(item.labelKey, item.fallback)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-4 text-[11px] leading-relaxed text-muted">
        <p className="flex items-start gap-1.5">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
          <span>{t('app.disclaimer')}</span>
        </p>
        <p className="mt-1.5 flex items-start gap-1.5">
          <Receipt className="mt-0.5 h-3.5 w-3.5 shrink-0 text-anthracite-400" />
          <span>{t('app.legal')}</span>
        </p>
      </div>
    </aside>
  )
}
