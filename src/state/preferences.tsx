import * as React from 'react'
import { storage } from '@/data/storage'

type Theme = 'light' | 'dark' | 'system'

interface PreferencesValue {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (t: Theme) => void
  toggleTheme: () => void
  maskAmounts: boolean
  setMaskAmounts: (v: boolean) => void
  toggleMask: () => void
}

const PreferencesContext = React.createContext<PreferencesValue | null>(null)

interface Persisted {
  theme: Theme
  maskAmounts: boolean
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const initial = storage.read<Persisted>('preferences', { theme: 'light', maskAmounts: false })
  const [theme, setThemeState] = React.useState<Theme>(initial.theme ?? 'light')
  const [maskAmounts, setMaskState] = React.useState<boolean>(Boolean(initial.maskAmounts))
  const [systemDark, setSystemDark] = React.useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches,
  )

  React.useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', resolvedTheme === 'dark' ? '#0f1115' : '#ffffff')
    storage.write('preferences', { theme, maskAmounts } satisfies Persisted)
  }, [resolvedTheme, theme, maskAmounts])

  const setTheme = React.useCallback((t: Theme) => setThemeState(t), [])
  const toggleTheme = React.useCallback(
    () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    [],
  )
  const setMaskAmounts = React.useCallback((v: boolean) => setMaskState(v), [])
  const toggleMask = React.useCallback(() => setMaskState((v) => !v), [])

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme, maskAmounts, setMaskAmounts, toggleMask }),
    [theme, resolvedTheme, setTheme, toggleTheme, maskAmounts, setMaskAmounts, toggleMask],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesValue {
  const ctx = React.useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences doit être utilisé dans <PreferencesProvider>')
  return ctx
}
