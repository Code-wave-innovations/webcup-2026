import { LOCALES, setLocale, useLocale, type Locale } from '../i18n'
import styles from './LanguageSwitch.module.css'

/** Each language is named in itself, so a visitor who reads only one finds it. */
const NAMES: Record<Locale, string> = { fr: 'Français', en: 'English' }

/** D14: French / English switch of the citizen space (`floating` pins it top right, for screens without a bar). */
export function LanguageSwitch({ variant = 'bar' }: { variant?: 'bar' | 'floating' }) {
  const locale = useLocale()
  return (
    <div className={styles.switch} data-variant={variant} role="group" aria-label={locale === 'fr' ? 'Langue' : 'Language'}>
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={option === locale}
          aria-label={NAMES[option]}
          title={NAMES[option]}
          onClick={() => setLocale(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
