import { useEffect, useRef } from 'react'
import { defineMessages, useLocale, useMessages } from '../../i18n'
import { turnstileSiteKey } from './formGuard'
import styles from './Turnstile.module.css'

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string
      theme?: 'dark' | 'light' | 'auto'
      /** widget language (ISO code, or 'auto' for the browser's) */
      language?: string
      callback?: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
    },
  ) => string
  reset: (widgetId?: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const messages = defineMessages(
  {
    missing: 'Vérification anti-robot indisponible (clé Turnstile manquante).',
    hint: 'Confirmez que vous n’êtes pas un robot, puis continuez.',
  },
  {
    missing: 'Anti-robot check unavailable (Turnstile key missing).',
    hint: 'Confirm that you are not a robot, then continue.',
  },
)

const SCRIPT_ID = 'cf-turnstile-script'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Turnstile script failed')), { once: true })
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Turnstile script failed'))
    document.head.appendChild(script)
  })
}

interface TurnstileProps {
  onToken: (token: string | null) => void
}

/** Managed Turnstile widget, shown only when the API asks for a challenge. */
export function Turnstile({ onToken }: TurnstileProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  useEffect(() => {
    onTokenRef.current = onToken
  })

  const sitekey = turnstileSiteKey()
  const locale = useLocale()
  const m = useMessages(messages)

  useEffect(() => {
    if (!sitekey || !hostRef.current) return
    let cancelled = false

    void loadScript()
      .then(() => {
        if (cancelled || !hostRef.current || !window.turnstile) return
        widgetId.current = window.turnstile.render(hostRef.current, {
          sitekey,
          theme: 'dark',
          // D14: the challenge speaks the visitor's language (a switch renders it again)
          language: locale,
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        })
      })
      .catch(() => onTokenRef.current(null))

    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = null
      }
    }
  }, [sitekey, locale])

  if (!sitekey) {
    return (
      <p className={styles.missing} role="status">
        {m.missing}
      </p>
    )
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>{m.hint}</p>
      <div ref={hostRef} className={styles.widget} />
    </div>
  )
}
