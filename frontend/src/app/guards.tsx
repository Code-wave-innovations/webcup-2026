import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useRole, useSignedIn } from '../api/session'
import type { Role } from '../api/types'
import { AccessDeniedPage } from '../pages/Console/AccessDeniedPage'
import { airlockPath, rewindToCockpit } from './airlock'

/** Without a session, back to the airlock, which returns here after login. */
function ToAirlock({ from }: { from: string }) {
  const navigate = useNavigate()
  useEffect(() => {
    rewindToCockpit()
    navigate(airlockPath(from), { replace: true })
  }, [from, navigate])
  return null
}

/** D03: pages of a personal space need an account. */
export function RequireSession({ children }: { children: ReactNode }) {
  const signedIn = useSignedIn()
  const { pathname, search } = useLocation()
  return signedIn ? children : <ToAirlock from={pathname + search} />
}

/** D09: pages reserved to some profiles show a clear refusal to the others (the API refuses them too). */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const role = useRole()
  return (
    <RequireSession>{role && roles.includes(role) ? children : <AccessDeniedPage />}</RequireSession>
  )
}
