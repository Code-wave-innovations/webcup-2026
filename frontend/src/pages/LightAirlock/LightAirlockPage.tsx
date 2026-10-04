import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { switchScene } from '../../a11y/sceneMode'
import { barePath } from '../../a11y/scenePaths'
import { signIn as bindApiSession } from '../../api/session'
import type { User } from '../../api/types'
import { AccessHologram } from '../../features/auth/AccessHologram'
import type { Session } from '../../features/auth/authService'
import { useAuthStore } from '../../features/auth/authStore'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import styles from './LightAirlock.module.css'

/** Where the airlock sends a signed-in visitor: `?retour=` when it points inside the city, else its home. */
function destination(back: string | null): string {
  if (!back) return '/ville'
  const cut = back.search(/[?#]/)
  const path = barePath(cut === -1 ? back : back.slice(0, cut))
  const suffix = cut === -1 ? '' : back.slice(cut)
  return path.startsWith('/ville') ? path + suffix : '/ville'
}

/**
 * F96: the airlock in the light version: the same access panel (identifier, then code or registration),
 * without the orbit, Nova or the camera, and straight into the city's home once signed in.
 */
export default function LightAirlockPage() {
  useDocumentTitle('Connexion')
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
      <p className={styles.place}>
        <span>Terra Nova</span>
        <span aria-hidden="true">·</span>
        <span>vue du lac</span>
      </p>
      <AccessHologram collapsed={false} faceLogin={false} onGranted={onGranted} />
      <button type="button" className={styles.complete} onClick={() => switchScene('complete')}>
        Version complète, avec la 3D
      </button>
    </main>
  )
}
