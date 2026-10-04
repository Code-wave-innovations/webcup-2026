import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { useUpdateMe } from '../api/me'
import { queryClient } from '../api/queryClient'
import { useCitizenUser } from '../api/session'
import { DEFAULT_LOCALE, useLocaleStore } from './locale'

const isStaffPath = (pathname: string) => pathname.startsWith('/agent') || pathname.startsWith('/admin')

/**
 * D14 / F27: keeps the page, the API and the resident's profile in the chosen language.
 * - `<html lang>` follows the language (always `fr` in the back-office), for screen readers.
 * - On a switch, the server data is fetched again: the API sends translated content (`?lang=`).
 * - Signed in, a language picked in this browser is saved on the profile (notifications, e-mails);
 *   without a choice here yet, the profile's language is adopted.
 */
export function LocaleSync() {
  const { pathname } = useLocation()
  const locale = useLocaleStore((s) => s.locale)
  const chosen = useLocaleStore((s) => s.chosen)
  const staff = isStaffPath(pathname)
  const citizen = useCitizenUser()
  const { mutate } = useUpdateMe()

  useEffect(() => {
    document.documentElement.lang = staff ? DEFAULT_LOCALE : locale
  }, [locale, staff])

  const previous = useRef(locale)
  useEffect(() => {
    if (previous.current === locale) return
    previous.current = locale
    if (!staff) void queryClient.invalidateQueries()
  }, [locale, staff])

  const profileLocale = citizen?.locale
  // one save attempt per language, so a failed request is not retried in a loop
  const savedLocale = useRef<string | null>(null)
  useEffect(() => {
    if (staff || !profileLocale || profileLocale === locale) return
    if (!chosen) {
      if (profileLocale === 'fr' || profileLocale === 'en') useLocaleStore.getState().setLocale(profileLocale, false)
      return
    }
    if (savedLocale.current === locale) return
    savedLocale.current = locale
    mutate({ locale })
  }, [chosen, locale, mutate, profileLocale, staff])

  return null
}
