import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type FocusEvent, type FormEvent, type KeyboardEvent, type RefObject } from 'react'
import { useReducedMotion } from '../../hooks/useMediaQuery'
import { Button } from '../../ui/Button'
import { caretPoint } from '../../ui/caretPoint'
import { Field } from '../../ui/Field'
import { hexBurst } from '../../ui/hexBurst'
import { Icon, NovaMark } from '../../ui/Icon'
import { LOCK_MS, MAX_ATTEMPTS } from './accessLock'
import { demoAuthService, isEmail, type Session } from './authService'
import { DEMO_ACCOUNTS, type DemoAccountId } from './demoAccounts'
import { faceAuthService } from './faceAuth'
import type { LoginActivity, LoginField } from './loginActivity'
import type { LoginState } from './loginMachine'
import { useAccessControl } from './useAccessControl'
import styles from './AccessHologram.module.css'

interface AccessHologramProps {
  /** folds the hologram into a line once access is granted */
  collapsed: boolean
  onGranted: (session: Session) => void
  /** everything that happens at the access control, as it happens */
  onActivity?: (activity: LoginActivity) => void
  formRef?: RefObject<HTMLFormElement | null>
}

const DEMO_BUTTONS: ReadonlyArray<readonly [DemoAccountId, string]> = [
  ['miora', 'Habitante, Miora'],
  ['conseil', 'Haut Conseil, Koto'],
]

/** The face scanner (camera, detector worker) loads only when the visitor asks for it. */
const FaceScan = lazy(() => import('./FaceScan').then((module) => ({ default: module.FaceScan })))

/** Linking a face never holds the departure longer than this. */
const LINK_TIMEOUT_MS = 3000

type FaceLink = 'linking' | 'linked' | 'failed'

/** Demo accounts type themselves in, one character every 25 ms. */
const TYPE_MS = 25
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function errorMessage(state: LoginState, secondsLeft: number): string | null {
  switch (state.error) {
    case 'missing':
      return "Saisissez votre identifiant et votre code d'accès."
    case 'refused': {
      const left = MAX_ATTEMPTS - state.strikes
      return `Identifiant ou code refusé. ${left > 1 ? `Encore ${left} essais` : 'Dernier essai'} avant verrouillage.`
    }
    case 'locked':
      return `Accès refusé cinq fois. Le sas est verrouillé, nouvel essai dans ${secondsLeft} s.`
    default:
      return null
  }
}

/**
 * Access control of Terra Nova, projected above the dashboard: e-mail (or short identifier) and access
 * code, demo accounts that type themselves in, five attempts then a 30 s lock. It materialises line by
 * line, sights the focused field, scans while checking, glitches on a refusal and bursts on access.
 */
