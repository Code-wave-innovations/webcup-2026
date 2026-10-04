import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/*
  D14: the language of the citizen space (French or English), chosen per browser.
  The back-office (/agent, /admin) stays in French whatever is chosen here, so the modules
  it shares with the citizen space (api/errors, useApiForm, cityTime…) read `currentLocale()`.
*/

export type Locale = 'fr' | 'en'

export const LOCALES: readonly Locale[] = ['fr', 'en']
export const DEFAULT_LOCALE: Locale = 'fr'

/** BCP 47 tag for Intl formatting (dates in day/month order in both languages). */
export const LOCALE_TAG: Record<Locale, string> = { fr: 'fr-FR', en: 'en-GB' }

const STORAGE_KEY = 'nova-locale'

const isLocale = (value: unknown): value is Locale => value === 'fr' || value === 'en'

interface LocaleState {
  locale: Locale
  /** true once the visitor picked a language themselves (it then wins over their profile) */
  chosen: boolean
  setLocale: (locale: Locale, chosen?: boolean) => void
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      // the platform speaks French until the visitor picks English (or their profile says so)
      locale: DEFAULT_LOCALE,
      chosen: false,
      setLocale: (locale, chosen = true) => set((state) => ({ locale, chosen: state.chosen || chosen })),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ locale: s.locale, chosen: s.chosen }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<LocaleState> | undefined
        return { ...current, locale: isLocale(saved?.locale) ? saved.locale : current.locale, chosen: saved?.chosen === true }
      },
    },
  ),
)

const onStaffPath = () => {
  if (typeof window === 'undefined') return false
  const path = window.location.pathname
  return path.startsWith('/agent') || path.startsWith('/admin')
}

/** The language to use right now, outside React (always French in the back-office). */
export function currentLocale(): Locale {
  return onStaffPath() ? DEFAULT_LOCALE : useLocaleStore.getState().locale
}

/** The language to render with; re-renders the component when the visitor switches. */
export function useLocale(): Locale {
  const locale = useLocaleStore((s) => s.locale)
  return onStaffPath() ? DEFAULT_LOCALE : locale
}

export const setLocale = (locale: Locale) => useLocaleStore.getState().setLocale(locale)

export const localeTag = (locale: Locale = currentLocale()) => LOCALE_TAG[locale]

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) void useLocaleStore.persist.rehydrate()
  })
}
