import * as React from 'react'
import { storage } from '@/data/storage'
import { SEED_USER } from '@/data/demo/transactions'

export interface AuthUser {
  id: string
  email: string
  fullName: string
}

type Status = 'authenticated' | 'unauthenticated' | 'otp-pending'

interface AuthValue {
  status: Status
  user: AuthUser | null
  pendingEmail: string | null
  /** Code OTP de démonstration (à remplacer par l'envoi réel SMS / e-mail) */
  demoOtp: string
  signIn: (email: string, password: string) => Promise<{ otpRequired: boolean }>
  register: (input: {
    fullName: string
    email: string
    password: string
    phone?: string
  }) => Promise<{ otpRequired: boolean }>
  verifyOtp: (code: string) => Promise<boolean>
  resendOtp: () => Promise<void>
  signOut: () => void
}

const AuthContext = React.createContext<AuthValue | null>(null)

const SESSION_KEY = 'session'
const SIGNED_OUT_KEY = 'signed-out'
const DEMO_OTP = '426831'

interface Session {
  user: AuthUser
}

function currentSession(): Session | null {
  if (storage.read<boolean>(SIGNED_OUT_KEY, false)) return null
  return storage.read<Session | null>(SESSION_KEY, null) ?? {
    user: { id: SEED_USER.id, email: SEED_USER.email, fullName: SEED_USER.fullName },
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(() => currentSession())
  const [pendingEmail, setPendingEmail] = React.useState<string | null>(null)

  const signIn = React.useCallback(async (email: string, _password: string) => {
    if (!email.includes('@')) throw new Error('Adresse e-mail invalide.')
    setPendingEmail(email)
    return { otpRequired: true }
  }, [])

  const register = React.useCallback(
    async (input: { fullName: string; email: string; password: string; phone?: string }) => {
      if (!input.email.includes('@')) throw new Error('Adresse e-mail invalide.')
      if (input.password.length < 6) throw new Error('Mot de passe : 6 caractères minimum.')
      setPendingEmail(input.email)
      return { otpRequired: true }
    },
    [],
  )

  const verifyOtp = React.useCallback(
    async (code: string) => {
      if (code.trim() !== DEMO_OTP) return false
      const email = pendingEmail ?? SEED_USER.email
      const next: Session = {
        user: {
          id: SEED_USER.id,
          email,
          fullName: email === SEED_USER.email ? SEED_USER.fullName : email.split('@')[0],
        },
      }
      storage.write(SESSION_KEY, next)
      storage.remove(SIGNED_OUT_KEY)
      setSession(next)
      setPendingEmail(null)
      return true
    },
    [pendingEmail],
  )

  const resendOtp = React.useCallback(async () => {
    await new Promise((r) => setTimeout(r, 400))
  }, [])

  const signOut = React.useCallback(() => {
    storage.write(SIGNED_OUT_KEY, true)
    storage.remove(SESSION_KEY)
    setSession(null)
    setPendingEmail(null)
  }, [])

  const value = React.useMemo<AuthValue>(
    () => ({
      status: session ? 'authenticated' : pendingEmail ? 'otp-pending' : 'unauthenticated',
      user: session?.user ?? null,
      pendingEmail,
      demoOtp: DEMO_OTP,
      signIn,
      register,
      verifyOtp,
      resendOtp,
      signOut,
    }),
    [session, pendingEmail, signIn, register, verifyOtp, resendOtp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