export function AccessHologram({ collapsed, onGranted, onActivity, formRef }: AccessHologramProps) {
  const reduced = useReducedMotion()
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [granted, setGranted] = useState<Session | null>(null)
  const [mode, setMode] = useState<'code' | 'face'>('code')
  /** an unknown face waits to be linked to the account that signs in next */
  const [faceFrames, setFaceFrames] = useState<Blob[] | null>(null)
  const [faceLink, setFaceLink] = useState<FaceLink | null>(null)
  const access = useAccessControl(demoAuthService, onActivity)
  const { state, secondsLeft } = access
  const ownRef = useRef<HTMLFormElement | null>(null)
  const holoRef = formRef ?? ownRef
  const identifierRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const codeSightRef = useRef<HTMLSpanElement>(null)
  const capsRef = useRef<HTMLParagraphElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  const typing = useRef(0)
  const publish = useRef(onActivity)
  useEffect(() => {
    publish.current = onActivity
  })

  const valid = isEmail(identifier)
  const scanning = mode === 'face' && state.status !== 'locked'
  const checking = state.status === 'checking'
  const locked = state.status === 'locked'
  const message = errorMessage(state, secondsLeft)

  // where the caret is, after each change of the identifier (typed or auto-filled)
  useEffect(() => {
    const input = identifierRef.current
    if (input && document.activeElement === input) publish.current?.({ type: 'typing', field: 'identifier', caret: caretPoint(input) })
  }, [identifier])

  useEffect(() => {
    if (codeRef.current && document.activeElement === codeRef.current) publish.current?.({ type: 'typing', field: 'code', caret: null })
  }, [code])

  useEffect(() => {
    if (identifier) publish.current?.({ type: 'identifierValid', valid })
    // only when validity flips, not on every character
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid])

  useEffect(() => {
    const hint = capsRef.current?.getBoundingClientRect()
    publish.current?.({ type: 'capsLock', on: capsLock, hint: hint ? { x: hint.left + 12, y: hint.top + hint.height / 2 } : null })
  }, [capsLock])

  /** A field group (input and its buttons) gains or loses the focus. */
  const groupFocused = (field: LoginField) => publish.current?.({ type: 'focus', field })
  const groupBlurred = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) publish.current?.({ type: 'focus', field: null })
  }

  const readCapsLock = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState('CapsLock'))

  const toggleReveal = () => {
    const shown = !revealed
    setRevealed(shown)
    publish.current?.({ type: 'reveal', shown })
  }

  // a demo account types itself in, then the focus goes to the submit button
  const fillDemoAccount = async (id: DemoAccountId) => {
    const run = ++typing.current
    const account = DEMO_ACCOUNTS[id]
    access.edit()
    const type = async (input: HTMLInputElement | null, text: string, set: (value: string) => void) => {
      input?.focus()
      if (reduced) return set(text)
      for (let i = 1; i <= text.length; i++) {
        if (run !== typing.current) return
        set(text.slice(0, i))
        await wait(TYPE_MS)
      }
    }
    setIdentifier('')
    setCode('')
    await type(identifierRef.current, account.email, setIdentifier)
    if (run !== typing.current) return
    await wait(reduced ? 0 : 220)
    await type(codeRef.current, account.code, setCode)
    if (run !== typing.current) return
    await wait(reduced ? 0 : 160)
    submitRef.current?.focus()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    typing.current++
    if (granted || checking) return
    const session = await access.submit(identifier, code)
    if (session) {
      void admit(session)
      return
    }
    ;(identifier.trim() ? codeRef : identifierRef).current?.focus()
    codeRef.current?.select()
  }

  /** Access granted, by code or by face: links a waiting face first, then lets the airlock go on. */
  const admit = async (session: Session) => {
    setGranted(session)
    if (faceFrames) {
      setFaceLink('linking')
      const linked = await Promise.race([faceAuthService.link(session.accountId, faceFrames), wait(LINK_TIMEOUT_MS).then(() => false)])
      setFaceLink(linked ? 'linked' : 'failed')
      if (linked) publish.current?.({ type: 'faceLinked', name: session.name })
    }
    onGranted(session)
  }

  /** One frame of the scanner, checked by the face engine through the same access control as the code. */
  const identifyFace = async (frame: Blob) => {
    const result = await access.attempt(() => faceAuthService.identify(frame))
    if (result?.ok) void admit(result.session)
    return result
  }

  const useCode = () => {
    setMode('code')
    // the fields are back on the next render
    setTimeout(() => (identifier.trim() ? codeRef : identifierRef).current?.focus(), 0)
  }

  // a refusal: the hologram glitches, the code field shakes
  const strikes = state.strikes
  useEffect(() => {
    if (!strikes || reduced) return
    holoRef.current?.animate(
      [
        { translate: '0 0', filter: 'none' },
        { translate: '-6px 1px', filter: 'drop-shadow(3px 0 0 rgba(255,60,90,.75)) drop-shadow(-3px 0 0 rgba(60,220,255,.75))' },
        { translate: '5px -2px', filter: 'drop-shadow(-4px 0 0 rgba(255,60,90,.7)) drop-shadow(4px 0 0 rgba(60,220,255,.7)) brightness(1.4)' },
        { translate: '-3px 0', filter: 'drop-shadow(2px 0 0 rgba(255,60,90,.5)) drop-shadow(-2px 0 0 rgba(60,220,255,.5))' },
        { translate: '0 0', filter: 'none' },
      ],
      { duration: 280, easing: 'steps(4, end)' },
    )
    codeSightRef.current?.animate(
      [{ translate: '0' }, { translate: '-9px' }, { translate: '8px' }, { translate: '-6px' }, { translate: '4px' }, { translate: '-2px' }, { translate: '0' }],
      { duration: 420, easing: 'ease-out' },
    )
  }, [strikes, reduced, holoRef])

  const edit = (set: (value: string) => void) => (value: string) => {
    typing.current++
    set(value)
    access.edit()
  }

  let index = 0
  const cascade = () => ({ '--i': index++ }) as CSSProperties

  return (
    <form
      ref={holoRef}
      className={[styles.holo, collapsed && styles.collapsed].filter(Boolean).join(' ')}
      data-status={state.status}
      noValidate
      onSubmit={submit}
      aria-busy={checking}
    >
      <i className={styles.scan} aria-hidden="true" />
      <i className={styles.corners} aria-hidden="true" />
      {granted ? (
        <Granted session={granted} faceLink={faceLink} />
      ) : (
        <>
          <div className={styles.header} style={cascade()}>
            <NovaMark size={34} stroke={1.6} />
            <div>
              <p className={styles.kicker}>
                <span className={styles.dot} aria-hidden="true" /> Liaison sécurisée · Sas 01
              </p>
              <h1 className={styles.title} id="airlock-title">
                Contrôle d'accès de Terra Nova
              </h1>
              <p className={styles.subtitle}>{scanning ? 'Regardez la caméra pour entrer.' : "Identifiez-vous pour entrer dans l'atmosphère."}</p>
            </div>
          </div>

          {scanning ? (
            <Suspense fallback={<p className={styles.statusText}>Ouverture du lecteur…</p>}>
              <FaceScan identify={identifyFace} onUnknown={setFaceFrames} onUseCode={useCode} onActivity={onActivity} />
            </Suspense>
          ) : (
            <>

              <div style={cascade()}>
                <Field label="E-mail ou identifiant" htmlFor="access-id">
                  <span className={styles.sight} data-valid={valid} onFocus={() => groupFocused('identifier')} onBlur={groupBlurred}>
                    <input
                      ref={identifierRef}
                      id="access-id"
                      name="identifier"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      inputMode="email"
                      placeholder="miora@terra-nova.city"
                      value={identifier}
                      readOnly={checking}
                      onChange={(e) => edit(setIdentifier)(e.target.value)}
                      onSelect={(e) => publish.current?.({ type: 'typing', field: 'identifier', caret: caretPoint(e.currentTarget) })}
                    />
                    <span className={styles.validMark} aria-hidden="true">
                      <Icon name="check" size={16} stroke={2.4} />
                    </span>
                  </span>
                </Field>
              </div>

              <div style={cascade()}>
                <Field label="Code d'accès" htmlFor="access-code">
                  <span ref={codeSightRef} className={styles.sight} onFocus={() => groupFocused('code')} onBlur={groupBlurred}>
                    <input
                      ref={codeRef}
                      id="access-code"
                      name="code"
                      type={revealed ? 'text' : 'password'}
                      autoComplete="current-password"
                      autoCapitalize="characters"
                      spellCheck={false}
                      placeholder="TN-0000"
                      value={code}
                      readOnly={checking}
                      aria-describedby={capsLock ? 'access-caps' : undefined}
                      onChange={(e) => edit(setCode)(e.target.value)}
                      onKeyDown={readCapsLock}
                      onKeyUp={readCapsLock}
                    />
                    <button
                      type="button"
                      className={styles.reveal}
                      aria-controls="access-code"
                      aria-pressed={revealed}
                      aria-label={revealed ? "Masquer le code d'accès" : "Afficher le code d'accès"}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={toggleReveal}
                    >
                      <EyeIcon open={revealed} />
                    </button>
                  </span>
                </Field>
                {capsLock && (
                  <p ref={capsRef} id="access-caps" className={styles.caps}>
                    <Icon name="alert" size={14} /> Majuscules activées
                  </p>
                )}
              </div>

              <div className={styles.status} style={cascade()}>
                <span className={styles.pips} role="img" aria-label={`${MAX_ATTEMPTS - state.strikes} essais restants sur ${MAX_ATTEMPTS}`}>
                  {Array.from({ length: MAX_ATTEMPTS }, (_, i) => (
                    <i key={i} data-used={i < state.strikes} />
                  ))}
                </span>
                <span className={styles.statusText}>{checking ? 'Vérification…' : locked ? `Verrouillé · ${secondsLeft} s` : 'Essais'}</span>
              </div>

              {message && (
                <p className={styles.error} role="alert">
                  {message}
                </p>
              )}

              <div style={cascade()}>
                <Button ref={submitRef} type="submit" className={styles.submit} disabled={locked} data-nova-look>
                  {locked ? (
                    <>
                      <LockRing key={state.lock.lockedUntil} /> Sas verrouillé · {secondsLeft} s
                    </>
                  ) : checking ? (
                    <>
                      <span className={styles.spinner} aria-hidden="true" /> Vérification
                    </>
                  ) : (
                    "Demander l'entrée"
                  )}
                </Button>
                <Button variant="ghost" className={styles.faceButton} disabled={checking || locked} onClick={() => setMode('face')}>
                  <Icon name="face" size={20} /> Entrer avec mon visage
                </Button>
                {faceFrames && (
                  <p className={styles.linkHint}>
                    <Icon name="face" size={14} /> Votre visage sera associé au compte qui entre maintenant.
                  </p>
                )}
              </div>

              <div className={styles.accounts} style={cascade()}>
                <span>Comptes de démonstration</span>
                {DEMO_BUTTONS.map(([id, label]) => (
                  <button key={id} type="button" disabled={checking} onClick={() => void fillDemoAccount(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </form>
  )
}

/** Access granted: the seal lights up and bursts. */
function Granted({ session, faceLink }: { session: Session; faceLink: FaceLink | null }) {
  const sealRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const rect = sealRef.current?.getBoundingClientRect()
    if (rect) hexBurst({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  }, [])
  return (
    <div className={styles.granted} role="status">
      <span ref={sealRef} className={styles.seal}>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path className={styles.sealHex} pathLength={1} d="M12 2 20.7 7v10L12 22 3.3 17V7z" />
          <path className={styles.sealCheck} pathLength={1} d="m8.5 12 2.5 2.5 4.5-5" />
        </svg>
      </span>
      <b>Accès autorisé</b>
      <p>Bienvenue, {session.name}. Couloir d'entrée verrouillé.</p>
      {faceLink && (
        <p className={styles.faceLink} data-state={faceLink}>
          <Icon name="face" size={16} />{' '}
          {faceLink === 'linking'
            ? 'Association de votre visage…'
            : faceLink === 'linked'
              ? 'Visage associé : la prochaine fois, un regard suffira.'
              : "Votre visage n'a pas pu être associé cette fois."}
        </p>
      )}
    </div>
  )
}

/** Countdown ring of the lock, drained over its thirty seconds. */
function LockRing() {
  return (
    <svg className={styles.ring} width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" style={{ '--lock-ms': `${LOCK_MS}ms` } as CSSProperties}>
      <circle cx="10" cy="10" r="8" pathLength={1} />
      <circle cx="10" cy="10" r="8" pathLength={1} />
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  )
}
