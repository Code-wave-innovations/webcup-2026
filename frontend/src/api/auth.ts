import { http } from './client'
import { signIn } from './session'
import type { AuthResponse } from './types'

// D03: the screens (airlock, back-office login) arrive with PLAN-01; this is the call they share.

export async function login(email: string, password: string): Promise<AuthResponse> {
  const auth = (await http.post<AuthResponse>('/auth/login', { email, password })).data
  signIn(auth)
  return auth
}
