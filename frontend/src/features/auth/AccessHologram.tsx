import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react'
import { useDistricts } from '../../api/districts'
import { useReducedMotion } from '../../hooks/useMediaQuery'
import { Icon, NovaMark } from '../../ui/Icon'
import { hexBurst } from '../../ui/hexBurst'
import {
  type AccessStep,
  resolveAccessRoute,
  stepSubtitle,
  stepTitle,
  validateIdentifier,
  validateRegisterIdentity,
  validateRegisterSecrets,
} from './accessWizard'
import { MAX_ATTEMPTS } from './accessLock'
import { registerCitizen, resolveAuthEmail, terraAuthService, type Session } from './authService'
import { faceAuthService } from './faceAuth'
import type { LoginActivity } from './loginActivity'
import type { LoginState } from './loginMachine'
import { IdentifyPanel } from './panels/IdentifyPanel'
import { LoginPanel } from './panels/LoginPanel'
import { RegisterFacePanel } from './panels/RegisterFacePanel'
import { RegisterIdentityPanel } from './panels/RegisterIdentityPanel'
import { RegisterSecretsPanel } from './panels/RegisterSecretsPanel'
import { useAccessControl } from './useAccessControl'
import { HoneypotFields } from '../security/HoneypotFields'
import { formGuardPayload } from '../security/formGuard'
import { Turnstile } from '../security/Turnstile'
import styles from './AccessHologram.module.css'

interface AccessHologramProps {
  collapsed: boolean
  onGranted: (session: Session) => void
  onActivity?: (activity: LoginActivity) => void
  formRef?: RefObject<HTMLFormElement | null>
}

const FaceScan = lazy(() => import('./FaceScan').then((module) => ({ default: module.FaceScan })))

/** Linking a face never holds the departure longer than this. */
const LINK_TIMEOUT_MS = 3000

