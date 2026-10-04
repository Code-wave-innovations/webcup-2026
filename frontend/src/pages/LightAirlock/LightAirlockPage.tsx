import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { switchScene } from '../../a11y/sceneMode'
import { signIn as bindApiSession } from '../../api/session'
import type { User } from '../../api/types'
import { AccessHologram } from '../../features/auth/AccessHologram'
import type { Session } from '../../features/auth/authService'
import { useAuthStore } from '../../features/auth/authStore'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { defineMessages, useMessages } from '../../i18n'
import styles from './LightAirlock.module.css'

const messages = defineMessages(
  {
    title: 'Connexion',
    complete: 'Version complète, avec la 3D',
  },
  {
    title: 'Sign in',
    complete: 'Full version, with 3D',
  },
)

/** Where the airlock sends a signed-in visitor: `?retour=` when it points inside the city, else its home. */
function destination(back: string | null): string {
  return back && back.startsWith('/ville') ? back : '/ville'
}

/**
 * F96: the airlock in the light version: the same access panel (identifier, then code or registration),
 * without the orbit, Nova or the camera, and straight into the city's home once signed in.
 */
export default function LightAirlockPage() {
  const m = useMessages(messages)
  useDocumentTitle(m.title)
  const session = useAuthStore((s) => s.session)
  const signIn = useAuthStore((s) => s.signIn)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const back = destination(params.get('retour'))

  useEffect(() => {
    if (session) navigate(back, { replace: true })
  }, [session, back, navigate])

  const onGranted = (granted: Session) => {
    if (granted.auth) bindApiSession({ token: granted.auth.token, user: granted.auth.user as User })
    signIn(granted)
  }

  return (
    <main id="contenu" className={styles.airlock} aria-labelledby="airlock-title">
      <AccessHologram collapsed={false} faceLogin={false} onGranted={onGranted} />
      <button type="button" className={styles.complete} onClick={() => switchScene('complete')}>
        {m.complete}
      </button>
    </main>
  )
}
