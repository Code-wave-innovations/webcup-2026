import { useEffect, useRef, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useMe } from '../../api/me'
import { isStaffRole, useCitizenUser, useStaffSignedIn, useStaffUser } from '../../api/session'
import type { User } from '../../api/types'
import { toast } from '../stores/toastStore'
import { ButtonLink } from '../ui/Button'
import { AccessFrame } from './AccessFrame'
import { loginPath, usePersona } from './persona'
import { useSessionExpired } from './sessionNotice'
import styles from './Access.module.css'

/*
  D09: the back-office opens to agents and admins only, and /admin to admins only. These guards shape
  the interface; the API refuses the same requests (401/403) whatever the screen shows.
*/

/** A resident's session reached the back-office: nothing of it is rendered. */
function StaffOnlyScreen({ user }: { user: User }) {
  const persona = usePersona()
  return (
    <AccessFrame
      space={persona === 'ADMIN' ? 'Administration' : 'Espace agent'}
      title="Espace réservé au personnel municipal"
      lead={
        <>
          Vous êtes connecté·e avec le compte d’habitant <strong>{user.email}</strong>. Les outils des agents et des administrateurs ne
          vous sont pas accessibles. Votre session habitant reste active sur la ville.
        </>
      }
    >
      <div className={[styles.actions, styles.form].join(' ')}>
        <ButtonLink to="/ville" variant="primary" icon="globe">
          Retour à mon espace
        </ButtonLink>
        <ButtonLink to={loginPath(persona)} icon="swap">
          Connexion agent / admin
        </ButtonLink>
      </div>
    </AccessFrame>
  )
}

/** An agent asked for /admin: back to the agent workspace, with the reason. */
function AdminOnlyRedirect() {
  const navigate = useNavigate()
  // StrictMode runs effects twice in development: one toast is enough
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    toast('Administration réservée aux administrateurs : vous êtes dans l’espace agent.', 'alert')
    navigate('/agent', { replace: true })
  }, [navigate])
  return null
}

export function RequireStaff({ children }: { children: ReactNode }) {
  const persona = usePersona()
  const staffSignedIn = useStaffSignedIn()
  const staff = useStaffUser()
  const citizen = useCitizenUser()
  const expired = useSessionExpired()
  const { pathname, search } = useLocation()
  // the server's view of the account (role, deactivation) refreshes the session's copy
  useMe(staffSignedIn)

  if (!staff || !isStaffRole(staff.role)) {
    if (citizen) return <StaffOnlyScreen user={citizen} />
    return <Navigate to={loginPath(persona, pathname + search, expired)} replace />
  }
  if (persona === 'ADMIN' && staff.role !== 'ADMIN') return <AdminOnlyRedirect />
  return children
}
