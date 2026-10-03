import { http } from './client'
import { signIn } from './session'
import type { AuthResponse } from './types'

// D03: the screens (airlock, back-office login) arrive with PLAN-01; this is the call they share.

/** Checks the credentials without opening a session: the caller decides (the back-office refuses citizens). */
export async function requestLogin(email: string, password: string): Promise<AuthResponse> {
  return (await http.post<AuthResponse>('/auth/login', { email, password })).data
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const auth = await requestLogin(email, password)
  signIn(auth)
  return auth
}
