import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { useAuth } from '@/state/auth'
import { useT } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { AuthLayout } from './LoginPage'

export default function OtpPage() {
  const t = useT()
  const { verifyOtp, resendOtp, pendingEmail, status, demoOtp } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  React.useEffect(() => {
    if (status === 'authenticated') navigate('/', { replace: true })
  }, [status, navigate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const ok = await verifyOtp(code)
    setBusy(false)
    if (!ok) setError('Code invalide. Vérifiez le code reçu.')
    else navigate('/', { replace: true })
  }

  return (
    <AuthLayout
      title={t('auth.2fa')}
      subtitle={`${t('auth.otpSent')} ${pendingEmail ? `à ${pendingEmail}` : ''}`}
      footer={
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="text-brand-700 hover:underline"
        >
          ← Retour à la connexion
        </button>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? <Alert variant="danger">{error}</Alert> : null}
        <div>
          <Label htmlFor="otp" required>
            {t('auth.otp')}
          </Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-anthracite-400" />
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              className="ps-9 text-center text-lg font-bold tracking-[0.5em]"
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
          {busy ? '…' : t('auth.verify')}
        </Button>
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            className="text-brand-700 hover:underline"
            onClick={async () => {
              await resendOtp()
              setSent(true)
            }}
          >
            Renvoyer le code
          </button>
          {sent ? <span className="text-gain-600">Code renvoyé</span> : null}
        </div>
        <Alert variant="neutral" title="2FA de démonstration">
          {t('auth.demoHint')} <strong className="tabular">{demoOtp}</strong>
        </Alert>
      </form>
    </AuthLayout>
  )
}
