import * as React from 'react'
import { KeyRound, Languages, LogOut, Monitor, Moon, Palette, ShieldCheck, Sun, User, Wallet } from 'lucide-react'
import { useI18n, useT } from '@/i18n'
import { useAuth } from '@/state/auth'
import { usePreferences } from '@/state/preferences'
import { useStore, ALL_PORTFOLIOS } from '@/state/store'
import type { Locale, UserSettings } from '@/domain/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/controls'
import { Separator } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/shared/page'
import { Money } from '@/components/shared/money'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Section({
  title,
  icon,
  children,
  description,
  className,
}: {
  title: string
  icon?: React.ReactNode
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('p-0', className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {icon ? <span className="text-anthracite-500">{icon}</span> : null}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{title}</p>
          {description ? <p className="text-[11px] text-muted">{description}</p> : null}
        </div>
      </div>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ProfilPage() {
  const t = useT()
  const { locale, setLocale } = useI18n()
  const { theme, setTheme, maskAmounts, setMaskAmounts } = usePreferences()
  const { signOut } = useAuth()
  const { user, settings, updateSettings, portfolios, snapshotOf, activeId, setActiveId, resetDemo } =
    useStore()
  const { push } = useToast()

  const [busy, setBusy] = React.useState(false)
  const [resetOpen, setResetOpen] = React.useState(false)

  /* Valeurs locales contrôlées, resynchronisées depuis les settings enregistrés */
  const [feePct, setFeePct] = React.useState(String(settings?.defaultFeePct ?? ''))
  const [feeMin, setFeeMin] = React.useState(String(settings?.defaultFeeMin ?? ''))
  const [twoFactor, setTwoFactor] = React.useState<UserSettings['twoFactor']>(
    settings?.twoFactor ?? 'OFF',
  )
  const [dirtyFees, setDirtyFees] = React.useState(false)

  React.useEffect(() => {
    if (!settings) return
    setFeePct(String(settings.defaultFeePct))
    setFeeMin(String(settings.defaultFeeMin))
    setTwoFactor(settings.twoFactor)
    setDirtyFees(false)
  }, [settings])

  async function saveFees() {
    if (!settings) return
    setBusy(true)
    try {
      await updateSettings({
        defaultFeePct: Number(feePct.replace(',', '.')) || 0,
        defaultFeeMin: Number(feeMin.replace(',', '.')) || 0,
      })
      setDirtyFees(false)
      push({ title: 'Frais par défaut enregistrés', tone: 'success' })
    } finally {
      setBusy(false)
    }
  }

  async function saveTwoFactor(next: UserSettings['twoFactor']) {
    setTwoFactor(next)
    await updateSettings({ twoFactor: next })
    push({
      title: 'Double authentification mise à jour',
      description:
        next === 'OFF'
          ? 'La 2FA est désactivée (démo : aucun envoi réel).'
          : `Méthode : ${next} (démo : aucun envoi réel).`,
      tone: 'success',
    })
  }

  async function onLocale(next: Locale) {
    setLocale(next)
    await updateSettings({ locale: next })
  }

  async function onTheme(next: 'light' | 'dark') {
    setTheme(next)
    await updateSettings({ theme: next })
  }

  async function onMask(next: boolean) {
    setMaskAmounts(next)
    await updateSettings({ maskAmounts: next })
  }

  async function onResetDemo() {
    setBusy(true)
    try {
      await resetDemo()
      setResetOpen(false)
      push({
        title: 'Jeu de démonstration réinitialisé',
        description: 'Toutes vos saisies locales ont été effacées.',
        tone: 'success',
      })
    } finally {
      setBusy(false)
    }
  }

  const visiblePortfolios = portfolios

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        description={user ? `${user.fullName} · ${user.email}` : undefined}
        actions={
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut /> {t('auth.signOut')}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------------- Compte ---------------- */}
        <Section title="Compte" icon={<User className="h-4 w-4" />} description="Informations de connexion">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Nom complet</Label>
              <Input value={user?.fullName ?? ''} readOnly disabled />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input value={user?.email ?? ''} readOnly disabled />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={user?.phone ?? '—'} readOnly disabled />
            </div>
            <div>
              <Label>Compte créé le</Label>
              <Input
                value={user ? formatDateTime(user.createdAt, locale) : '—'}
                readOnly
                disabled
              />
            </div>
          </div>

          <Separator />

          <Row
            label={t('auth.2fa')}
            hint="Démo : l'envoi du code n'est pas simulé (code fixe 426831)."
          >
            <Select
              aria-label={t('auth.2fa')}
              value={twoFactor}
              onChange={(e) => void saveTwoFactor(e.target.value as UserSettings['twoFactor'])}
              className="w-40"
            >
              <option value="OFF">Désactivée</option>
              <option value="SMS">SMS</option>
              <option value="EMAIL">E-mail</option>
            </Select>
          </Row>
        </Section>

        {/* ---------------- Apparence & confidentialité ---------------- */}
        <Section
          title="Apparence & confidentialité"
          icon={<Palette className="h-4 w-4" />}
          description="Thème, langue et masquage des montants"
        >
          <Row label={t('settings.darkMode')} hint="Clair ou sombre">
            <div className="flex gap-1 rounded-lg bg-anthracite-100 p-1 dark:bg-anthracite-800/70">
              <button
                type="button"
                onClick={() => void onTheme('light')}
                aria-pressed={theme === 'light'}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors',
                  theme === 'light'
                    ? 'bg-card text-brand-700 shadow-sm dark:bg-anthracite-900 dark:text-brand-300'
                    : 'text-anthracite-500 hover:text-ink',
                )}
              >
                <Sun className="h-3.5 w-3.5" /> Clair
              </button>
              <button
                type="button"
                onClick={() => void onTheme('dark')}
                aria-pressed={theme === 'dark'}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors',
                  theme === 'dark'
                    ? 'bg-card text-brand-700 shadow-sm dark:bg-anthracite-900 dark:text-brand-300'
                    : 'text-anthracite-500 hover:text-ink',
                )}
              >
                <Moon className="h-3.5 w-3.5" /> Sombre
              </button>
            </div>
          </Row>

          <Row label={t('settings.language')} hint="Français, English ou العربية (RTL)">
            <Select
              aria-label={t('settings.language')}
              value={locale}
              onChange={(e) => void onLocale(e.target.value as Locale)}
              className="w-40"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </Select>
          </Row>

          <Row
            label={t('settings.mask')}
            hint="Masque les montants à l'écran (confidentialité en public)."
          >
            <Switch
              checked={maskAmounts}
              onCheckedChange={(v) => void onMask(Boolean(v))}
              aria-label={t('settings.mask')}
            />
          </Row>
        </Section>

        {/* ---------------- Portefeuilles ---------------- */}
        <Section
          title={t('settings.portfolios')}
          icon={<Wallet className="h-4 w-4" />}
          description="Sélectionnez le portefeuille actif"
        >
          <div className="space-y-2">
            {visiblePortfolios.map((p) => {
              const snap = snapshotOf(p.id)
              const isActive = activeId === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveId(p.id)}
                  aria-pressed={isActive}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-start transition-colors',
                    isActive
                      ? 'border-brand-400 bg-brand-50/60 dark:border-brand-800 dark:bg-brand-950/40'
                      : 'border-border bg-card hover:border-anthracite-300',
                  )}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.name}
                    </p>
                    <p className="text-[11px] text-muted">
                      {p.kind}
                      {snap ? ` · ${snap.positions.length} ligne(s)` : ''}
                    </p>
                  </div>
                  <div className="text-end">
                    {snap ? (
                      <Money value={snap.totalValue} className="text-sm font-bold" />
                    ) : null}
                    {isActive ? (
                      <Badge variant="default" className="ms-2">
                        Actif
                      </Badge>
                    ) : null}
                  </div>
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => setActiveId(ALL_PORTFOLIOS)}
              aria-pressed={activeId === ALL_PORTFOLIOS}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-start transition-colors',
                activeId === ALL_PORTFOLIOS
                  ? 'border-brand-400 bg-brand-50/60 dark:border-brand-800 dark:bg-brand-950/40'
                  : 'border-border bg-card hover:border-anthracite-300',
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Tous les portefeuilles</p>
                <p className="text-[11px] text-muted">Vue agrégée</p>
              </div>
              {activeId === ALL_PORTFOLIOS ? (
                <Badge variant="default">Actif</Badge>
              ) : null}
            </button>
          </div>

          <Alert variant="info">
            La création et la gestion avancée des portefeuilles (couleur, notes, archivage)
            s'effectuent côté Supabase — voir <span className="font-mono">docs/supabase-schema.sql</span>.
          </Alert>
        </Section>

        {/* ---------------- Frais & fiscalité ---------------- */}
        <Section
          title="Frais & fiscalité"
          icon={<KeyRound className="h-4 w-4" />}
          description="Paramètres appliqués par défaut aux nouvelles opérations"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="set-fee-pct">{t('settings.feesPct')} (%)</Label>
              <Input
                id="set-fee-pct"
                inputMode="decimal"
                value={feePct}
                onChange={(e) => {
                  setFeePct(e.target.value)
                  setDirtyFees(true)
                }}
              />
            </div>
            <div>
              <Label htmlFor="set-fee-min">{t('settings.feesMin')}</Label>
              <Input
                id="set-fee-min"
                inputMode="decimal"
                value={feeMin}
                onChange={(e) => {
                  setFeeMin(e.target.value)
                  setDirtyFees(true)
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            {dirtyFees ? (
              <Badge variant="warning">Modifications non enregistrées</Badge>
            ) : (
              <span className="text-[11px] text-muted">
                Appliqué aux opérations de type achat / souscription.
              </span>
            )}
            <Button size="sm" onClick={() => void saveFees()} disabled={!dirtyFees || busy}>
              {t('common.save')}
            </Button>
          </div>

          <Separator />

          <div className="rounded-xl border border-border bg-anthracite-50/60 p-3.5 text-sm dark:bg-anthracite-900/40">
            <p className="flex items-center gap-1.5 font-semibold text-ink">
              <ShieldCheck className="h-4 w-4 text-anthracite-500" /> {t('tax.title')}
            </p>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-muted">{t('tax.capitalGainsRate')}</dt>
                <dd className="font-bold text-ink tabular">
                  {settings?.tax.capitalGainsRate ?? 0} %
                </dd>
              </div>
              <div>
                <dt className="text-muted">{t('tax.dividendRate')}</dt>
                <dd className="font-bold text-ink tabular">
                  {settings?.tax.dividendWithholdingRate ?? 0} %
                </dd>
              </div>
              <div>
                <dt className="text-muted">{t('tax.exemption')}</dt>
                <dd className="font-bold text-ink tabular">
                  <Money value={settings?.tax.exemptionThreshold ?? 0} decimals={0} />
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-[11px] text-muted">
              Les taux sont modifiables dans l'écran <span className="font-medium">{t('nav.tax')}</span>.
              Les lois de finances peuvent les faire évoluer.
            </p>
          </div>
        </Section>

        {/* ---------------- Données ---------------- */}
        <Section
          title="Données & démonstration"
          icon={<Monitor className="h-4 w-4" />}
          description="Réinitialisation du jeu de démonstration local"
          className="lg:col-span-2"
        >
          <Alert variant="warning">
            L'application fonctionne actuellement en mode démonstration : les cours, VL et opérations
            sont fictifs et stockés dans votre navigateur (localStorage). La réinitialisation efface
            toutes vos saisies locales et restaure le jeu de démonstration d'origine.
          </Alert>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              Provider actif : <span className="font-medium text-ink">démo</span> · les montants
              affichés sont indicatifs.
            </p>
            <Button variant="destructive" size="sm" onClick={() => setResetOpen(true)}>
              <LogOut /> {t('common.reset')} la démo
            </Button>
          </div>
        </Section>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        <Languages className="inline h-3 w-3" /> {t('app.legal')}
      </p>

      {/* Confirmation de réinitialisation */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Réinitialiser le jeu de démonstration ?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Alert variant="danger">
              Toutes les opérations, alertes, watchlist et mises à jour de cours que vous avez saisis
              localement seront supprimées. Cette action est irréversible.
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void onResetDemo()} disabled={busy}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
