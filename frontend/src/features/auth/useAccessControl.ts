import { useCallback, useEffect, useRef, useState } from 'react'
import { LOCK_MS, lockSecondsLeft } from './accessLock'
import type { AuthService, Session, SignInResult } from './authService'
import type { LoginActivity } from './loginActivity'
import { attemptsLeft, INITIAL_LOGIN, reduceLogin, type LoginEvent, type LoginState } from './loginMachine'

/**
 * The airlock's access control as a hook: the login machine, the service call, the lock countdown,
 * and the activity published at each transition.
 */
export function useAccessControl(service: AuthService, onActivity?: (activity: LoginActivity) => void) {
  const [state, setState] = useState<LoginState>(INITIAL_LOGIN)
  const [now, setNow] = useState(0)
  const current = useRef(state)
  const publish = useRef(onActivity)
  useEffect(() => {
    publish.current = onActivity
  })

  const send = useCallback((event: LoginEvent) => {
    const next = reduceLogin(current.current, event)
    current.current = next
    setState(next)
    return next
  }, [])

  // the lock counts down every second, then reopens by itself
  const locked = state.status === 'locked'
  useEffect(() => {
    if (!locked) return
    const timer = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (send({ type: 'tick', now: t }).status !== 'locked') publish.current?.({ type: 'unlocked' })
    }, 250)
    return () => clearInterval(timer)
  }, [locked, send])

  /**
   * Runs one check through the machine, whatever proves the identity (access code or face). Resolves
   * with the result, or null when no check could start (already checking, locked, incomplete). An
   * inconclusive result costs no attempt; the caller says why to the visitor.
   */
  const attempt = async (signIn: () => Promise<SignInResult>, complete = true): Promise<SignInResult | null> => {
    const t = Date.now()
    setNow(t)
    const next = send({ type: 'submit', complete, now: t })
    if (next.status !== 'checking') return null
    publish.current?.({ type: 'checking' })
    const result = await signIn()
    if (result.ok) {
      send({ type: 'granted' })
      publish.current?.({ type: 'granted', name: result.session.name })
      return result
    }
    if (result.inconclusive) {
      send({ type: 'inconclusive' })
      return result
    }
    const after = Date.now()
    setNow(after)
    const refused = send({ type: 'refused', now: after })
    publish.current?.(
      refused.status === 'locked'
        ? { type: 'locked', seconds: LOCK_MS / 1000 }
        : { type: 'refused', attempt: refused.strikes, left: attemptsLeft(refused) },
    )
    return result
  }

  /** Checks the credentials; resolves with the session when access is granted. */
  const submit = async (identifier: string, code: string): Promise<Session | null> => {
    const result = await attempt(() => service.signIn(identifier, code), !!identifier.trim() && !!code.trim())
    return result?.ok ? result.session : null
  }

  return {
    state,
    secondsLeft: locked ? lockSecondsLeft(state.lock, now) : 0,
    attempt,
    submit,
    edit: () => send({ type: 'edit' }),
  }
}
