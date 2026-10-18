import * as React from 'react'
import { useT } from '@/i18n'
import { useStore } from '@/state/store'
import type { Alert as AlertModel, AlertType } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Checkbox, Switch } from '@/components/ui/controls'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'

const ALERT_TYPES: AlertType[] = [
  'PRICE_ABOVE',
  'PRICE_BELOW',
  'DAY_CHANGE',
  'VL_PUBLISHED',
  'DIVIDEND_DETACH',
]

export function typeLabel(type: AlertType, t: (key: string, fallback?: string) => string): string {
  switch (type) {
    case 'PRICE_ABOVE':
      return t('alertType.priceAbove', 'Cours ≥')
    case 'PRICE_BELOW':
      return t('alertType.priceBelow', 'Cours ≤')
    case 'DAY_CHANGE':
      return t('alertType.dayChange', 'Variation journalière')
    case 'VL_PUBLISHED':
      return t('alertType.vlPublished', 'Publication de VL')
    case 'DIVIDEND_DETACH':
      return t('alertType.dividendDetach', 'Détachement de dividende')
  }
}

function thresholdHint(type: AlertType, t: (key: string, fallback?: string) => string): string {
  switch (type) {
    case 'PRICE_ABOVE':
    case 'PRICE_BELOW':
      return t('alerts.hintPrice', 'Cours ou VL en MAD (ex. 750)')
    case 'DAY_CHANGE':
      return t('alerts.hintDayChange', 'Variation en % (ex. 3 pour ± 3 %)')
    case 'VL_PUBLISHED':
      return t('alerts.hintVl', 'Ordre de grandeur de la VL attendue (MAD)')
    case 'DIVIDEND_DETACH':
      return t('alerts.hintDividend', 'Dividende attendu par action (MAD)')
  }
}

/**
 * Formulaire de création / édition d'une alerte.
 * Rendu dans un Dialog « sheet » sur mobile.
 */
export function AlertFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Alert existante en cours d'édition, ou null pour une nouvelle alerte */
  initial: AlertModel | null
}) {
  const t = useT()
  const { instruments, instrumentById, quoteById, saveAlert } = useStore()
  const { push } = useToast()

  const [instrumentId, setInstrumentId] = React.useState('')
  const [type, setType] = React.useState<AlertType>('PRICE_ABOVE')
  const [threshold, setThreshold] = React.useState('')
  const [inApp, setInApp] = React.useState(true)
  const [email, setEmail] = React.useState(false)
  const [active, setActive] = React.useState(true)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const first = instruments.find((i) => i.active) ?? instruments[0]
    const instId = initial?.instrumentId ?? first?.id ?? ''
    const quote = quoteById.get(instId)
    setType(initial?.type ?? 'PRICE_ABOVE')
    setInstrumentId(instId)
    setThreshold(
      initial
        ? String(initial.threshold)
        : quote
          ? quote.close.toFixed(2)
          : '',
    )
    setInApp(initial ? initial.channels.includes('IN_APP') : true)
    setEmail(initial?.channels.includes('EMAIL') ?? false)
    setActive(initial?.active ?? true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = Number(threshold.replace(',', '.'))
    const channels: AlertModel['channels'] = []
    if (inApp) channels.push('IN_APP')
    if (email) channels.push('EMAIL')
    if (!instrumentId || !Number.isFinite(value) || channels.length === 0) return

    setBusy(true)
    try {
      const model: AlertModel = {
        id: initial?.id ?? `al_${Date.now().toString(36)}`,
        portfolioId: initial?.portfolioId ?? null,
        instrumentId,
        type,
        threshold: value,
        active,
        channels,
        createdAt: initial?.createdAt ?? new Date().toISOString(),
      }
      if (initial?.triggeredAt) model.triggeredAt = initial.triggeredAt
      await saveAlert(model)
      onOpenChange(false)
      push({
        title: initial
          ? t('alerts.updated', 'Alerte mise à jour')
          : t('alerts.created', 'Alerte créée'),
        description: instrumentById.get(instrumentId)?.name,
        tone: 'success',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent sheet>
        <DialogHeader>
          <DialogTitle>
            {initial ? t('alerts.edit', 'Modifier l’alerte') : t('alerts.add', 'Nouvelle alerte')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)}>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="alert-instrument" required>
                {t('common.name', 'Instrument')}
              </Label>
              <Select
                id="alert-instrument"
                value={instrumentId}
                onChange={(e) => setInstrumentId(e.target.value)}
                required
              >
                <option value="">{t('alerts.pickInstrument', 'Choisir une valeur ou un fonds…')}</option>
                {instruments
                  .filter((i) => i.active)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.ticker})
                    </option>
                  ))}
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="alert-type" required>
                  {t('common.type', 'Type')}
                </Label>
                <Select
                  id="alert-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as AlertType)}
                >
                  {ALERT_TYPES.map((at) => (
                    <option key={at} value={at}>
                      {typeLabel(at, t)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="alert-threshold" required>
                  {t('alerts.threshold', 'Seuil')}
                </Label>
                <Input
                  id="alert-threshold"
                  inputMode="decimal"
                  required
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  aria-describedby="alert-threshold-hint"
                />
                <p id="alert-threshold-hint" className="mt-1 text-xs text-muted">
                  {thresholdHint(type, t)}
                </p>
              </div>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-anthracite-700 dark:text-anthracite-300">
                {t('alerts.channels', 'Canaux de notification')}
              </legend>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="flex items-center gap-2">
                  <Checkbox
                    id="alert-inapp"
                    checked={inApp}
                    onCheckedChange={(v) => setInApp(v === true)}
                  />
                  <Label htmlFor="alert-inapp" className="mb-0">
                    {t('alerts.inApp', 'Notification in-app')}
                  </Label>
                </span>
                <span className="flex items-center gap-2">
                  <Checkbox
                    id="alert-email"
                    checked={email}
                    onCheckedChange={(v) => setEmail(v === true)}
                  />
                  <Label htmlFor="alert-email" className="mb-0">
                    {t('alerts.email', 'E-mail')}
                  </Label>
                </span>
              </div>
            </fieldset>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <Label htmlFor="alert-active" className="mb-0">
                {t('alerts.active', 'Alerte active')}
              </Label>
              <Switch id="alert-active" checked={active} onCheckedChange={setActive} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button type="submit" disabled={busy || !instrumentId}>
              {t('common.save', 'Enregistrer')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
