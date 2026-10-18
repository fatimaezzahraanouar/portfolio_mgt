const PREFIX = 'patrimoine.ma/v1/'

export const storage = {
  read<T>(key: string, fallback: T): T {
    if (typeof localStorage === 'undefined') return fallback
    try {
      const raw = localStorage.getItem(PREFIX + key)
      if (!raw) return fallback
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  },
  write<T>(key: string, value: T): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      /* quota dépassé : on ignore silencieusement */
    }
  },
  remove(key: string): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.removeItem(PREFIX + key)
    } catch {
      /* noop */
    }
  },
  clearAll(): void {
    if (typeof localStorage === 'undefined') return
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => localStorage.removeItem(k))
    } catch {
      /* noop */
    }
  },
}
