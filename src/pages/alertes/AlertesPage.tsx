import * as React from 'react'
import { Link } from 'react-router-dom'
import { BellPlus, CalendarClock, ExternalLink, Pencil, Star, Trash2 } from 'lucide-react'
import { useI18n, useT } from '@/i18n'
import { useStore } from '@/state/store'
import type {
  Alert as AlertModel,
  AlertType,
  CorporateEvent,
  Quote,
} from '@/domain/types'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/controls'
import { Label } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { EmptyState, PageHeader, SkeletonRows } from '@/components/shared/page'
import { Money } from '@/components/shared/money'
import { formatDate, formatNumber, formatPct, signClass, todayISO } from '@/lib/format'
import { AlertFormDialog, typeLabel } from './AlertFormDialog'

type TFn = (key: string, fallback?: string) => string

/** Évalue localement une alerte de cours / variation sur la dernière cotation */
function isConditionMet(alert: AlertModel, quote: Quote | undefined): boolean {
  if (!alert.active || !quote) return false
  switch (alert.type) {
    case 'PRICE_ABOVE':
      return quote.close >= alert.threshold
    case 'PRICE_BELOW':
      return quote.close <= alert.threshold
    case 'DAY_CHANGE':
      return Math.abs(quote.changePct) >= Math.abs(alert.threshold)
    case 'VL_PUBLISHED':
    case 'DIVIDEND_DETACH':
      return false
  }
}

function thresholdText(alert: AlertModel, locale: 'fr' | 'en' | 'ar', t: TFn): string {
  if (alert.type === 'DAY_CHANGE') return formatPct(alert.threshold, { locale })
  return `${formatNumber(alert.threshold, { locale, decimals: 2 })} MAD`
}

function currentText(alert: AlertModel, quote: Quote | undefined, locale: 'fr' | 'en' | 'ar'): string {
  if (!quote) return '—'
  if (alert.type === 'DAY_CHANGE') return formatPct(quote.changePct, { locale })
  return `${formatNumber(quote.close, { locale, decimals: 2 })} MAD`
}

function eventLabel(type: CorporateEvent['type'], t: TFn): string {
  switch (type) {
    case 'DIVIDEND_DETACH':
      return t('event.dividend', 'Détachement de dividende')
    case 'AG':
      return t('event.ag', 'Assemblée générale')
    case 'VL_PUBLISHED':
      return t('event.vl', 'Publication de VL')
    case 'MATURITY':
      return t('event.maturity', 'Échéance')
    case 'CAPITAL':
      return t('event.capital', 'Augmentation de capital')
  }
}

function ficheHref(instrumentId: string, type: 'ACTION' | 'OPCVM'): string {
  return type === 'ACTION' ? `/actions/${instrumentId}` : `/opcvm/${instrumentId}`
}