type FaceLink = 'linking' | 'linked' | 'failed'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function loginErrorMessage(state: LoginState, secondsLeft: number): string | null {
  switch (state.error) {
    case 'missing':
      return "Saisissez votre code d'accès."
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
 * Access control of Terra Nova: identifier first, then login or citizen registration.
 * Known accounts open login with code + face; registration enrolls the face then `POST /api/auth/register`.
 */
export function AccessHologram({ collapsed, onGranted, onActivity, formRef }: AccessHologramProps) {
  const reduced = useReducedMotion()
  const [step, setStep] = useState<AccessStep>('identify')
  const [loginMode, setLoginMode] = useState<'code' | 'face'>('code')
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [lastName, setLastName] = useState('')
  const [districtId, setDistrictId] = useState<number | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [registerStartedAt, setRegisterStartedAt] = useState(() => Date.now())
  const [turnstileNeeded, setTurnstileNeeded] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [granted, setGranted] = useState<Session | null>(null)
  const [faceFrames, setFaceFrames] = useState<Blob[] | null>(null)
  const [faceLink, setFaceLink] = useState<FaceLink | null>(null)
  const { data: districts = [], isLoading: districtsLoading, isError: districtsFailed } = useDistricts()

  const access = useAccessControl(terraAuthService, onActivity)
  const { state, secondsLeft } = access
  const ownRef = useRef<HTMLFormElement | null>(null)
  const holoRef = formRef ?? ownRef
  const identifierRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const codeSightRef = useRef<HTMLSpanElement>(null)
  const publish = useRef(onActivity)

  useEffect(() => {
    if (districtId == null && districts[0]) setDistrictId(districts[0].id)
  }, [districts, districtId])

  useEffect(() => {
    if (step === 'register-1') {
      setRegisterStartedAt(Date.now())
      setTurnstileNeeded(false)
      setTurnstileToken(null)
    }
  }, [step])

  useEffect(() => {
    publish.current = onActivity
  })

  const scanning = step === 'login' && loginMode === 'face' && state.status !== 'locked'
  const checking = lookingUp || state.status === 'checking' || registering
  const holoStatus = lookingUp || registering ? 'checking' : state.status

  const clearError = () => setFormError(null)

  const admit = async (session: Session) => {
    setGranted(session)
    if (faceFrames) {
      setFaceLink('linking')
      const key = session.email ?? session.accountId
      const linked = await Promise.race([
        faceAuthService.link(key, faceFrames),
        wait(LINK_TIMEOUT_MS).then(() => false),
      ])
      setFaceLink(linked ? 'linked' : 'failed')
      if (linked) publish.current?.({ type: 'faceLinked', name: session.name })
      await wait(linked || reduced ? 600 : 900)
    }
    onGranted(session)
  }

  const onContinueIdentify = async () => {
    const v = validateIdentifier(identifier)
    if (v === 'empty') return setFormError('Saisissez votre e-mail ou identifiant.')
    if (v === 'email') return setFormError('Adresse e-mail invalide.')
    setFormError(null)
    setLookingUp(true)
    const route = await resolveAccessRoute(identifier)
    if (!reduced) await wait(280)
    setLookingUp(false)
    setLoginMode('code')
    setFaceFrames(null)
    setStep(route === 'login' ? 'login' : 'register-1')
  }

  const onLoginSubmit = async () => {
    if (granted || state.status === 'checking') return
    const session = await access.submit(identifier, code)
    if (session) {
      void admit(session)
      return
    }
    codeRef.current?.focus()
    codeRef.current?.select()
  }

  /** Face identity must match the typed identifier, then `GET /api/auth/by-email`. */
  const identifyFace = async (frame: Blob) => {
    const result = await access.attempt(() => faceAuthService.identify(frame, identifier))
    if (result?.ok) void admit(result.session)
    return result
  }

  const onRegisterNext = () => {
    const v = validateRegisterIdentity(name, lastName, districtId)
    if (v === 'missing') return setFormError('Indiquez votre prénom et votre nom.')
    if (v === 'district') return setFormError('Impossible de charger les quartiers.')
    setFormError(null)
    setStep('register-2')
  }

  const onRegisterCreate = async () => {
    const v = validateRegisterSecrets(password, confirm)
    if (v === 'short') return setFormError('Le code doit contenir au moins 8 caractères.')
    if (v === 'mismatch') return setFormError('Les codes ne correspondent pas.')
    setFormError(null)
    setStep('register-3')
  }

  const registerOnBackend = async () => {
    if (districtId == null) {
      setFormError('Impossible de charger les quartiers.')
      setStep('register-1')
      return
    }
    if (turnstileNeeded && !turnstileToken) {
      setFormError('Validez la vérification anti-robot avant de continuer.')
      return
    }
    setRegistering(true)
    setFormError(null)
    const result = await registerCitizen({
      email: resolveAuthEmail(identifier),
      password,
      name,
      last_name: lastName,
      district_id: districtId,
      ...formGuardPayload(registerStartedAt, turnstileToken),
    })
    setRegistering(false)
    if (!result.ok) {
      setFormError(result.error)
      if (result.turnstileRequired) {
        setTurnstileNeeded(true)
        setTurnstileToken(null)
        return
      }
      if (result.conflict) {
        setLoginMode('code')
        setStep('login')
      }
      return
    }
    setGranted(result.session)
    onGranted(result.session)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (granted || scanning) return
    if (step === 'identify') return void onContinueIdentify()
    if (step === 'login') return void onLoginSubmit()
    if (step === 'register-1') return onRegisterNext()
    if (step === 'register-2') return void onRegisterCreate()
  }

  const strikes = state.strikes
  useEffect(() => {
    if (!strikes || reduced || step !== 'login' || scanning) return
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
  }, [strikes, reduced, holoRef, step, scanning])

  const readCapsLock = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState('CapsLock'))

  const backToIdentify = () => {
    setFormError(null)
    setLoginMode('code')
    setFaceFrames(null)
    setStep('identify')
  }

  return (
    <form
      ref={holoRef}
      className={[styles.holo, collapsed && styles.collapsed].filter(Boolean).join(' ')}
      data-status={holoStatus}
      noValidate
      onSubmit={(e) => void submit(e)}
      aria-busy={checking}
    >
      <HoneypotFields />
      <i className={styles.scan} aria-hidden="true" />
      <i className={styles.corners} aria-hidden="true" />
      {granted ? (
        <Granted session={granted} faceLink={faceLink} />
      ) : (
        <>
          <div className={styles.header}>
            <NovaMark size={34} stroke={1.6} />
            <div>
              <p className={styles.kicker}>
                <span className={styles.dot} aria-hidden="true" /> Liaison sécurisée · Sas 01
              </p>
              <h1 className={styles.title} id="airlock-title">
                {stepTitle(step)}
              </h1>
              <p className={styles.subtitle}>{stepSubtitle(step, { face: scanning })}</p>
              <div className={styles.meta} aria-hidden="true">
                <span>Canal 7</span>
                <span>Orbitale</span>
                <span>Citoyen</span>
              </div>
            </div>
          </div>

          <i className={styles.divider} aria-hidden="true" />

          <div className={styles.body} key={scanning ? 'face' : step} data-face={step === 'register-3' || scanning || undefined}>
            {step === 'identify' && (
              <IdentifyPanel
                identifier={identifier}
                error={formError}
                checking={lookingUp}
                identifierRef={identifierRef}
                onChange={(value) => {
                  clearError()
                  setIdentifier(value)
                }}
              />
            )}
            {step === 'login' && scanning && (
              <Suspense fallback={<p className={styles.statusText}>Ouverture du lecteur…</p>}>
                <FaceScan
                  identify={identifyFace}
                  onUnknown={setFaceFrames}
                  onUseCode={() => setLoginMode('code')}
                  onActivity={onActivity}
                />
              </Suspense>
            )}
            {step === 'login' && !scanning && (
              <LoginPanel
                identifier={identifier.trim()}
                code={code}
                state={state}
                secondsLeft={secondsLeft}
                error={loginErrorMessage(state, secondsLeft)}
                codeRef={codeRef}
                codeSightRef={codeSightRef}
                capsLock={capsLock}
                revealed={revealed}
                pendingFaceLink={!!faceFrames}
                onCodeChange={(value) => {
                  access.edit()
                  setCode(value)
                }}
                onToggleReveal={() => setRevealed((v) => !v)}
                onCaps={readCapsLock}
                onFace={() => setLoginMode('face')}
                onBack={backToIdentify}
              />
            )}
            {step === 'register-1' && (
              <RegisterIdentityPanel
                name={name}
                lastName={lastName}
                districtId={districtId}
                districts={districts}
                districtsLoading={districtsLoading}
                districtsFailed={districtsFailed}
                error={formError}
                reminder={identifier.trim()}
                onNameChange={(value) => {
                  clearError()
                  setName(value)
                }}
                onLastNameChange={(value) => {
                  clearError()
                  setLastName(value)
                }}
                onDistrictChange={(id) => {
                  clearError()
                  setDistrictId(id)
                }}
                onBack={backToIdentify}
              />
            )}
            {step === 'register-2' && (
              <RegisterSecretsPanel
                password={password}
                confirm={confirm}
                error={formError}
                reminder={identifier.trim()}
                submitting={registering}
                onPasswordChange={(value) => {
                  clearError()
                  setPassword(value)
                }}
                onConfirmChange={(value) => {
                  clearError()
                  setConfirm(value)
                }}
                onBack={() => {
                  setFormError(null)
                  setStep('register-1')
                }}
              />
            )}
            {step === 'register-3' && (
              <>
                <RegisterFacePanel
                  email={resolveAuthEmail(identifier)}
                  name={name.trim() || 'citoyen'}
                  busy={registering}
                  onEnrolled={() => void registerOnBackend()}
                  onSkip={() => void registerOnBackend()}
                  onBack={() => setStep('register-2')}
                />
                {turnstileNeeded && (
                  <Turnstile
                    onToken={(token) => {
                      setTurnstileToken(token)
                      if (token) {
                        setFormError(null)
                        // Retry registration once the challenge succeeds.
                        void (async () => {
                          if (districtId == null) return
                          setRegistering(true)
                          const retry = await registerCitizen({
                            email: resolveAuthEmail(identifier),
                            password,
                            name,
                            last_name: lastName,
                            district_id: districtId,
                            ...formGuardPayload(registerStartedAt, token),
                          })
                          setRegistering(false)
                          if (!retry.ok) {
                            setFormError(retry.error)
                            if (retry.turnstileRequired) setTurnstileToken(null)
                            return
                          }
                          setGranted(retry.session)
                          onGranted(retry.session)
                        })()
                      }
                    }}
                  />
                )}
              </>
            )}
          </div>

          {formError && step === 'register-3' && (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          )}

          <p className={styles.footer}>
            <span>
              Guide à bâbord · <b>Nova</b>
            </span>
            <span>Protocole TN-A1</span>
          </p>
        </>
      )}
    </form>
  )
}

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
