import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '@/state/auth'
import { useT } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const t = useT()
  return (
    <div className="flex min-h-dvh flex-col bg-surface lg:flex-row">
      <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-6 py-8 text-white lg:w-[42%] lg:px-12 lg:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -start-16 h-80 w-80 rounded-full bg-anthracite-950/25 blur-2xl"
        />
        <div className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-base font-bold backdrop-blur">
            P
          </span>
          <div>
            <p className="font-display text-base font-bold">{t('app.name')}</p>
            <p className="text-xs text-white/80">{t('app.tagline')}</p>
          </div>
        </div>

        <div className="relative hidden max-w-md lg:block">
          <h2 className="font-display text-2xl font-bold leading-snug">
            Suivez votre patrimoine financier au Maroc, en un coup d’œil.
          </h2>
          <ul className="mt-6 space-y-3 text-sm text-white/90">
            <li className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Actions de la Bourse de Casablanca
              et OPCVM dans une seule vue
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> PRU, plus-values, dividendes,
              TWR / XIRR et fiscalité estimée
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Lecture seule : aucun ordre réel
              n’est transmis
            </li>
          </ul>
        </div>

        <p className="relative text-[11px] leading-relaxed text-white/70">{t('app.legal')}</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="card p-6 sm:p-7">
            <h1 className="text-xl font-bold text-ink">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
            <div className="mt-5">{children}</div>
          </div>
          {footer ? <div className="mt-4 text-center text-sm text-muted">{footer}</div> : null}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const t = useT()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('investisseur@patrimoine.ma')
  const [password, setPassword] = React.useState('demo1234')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email, password)
      navigate('/otp')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.signIn')}
      subtitle="Accédez à votre espace de suivi patrimonial."
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-brand-700 hover:underline">
            {t('auth.signUp')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? <Alert variant="danger">{error}</Alert> : null}
        <div>
          <Label htmlFor="email" required>
            {t('auth.email')}
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="password" required>
            {t('auth.password')}
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? '…' : t('auth.signIn')}
        </Button>
        <Alert variant="neutral" title="Mode démonstration">
          {t('auth.demoHint')}
        </Alert>
      </form>
    </AuthLayout>
  )
}
