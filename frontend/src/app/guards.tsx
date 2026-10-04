import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useCitizenSignedIn, useCitizenUser, useStaffUser } from '../api/session'
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

/** D03: personal citizen space — reads `nova-auth-citizen` only. */
export function RequireSession({ children }: { children: ReactNode }) {
  const signedIn = useCitizenSignedIn()
  const { pathname, search } = useLocation()
  return signedIn ? children : <ToAirlock from={pathname + search} />
}

/** D09: pages reserved to some profiles show a clear refusal to the others (the API refuses them too). */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const citizen = useCitizenUser()
  const staff = useStaffUser()
  const citizenOnly = roles.every((role) => role === 'CITIZEN')
  const user = citizenOnly ? citizen : (staff && roles.includes(staff.role) ? staff : citizen && roles.includes(citizen.role) ? citizen : null)
  const allowed = !!user && roles.includes(user.role)
  if (citizenOnly) {
    return <RequireSession>{allowed ? children : <AccessDeniedPage />}</RequireSession>
  }
  return allowed ? children : <AccessDeniedPage />
}
