import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/state/auth'
import { useT } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { AuthLayout } from './LoginPage'

export default function RegisterPage() {
  const t = useT()
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = React.useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
  })
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await register(form)
      navigate('/otp')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inscription impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.signUp')}
      subtitle="Créez votre espace : portefeuilles illimités, données chiffrées."
      footer={
        <>
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            {t('auth.signIn')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? <Alert variant="danger">{error}</Alert> : null}
        <div>
          <Label htmlFor="fullName" required>
            {t('auth.fullName')}
          </Label>
          <Input id="fullName" required value={form.fullName} onChange={set('fullName')} />
        </div>
        <div>
          <Label htmlFor="regEmail" required>
            {t('auth.email')}
          </Label>
          <Input
            id="regEmail"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={set('email')}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="regPassword" required>
              {t('auth.password')}
            </Label>
            <Input
              id="regPassword"
              type="password"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={set('password')}
            />
            <p className="mt-1 text-xs text-muted">6 caractères minimum</p>
          </div>
          <div>
            <Label htmlFor="phone">{t('auth.phone')}</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+212 6 …"
              value={form.phone}
              onChange={set('phone')}
            />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? '…' : t('auth.signUp')}
        </Button>
        <p className="text-[11px] leading-relaxed text-muted">{t('app.legal')}</p>
      </form>
    </AuthLayout>
  )
}
