import { browserSupportsWebAuthn, startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { http } from './client'
import { signIn } from './session'
import type { AuthResponse, LoginStep, TwoFactorSetup } from './types'

// D03 / F53 / D02: the sign-in calls shared by the airlock and the back-office login.

/** Checks the credentials without opening a session: the caller decides (the back-office refuses citizens). */
export async function requestLogin(email: string, password: string): Promise<LoginStep> {
  return (await http.post<LoginStep>('/auth/login', { email, password })).data
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const step = await requestLogin(email, password)
  if (!('token' in step)) throw new Error('A second step is required')
  signIn(step)
  return step
}

export const isSession = (step: LoginStep): step is AuthResponse => 'token' in step

/** F53: second step, with a code from the app or a single-use recovery code */
export async function verifyTwoFactor(challengeToken: string, answer: { code: string } | { recovery_code: string }): Promise<AuthResponse> {
  return (await http.post<AuthResponse>('/auth/2fa/verify', { challenge_token: challengeToken, ...answer })).data
}

/** F53: the policy requires a second factor: start the setup during the sign-in */
export async function startEnforcedSetup(setupToken: string): Promise<TwoFactorSetup> {
  return (await http.post<TwoFactorSetup>('/auth/2fa/setup', { setup_token: setupToken })).data
}

/** F53: confirms the first code; the session opens, with the recovery codes (shown once) */
export async function finishEnforcedSetup(setupToken: string, code: string): Promise<AuthResponse> {
  return (await http.post<AuthResponse>('/auth/2fa/activate', { setup_token: setupToken, code })).data
}

export const passkeysSupported = () => browserSupportsWebAuthn()

/** D02: sign in with a passkey (fingerprint, device PIN), for an e-mail or any passkey of this site */
export async function loginWithPasskey(email?: string): Promise<AuthResponse> {
  const { options, challenge_token } = (
    await http.post<{ options: PublicKeyCredentialRequestOptionsJSON; challenge_token: string }>('/auth/passkey/options', email ? { email } : {})
  ).data
  const response = await startAuthentication({ optionsJSON: options })
  return (await http.post<AuthResponse>('/auth/passkey/verify', { challenge_token, response })).data
}
