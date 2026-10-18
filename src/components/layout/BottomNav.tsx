import { NavLink } from 'react-router-dom'
import { BarChart3, Home, PieChart, Receipt, User } from 'lucide-react'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/', labelKey: 'nav.home', fallback: 'Accueil', icon: Home, end: true },
  { to: '/actions', labelKey: 'nav.portfolio', fallback: 'Portefeuille', icon: PieChart },
  { to: '/operations', labelKey: 'nav.operations', fallback: 'Opérations', icon: Receipt },
  { to: '/analyse', labelKey: 'nav.analysis', fallback: 'Analyse', icon: BarChart3 },
  { to: '/profil', labelKey: 'nav.profile', fallback: 'Profil', icon: User },
]

/** Barre d'onglets basse (mobile) — 5 onglets imposés */
export function BottomNav() {
  const t = useT()
  return (
    <nav
      aria-label="Navigation mobile"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold transition-colors',
                  isActive
                    ? 'text-brand-700 dark:text-brand-400'
                    : 'text-anthracite-500 hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'rounded-lg p-1 transition-colors',
                      isActive && 'bg-brand-50 dark:bg-brand-950',
                    )}
                  >
                    <tab.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="truncate">{t(tab.labelKey, tab.fallback)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
