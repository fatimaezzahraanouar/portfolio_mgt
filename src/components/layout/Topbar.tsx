import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Sun,
  UserCog,
} from 'lucide-react'
import { useI18n, useT } from '@/i18n'
import { usePreferences } from '@/state/preferences'
import { useStore, ALL_PORTFOLIOS } from '@/state/store'
import { useAuth } from '@/state/auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MaskToggle } from '@/components/shared/money'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatPct, formatNumber } from '@/lib/format'

function IndicesTicker() {
  const { indices } = useStore()
  const { locale } = useI18n()
  if (indices.length === 0) return null
  return (
    <div className="hidden items-center gap-2 xl:flex">
      {indices.map((idx) => {
        const up = idx.changePct >= 0
        return (
          <div
            key={idx.code}
            className="flex items-baseline gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5"
            title={`${idx.name} — séance du dernier cours disponible`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wide text-anthracite-500">
              {idx.name}
            </span>
            <span className="tabular text-xs font-semibold text-ink">
              {formatNumber(idx.value, { locale, decimals: 2 })}
            </span>
            <span
              className={cn(
                'tabular text-[11px] font-semibold',
                up ? 'text-gain-600' : 'text-loss-600',
              )}
            >
              {up ? '▲' : '▼'} {formatPct(idx.changePct, { locale, decimals: 2 })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function PortfolioSwitcher() {
  const t = useT()
  const { portfolios, activeId, setActiveId, refreshing, reload } = useStore()
  const total = portfolios.length

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor="portfolio-select" className="sr-only">
        {t('common.portfolio')}
      </label>
      <div className="relative">
        <select
          id="portfolio-select"
          value={activeId}
          onChange={(e) => setActiveId(e.target.value)}
          className="h-9 max-w-[9.5rem] appearance-none rounded-lg border border-border bg-card ps-3 pe-8 text-xs font-semibold text-ink shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25 sm:max-w-none sm:text-sm"
        >
          <option value={ALL_PORTFOLIOS}>{t('common.all')} ({total})</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute end-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-anthracite-500" />
      </div>
      <Button
        variant="ghost"
        size="iconSm"
        onClick={reload}
        aria-label={t('common.refresh')}
        title={t('common.refresh')}
      >
        <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
      </Button>
    </div>
  )
}

function NotificationsMenu() {
  const t = useT()
  const { alerts, events } = useStore()
  const active = alerts.filter((a) => a.active)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="iconSm" aria-label={t('nav.alerts')} className="relative">
          <Bell className="h-4 w-4" />
          {active.length > 0 ? (
            <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[9px] font-bold text-white">
              {active.length}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        <DropdownMenuLabel>{t('alerts.title')}</DropdownMenuLabel>
        {active.slice(0, 4).map((a) => (
          <DropdownMenuItem key={a.id} asChild>
            <Link to="/alertes" className="flex flex-col items-start gap-0.5">
              <span className="text-xs font-semibold">{a.instrumentId}</span>
              <span className="text-[11px] text-muted">
                {a.type === 'PRICE_ABOVE'
                  ? `Cours > ${a.threshold}`
                  : a.type === 'PRICE_BELOW'
                    ? `Cours < ${a.threshold}`
                    : a.type === 'DAY_CHANGE'
                      ? `Variation journalière > ${a.threshold} %`
                      : a.type === 'VL_PUBLISHED'
                        ? 'Publication de VL'
                        : 'Détachement de dividende'}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t('dash.events')}</span>
          <Badge variant="outline">{events.length}</Badge>
        </DropdownMenuLabel>
        {events.slice(0, 3).map((e) => (
          <DropdownMenuItem key={e.id} asChild>
            <Link to="/alertes" className="flex flex-col items-start gap-0.5">
              <span className="text-xs font-semibold">{e.date}</span>
              <span className="line-clamp-2 text-[11px] text-muted">{e.label}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProfileMenu() {
  const t = useT()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { locale, setLocale } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2 text-start transition-colors hover:bg-anthracite-50 dark:hover:bg-anthracite-800"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-800">
            {(user?.fullName ?? 'U').slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden max-w-32 truncate text-xs font-semibold sm:block">
            {user?.fullName ?? '—'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-anthracite-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user?.email ?? t('nav.profile')}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => navigate('/profil')}>
          <UserCog className="h-4 w-4" /> {t('settings.title')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('settings.language')}</DropdownMenuLabel>
        {(['fr', 'en', 'ar'] as const).map((l) => (
          <DropdownMenuItem key={l} onSelect={() => setLocale(l)}>
            <span className={cn('w-full', locale === l && 'font-bold text-brand-700')}>
              {l === 'fr' ? 'Français' : l === 'en' ? 'English' : 'العربية'}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            signOut()
            navigate('/login')
          }}
          className="text-loss-600 focus:text-loss-600"
        >
          <LogOut className="h-4 w-4" /> {t('auth.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Topbar() {
  const t = useT()
  const { resolvedTheme, toggleTheme } = usePreferences()
  const { user } = useAuth()

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-card/90 px-3 backdrop-blur sm:px-5">
      <Link to="/" className="flex items-center gap-2 lg:hidden" aria-label={t('app.name')}>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
          P
        </span>
        <span className="hidden font-display text-sm font-bold sm:block">{t('app.name')}</span>
      </Link>

      <div className="ms-1 min-w-0 flex-1 lg:ms-0">
        <PortfolioSwitcher />
      </div>

      <IndicesTicker />

      <div className="flex items-center gap-1.5">
        <MaskToggle />
        <Button
          variant="outline"
          size="iconSm"
          onClick={toggleTheme}
          aria-label={t('settings.darkMode')}
          title={t('settings.darkMode')}
        >
          {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <NotificationsMenu />
        {user ? <ProfileMenu /> : null}
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link to="/operations">
            <Plus /> {t('ops.add')}
          </Link>
        </Button>
      </div>
    </header>
  )
}
