import * as React from 'react'
import type { Locale } from '@/domain/types'
import { storage } from '@/data/storage'
import { fr, type MessageKey } from './locales/fr'
import { en } from './locales/en'
import { ar } from './locales/ar'

const DICTS: Record<Locale, Partial<Record<MessageKey, string>>> = { fr, en, ar }

type TranslateFn = (key: string, fallback?: string) => string

interface I18nValue {
  locale: Locale
  setLocale: (l: Locale) => void
  dir: 'ltr' | 'rtl'
  t: TranslateFn
}

const I18nContext = React.createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(() =>
    storage.read<Locale>('locale', 'fr'),
  )

  const dir: 'ltr' | 'rtl' = locale === 'ar' ? 'rtl' : 'ltr'

  React.useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = dir
    storage.write('locale', locale)
  }, [locale, dir])

  const setLocale = React.useCallback((l: Locale) => setLocaleState(l), [])

  const t = React.useCallback<TranslateFn>(
    (key, fallback) => {
      const dict = DICTS[locale] ?? fr
      const value = dict[key as MessageKey] ?? fr[key as MessageKey]
      if (value) return value
      if (fallback) return fallback
      return key
    },
    [locale],
  )

  const value = React.useMemo(() => ({ locale, setLocale, dir, t }), [locale, setLocale, dir, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = React.useContext(I18nContext)
  if (!ctx) throw new Error('useI18n doit être utilisé dans <I18nProvider>')
  return ctx
}

export function useT(): TranslateFn {
  return useI18n().t
}