export default function AlertesPage() {
  const t = useT()
  const { locale } = useI18n()
  const {
    watchlist,
    alerts,
    events,
    instruments,
    instrumentById,
    quoteById,
    snapshot,
    toggleWatch,
    isWatched,
    saveAlert,
    removeAlert,
    loading,
  } = useStore()
  const { push } = useToast()

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AlertModel | null>(null)
  const [addId, setAddId] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  /* ---------------------------- données dérivées ---------------------------- */

  const positionsByInstrument = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const p of snapshot?.positions ?? []) m.set(p.instrumentId, p.weight)
    return m
  }, [snapshot])

  const watchRows = React.useMemo(
    () =>
      watchlist.map((w) => ({
        item: w,
        instrument: instrumentById.get(w.instrumentId),
        quote: quoteById.get(w.instrumentId),
      })),
    [watchlist, instrumentById, quoteById],
  )

  const availableInstruments = React.useMemo(
    () =>
      instruments
        .filter((i) => i.active && !isWatched(i.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instruments, isWatched, watchlist],
  )

  /** Alertes dont la condition est déjà satisfaite sur la dernière cotation */
  const pending = React.useMemo(
    () =>
      alerts.filter(
        (a) => !a.triggeredAt && isConditionMet(a, quoteById.get(a.instrumentId)),
      ),
    [alerts, quoteById],
  )

  const upcomingEvents = React.useMemo(() => {
    const today = todayISO()
    return [...events]
      .filter((e) => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6)
  }, [events])

  /* ------------------------------ mutations ------------------------------ */

  async function handleToggleWatch(instrumentId: string) {
    setBusy(true)
    try {
      const added = await toggleWatch(instrumentId)
      push({
        title: added
          ? t('alerts.wlAdded', 'Ajouté à la watchlist')
          : t('alerts.wlRemoved', 'Retiré de la watchlist'),
        description: instrumentById.get(instrumentId)?.name,
        tone: added ? 'success' : 'default',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleAddWatch() {
    if (!addId) return
    await handleToggleWatch(addId)
    setAddId('')
  }

  async function handleToggleActive(a: AlertModel, active: boolean) {
    await saveAlert({ ...a, active })
  }

  async function handleDelete(a: AlertModel) {
    await removeAlert(a.id)
    push({ title: t('alerts.deleted', 'Alerte supprimée'), tone: 'default' })
  }

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(a: AlertModel) {
    setEditing(a)
    setDialogOpen(true)
  }

  /* -------------------------------- rendu -------------------------------- */

  return (
    <>
      <PageHeader
        title={t('alerts.title', 'Alertes & watchlist')}
        description={t(
          'alerts.desc',
          'Suivez vos valeurs et fonds favoris, soyez alerté quand un cours ou une VL atteint votre seuil.',
        )}
        actions={
          <Button onClick={openNew}>
            <BellPlus /> {t('alerts.add', 'Nouvelle alerte')}
          </Button>
        }
      />

      {loading ? (
        <Card>
          <CardContent>
            <SkeletonRows rows={6} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* ---------------- Alertes sur le point de se déclencher ---------------- */}
          {pending.length > 0 ? (
            <Alert
              variant="warning"
              title={t('alerts.pending', 'Alertes sur le point de se déclencher')}
            >
              <ul className="space-y-1">
                {pending.map((a) => (
                  <li key={a.id}>
                    <span className="font-semibold">
                      {instrumentById.get(a.instrumentId)?.name ?? a.instrumentId}
                    </span>{' '}
                    — {typeLabel(a.type, t)} : {currentText(a, quoteById.get(a.instrumentId), locale)}{' '}
                    <span className="opacity-80">
                      ({t('alerts.thresholdShort', 'seuil')} {thresholdText(a, locale, t)})
                    </span>
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {/* ------------------------------ Watchlist ------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                {t('alerts.watchlist', 'Watchlist')}{' '}
                <span className="font-normal text-muted">({watchRows.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <Label htmlFor="wl-add">
                    {t('alerts.addToWatchlist', 'Ajouter à la watchlist')}
                  </Label>
                  <Select
                    id="wl-add"
                    value={addId}
                    onChange={(e) => setAddId(e.target.value)}
                    disabled={availableInstruments.length === 0}
                  >
                    <option value="">
                      {availableInstruments.length === 0
                        ? t('alerts.allTracked', 'Tous les instruments sont déjà suivis')
                        : t('alerts.pickInstrument', 'Choisir une valeur ou un fonds…')}
                    </option>
                    {availableInstruments.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.ticker})
                      </option>
                    ))}
                  </Select>
                </div>
                <Button onClick={() => void handleAddWatch()} disabled={!addId || busy}>
                  <Star /> {t('common.add', 'Ajouter')}
                </Button>
              </div>

              {watchRows.length === 0 ? (
                <EmptyState
                  icon={<Star className="h-5 w-5" />}
                  title={t('alerts.wlEmpty', 'Votre watchlist est vide')}
                  description={t(
                    'alerts.wlEmptyDesc',
                    'Ajoutez vos valeurs ou OPCVM préférés (IAM, Attijariwafa Bank, Atlas Monétaire…) pour suivre leur cours et recevoir des alertes.',
                  )}
                />
              ) : (
                <Table className="min-w-[640px]">
                  <THead>
                    <TR>
                      <TH>{t('common.name', 'Nom')}</TH>
                      <TH>{t('alerts.identifier', 'Ticker / ISIN')}</TH>
                      <TH align="end">{t('alerts.lastPrice', 'Dernier cours')}</TH>
                      <TH align="end">{t('common.day', 'Variation J')}</TH>
                      <TH align="end">{t('common.share', 'Poids portefeuille')}</TH>
                      <TH align="end" className="w-24">
                        {t('common.actions_col', 'Actions')}
                      </TH>
                    </TR>
                  </THead>
                  <TBody>
                    {watchRows.map(({ item, instrument, quote }) => {
                      if (!instrument) return null
                      const weight = positionsByInstrument.get(instrument.id)
                      return (
                        <TR key={item.id}>
                          <TD>
                            <Link
                              to={ficheHref(instrument.id, instrument.type)}
                              className="font-semibold text-ink transition-colors hover:text-brand-700 dark:hover:text-brand-300"
                            >
                              {instrument.name}
                            </Link>
                            <p className="text-[11px] text-muted">
                              {instrument.type === 'ACTION'
                                ? t('alerts.kindAction', 'Action')
                                : t('alerts.kindFund', 'OPCVM')}
                              {instrument.sector ? ` · ${instrument.sector}` : ''}
                            </p>
                          </TD>
                          <TD className="whitespace-nowrap text-xs text-anthracite-600 dark:text-anthracite-300">
                            {instrument.ticker}
                            {instrument.isin ? ` · ${instrument.isin}` : ''}
                          </TD>
                          <TD align="end">
                            {quote ? (
                              <Money value={quote.close} decimals={2} />
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </TD>
                          <TD align="end">
                            {quote ? (
                              <span className={signClass(quote.changePct)}>
                                {formatPct(quote.changePct, { locale })}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </TD>
                          <TD align="end">
                            {weight !== undefined ? (
                              formatPct(weight, { locale, decimals: 1, sign: false })
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </TD>
                          <TD align="end">
                            <span className="inline-flex items-center gap-1">
                              <Button
                                asChild
                                variant="ghost"
                                size="iconSm"
                                aria-label={t('alerts.openFiche', 'Ouvrir la fiche')}
                              >
                                <Link to={ficheHref(instrument.id, instrument.type)}>
                                  <ExternalLink />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="iconSm"
                                aria-label={t('alerts.removeFromWatchlist', 'Retirer de la watchlist')}
                                disabled={busy}
                                onClick={() => void handleToggleWatch(instrument.id)}
                              >
                                <Trash2 />
                              </Button>
                            </span>
                          </TD>
                        </TR>
                      )
                    })}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* ------------------------------- Alertes ------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellPlus className="h-4 w-4 text-brand-600" />
                {t('alerts.myAlerts', 'Mes alertes')}{' '}
                <span className="font-normal text-muted">({alerts.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <EmptyState
                  icon={<BellPlus className="h-5 w-5" />}
                  title={t('alerts.empty', 'Aucune alerte configurée')}
                  description={t(
                    'alerts.emptyDesc',
                    'Créez une alerte pour être notifié quand un cours dépasse un seuil, quand la variation journalière est forte ou quand une VL est publiée.',
                  )}
                  action={
                    <Button onClick={openNew}>
                      <BellPlus /> {t('alerts.add', 'Nouvelle alerte')}
                    </Button>
                  }
                />
              ) : (
                <Table className="min-w-[760px]">
                  <THead>
                    <TR>
                      <TH>{t('common.name', 'Instrument')}</TH>
                      <TH>{t('common.type', 'Type')}</TH>
                      <TH align="end">{t('alerts.threshold', 'Seuil')}</TH>
                      <TH>{t('alerts.channels', 'Canaux')}</TH>
                      <TH align="center">{t('alerts.active', 'Active')}</TH>
                      <TH>{t('alerts.createdAt', 'Créée le')}</TH>
                      <TH align="end" className="w-28">
                        {t('common.actions_col', 'Actions')}
                      </TH>
                    </TR>
                  </THead>
                  <TBody>
                    {alerts.map((a) => {
                      const inst = instrumentById.get(a.instrumentId)
                      return (
                        <TR key={a.id}>
                          <TD>
                            {inst ? (
                              <Link
                                to={ficheHref(inst.id, inst.type)}
                                className="font-semibold text-ink transition-colors hover:text-brand-700 dark:hover:text-brand-300"
                              >
                                {inst.name}
                              </Link>
                            ) : (
                              a.instrumentId
                            )}
                          </TD>
                          <TD>
                            <Badge variant="secondary">{typeLabel(a.type, t)}</Badge>
                          </TD>
                          <TD align="end" className="whitespace-nowrap">
                            {thresholdText(a, locale, t)}
                          </TD>
                          <TD>
                            <span className="flex flex-wrap gap-1">
                              {a.channels.includes('IN_APP') ? (
                                <Badge variant="outline">{t('alerts.inApp', 'In-app')}</Badge>
                              ) : null}
                              {a.channels.includes('EMAIL') ? (
                                <Badge variant="outline">{t('alerts.email', 'E-mail')}</Badge>
                              ) : null}
                            </span>
                          </TD>
                          <TD align="center">
                            <Switch
                              checked={a.active}
                              onCheckedChange={(v) => void handleToggleActive(a, v)}
                              aria-label={
                                a.active
                                  ? t('alerts.disable', 'Désactiver l’alerte')
                                  : t('alerts.enable', 'Activer l’alerte')
                              }
                            />
                          </TD>
                          <TD className="whitespace-nowrap text-xs text-muted">
                            {formatDate(a.createdAt, locale)}
                          </TD>
                          <TD align="end">
                            <span className="inline-flex items-center gap-1">
                              {a.triggeredAt ? (
                                <Badge variant="warning">
                                  {t('alerts.triggered', 'Déclenchée')}
                                </Badge>
                              ) : null}
                              <Button
                                variant="ghost"
                                size="iconSm"
                                aria-label={t('common.edit', 'Modifier')}
                                onClick={() => openEdit(a)}
                              >
                                <Pencil />
                              </Button>
                              <Button
                                variant="ghost"
                                size="iconSm"
                                aria-label={t('common.delete', 'Supprimer')}
                                onClick={() => void handleDelete(a)}
                              >
                                <Trash2 />
                              </Button>
                            </span>
                          </TD>
                        </TR>
                      )
                    })}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* -------------------------- Prochains événements -------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-anthracite-500" />
                {t('alerts.upcoming', 'Prochains événements')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock className="h-5 w-5" />}
                  title={t('alerts.noEvents', 'Aucun événement à venir')}
                  description={t(
                    'alerts.noEventsDesc',
                    'Les détachements de dividendes, assemblées générales et publications de VL apparaîtront ici.',
                  )}
                />
              ) : (
                <ul className="space-y-2">
                  {upcomingEvents.map((e) => {
                    const inst = instrumentById.get(e.instrumentId)
                    return (
                      <li
                        key={e.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-anthracite-50/60 px-3 py-2 dark:bg-anthracite-900/40"
                      >
                        <span className="w-24 shrink-0 text-xs font-semibold tabular text-anthracite-600 dark:text-anthracite-300">
                          {formatDate(e.date, locale)}
                        </span>
                        <span className="min-w-0 flex-1 text-sm text-ink">{e.label}</span>
                        {inst ? (
                          <Link
                            to={ficheHref(inst.id, inst.type)}
                            className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                          >
                            {inst.name}
                          </Link>
                        ) : null}
                        {e.amount ? (
                          <Money value={e.amount} decimals={2} className="text-xs font-semibold" />
                        ) : null}
                        <Badge variant="outline">{eventLabel(e.type, t)}</Badge>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted">
            {t('alerts.emailNotice', 'Notifications e-mail de démonstration : aucun envoi réel.')}
          </p>
        </div>
      )}

      <AlertFormDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} />
    </>
  )
}
