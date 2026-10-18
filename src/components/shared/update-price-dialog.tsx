import * as React from 'react'
import { PencilLine } from 'lucide-react'
import { useStore } from '@/state/store'
import { useT } from '@/i18n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { useToast } from '@/components/ui/toast'
import { todayISO } from '@/lib/format'

/**
 * Mise à jour manuelle d'un cours (action) ou d'une VL (OPCVM).
 * Nécessaire tant qu'aucun DataProvider temps réel n'est branché.
 */
export function UpdatePriceDialog({
  instrumentId,
  label,
  currentPrice,
}: {
  instrumentId: string
  label: string
  currentPrice: number
}) {
  const t = useT()
  const { updatePrice } = useStore()
  const { push } = useToast()
  const [open, setOpen] = React.useState(false)
  const [price, setPrice] = React.useState(String(currentPrice))
  const [date, setDate] = React.useState(todayISO())
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setPrice(String(currentPrice))
      setDate(todayISO())
    }
  }, [open, currentPrice])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = Number(price.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) return
    setBusy(true)
    await updatePrice(instrumentId, value, date)
    setBusy(false)
    setOpen(false)
    push({
      title: 'Cours mis à jour',
      description: `${label} : ${value.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD au ${date}`,
      tone: 'success',
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PencilLine /> {t('common.update')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent sheet>
          <DialogHeader>
            <DialogTitle>{t('actions.updatePrice')}</DialogTitle>
            <p className="text-xs text-muted">{label}</p>
          </DialogHeader>
          <form onSubmit={onSubmit}>
            <DialogBody className="space-y-4">
              <Alert variant="warning">
                Saisie manuelle : le cours sera marqué comme saisi par l’utilisateur et remplacera la
                dernière valeur affichée (données différées / à titre indicatif).
              </Alert>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="manual-price" required>
                    Nouveau prix (MAD)
                  </Label>
                  <Input
                    id="manual-price"
                    inputMode="decimal"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="manual-date" required>
                    Date
                  </Label>
                  <Input
                    id="manual-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={busy}>
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
