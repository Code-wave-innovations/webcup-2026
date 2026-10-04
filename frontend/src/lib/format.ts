import { currentLocale, LOCALE_TAG, type Locale } from '../i18n/locale'

/** 2140 → "2 140" in French, "2,140" in English. */
export function formatThousands(n: number, locale: Locale = currentLocale()): string {
  if (locale === 'en') return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** Wall-clock HH:MM in the browser's local time zone. */
export function formatLocalTime(moment: number): string {
  const date = new Date(moment)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const publishedFormats: Partial<Record<Locale, Intl.DateTimeFormat>> = {}

/** Publication date shown to residents, e.g. "2 octobre 2026" / "2 October 2026". */
export function formatPublished(iso: string, locale: Locale = currentLocale()): string {
  publishedFormats[locale] ??= new Intl.DateTimeFormat(LOCALE_TAG[locale], { day: 'numeric', month: 'long', year: 'numeric' })
  return publishedFormats[locale].format(new Date(iso))
}

const dateTimeFormats: Partial<Record<Locale, Intl.DateTimeFormat>> = {}

/** "04/10, 14:30" (day/month in both languages). */
export function formatDateTime(iso: string, locale: Locale = currentLocale()): string {
  dateTimeFormats[locale] ??= new Intl.DateTimeFormat(LOCALE_TAG[locale], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return dateTimeFormats[locale].format(new Date(iso))
}

/** "à l’instant", "il y a 12 min", "il y a 3 h", "il y a 2 j" — or "just now", "12 min ago", "in 3 h"… */
export function formatRelative(iso: string, now: number, locale: Locale = currentLocale()): string {
  const diff = now - new Date(iso).getTime()
  const future = diff < 0
  const minutesExact = Math.abs(diff) / 60_000
  const en = locale === 'en'
  if (minutesExact < 1) return en ? 'just now' : 'à l’instant'
  const minutes = Math.round(minutesExact)
  let text: string
  if (minutes < 60) text = `${minutes} min`
  else if (minutes < 60 * 24) text = `${Math.round(minutes / 60)} h`
  else text = en ? `${Math.round(minutes / 1440)} d` : `${Math.round(minutes / 1440)} j`
  if (en) return future ? `in ${text}` : `${text} ago`
  return future ? `dans ${text}` : `il y a ${text}`
}
