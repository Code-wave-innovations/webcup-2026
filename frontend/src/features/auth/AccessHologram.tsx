import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react'
import { useDistricts } from '../../api/districts'
import { useReducedMotion } from '../../hooks/useMediaQuery'
import { Button } from '../../ui/Button'
import { defineMessages, useLocale, useMessages } from '../../i18n'
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
import { recoverAccess, registerCitizen, resolveAuthEmail, terraAuthService, type Session } from './authService'
import { faceAuthService } from './faceAuth'
import type { LoginActivity } from './loginActivity'
import type { LoginState } from './loginMachine'
import { IdentifyPanel } from './panels/IdentifyPanel'
import { LoginPanel } from './panels/LoginPanel'
import { RecoverPanel } from './panels/RecoverPanel'
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
  /** F96: false in the light version, which skips the camera and its models (login by code, account without a face) */
  faceLogin?: boolean
}

const messages = defineMessages(
  {
    missingCode: "Saisissez votre code d'accès.",
    refused: (left: number) => `Identifiant ou code refusé. ${left > 1 ? `Encore ${left} essais` : 'Dernier essai'} avant verrouillage.`,
    locked: (seconds: number) => `Accès refusé cinq fois. Le sas est verrouillé, nouvel essai dans ${seconds} s.`,
    errors: {
      identifierEmpty: 'Saisissez votre e-mail ou identifiant.',
      identifierEmail: 'Adresse e-mail invalide.',
      suspended: 'Ce compte est suspendu par la mairie. Présentez-vous au guichet ou appelez la mairie pour le réactiver.',
      resetCode: 'Saisissez les 8 caractères du code remis par la mairie.',
      newCodeShort: 'Le code d’accès doit contenir au moins 8 caractères.',
      newCodeMismatch: 'Les deux codes ne correspondent pas.',
      names: 'Indiquez votre prénom et votre nom.',
      district: 'Impossible de charger les quartiers.',
      codeShort: 'Le code doit contenir au moins 8 caractères.',
      codeMismatch: 'Les codes ne correspondent pas.',
      turnstile: 'Validez la vérification anti-robot avant de continuer.',
    },
    kicker: 'Liaison sécurisée · Sas 01',
    meta: ['Canal 7', 'Orbitale', 'Citoyen'],
    openingReader: 'Ouverture du lecteur…',
    citizen: 'citoyen',
    guide: 'Guide à bâbord',
    protocol: 'Protocole TN-A1',
    granted: 'Accès autorisé',
    welcome: (name: string) => `Bienvenue, ${name}. Couloir d'entrée verrouillé.`,
    faceLinking: 'Association de votre visage…',
    faceLinked: 'Visage associé : la prochaine fois, un regard suffira.',
    faceLinkFailed: "Votre visage n'a pas pu être associé cette fois.",
    creatingTitle: 'Création du compte',
    creatingSubtitle: 'Terra Nova ouvre votre dossier citoyen.',
    creating: 'Création de votre compte…',
    createFailed: 'Le compte n’a pas pu être créé.',
    ready: 'Votre compte est prêt.',
    retry: 'Réessayer',
    create: 'Créer mon compte',
    back: 'Retour',
  },
  {
    missingCode: 'Enter your access code.',
    refused: (left) => `Identifier or code refused. ${left === 1 ? 'Last try' : `${left} tries left`} before the lock.`,
    locked: (seconds) => `Access refused five times. The airlock is locked, try again in ${seconds} s.`,
    errors: {
      identifierEmpty: 'Enter your e-mail or identifier.',
      identifierEmail: 'Invalid e-mail address.',
      suspended: 'This account has been suspended by the city hall. Visit the counter or call the city hall to have it reactivated.',
      resetCode: 'Enter the 8 characters of the code the city hall gave you.',
      newCodeShort: 'The access code must be at least 8 characters long.',
      newCodeMismatch: 'The two codes do not match.',
      names: 'Enter your first name and last name.',
      district: 'Unable to load the districts.',
      codeShort: 'The code must be at least 8 characters long.',
      codeMismatch: 'The codes do not match.',
      turnstile: 'Complete the anti-robot check before continuing.',
    },
    kicker: 'Secure link · Airlock 01',
    meta: ['Channel 7', 'Orbital', 'Citizen'],
    openingReader: 'Opening the scanner…',
    citizen: 'citizen',
    guide: 'Guide to port',
    protocol: 'Protocol TN-A1',
    granted: 'Access granted',
    welcome: (name) => `Welcome, ${name}. Entry corridor locked.`,
    faceLinking: 'Linking your face…',
    faceLinked: 'Face linked: next time, one look will do.',
    faceLinkFailed: 'Your face could not be linked this time.',
    creatingTitle: 'Creating the account',
    creatingSubtitle: 'Terra Nova is opening your citizen record.',
    creating: 'Creating your account…',
    createFailed: 'The account could not be created.',
    ready: 'Your account is ready.',
    retry: 'Try again',
    create: 'Create my account',
    back: 'Back',
  },
)

type Messages = (typeof messages)['fr']
type ErrorKey = keyof Messages['errors']

/** An error of the form: one of ours (said in the current language) or the API's text. */
type FormError = { key: ErrorKey } | { text: string }

const errorText = (m: Messages, error: FormError | null): string | null => (error ? ('key' in error ? m.errors[error.key] : error.text) : null)

const FaceScan = lazy(() => import('./FaceScan').then((module) => ({ default: module.FaceScan })))
/** F95: the face enrolment step (and its detection worker client) only loads when a registration reaches it */
const RegisterFacePanel = lazy(() => import('./panels/RegisterFacePanel').then((module) => ({ default: module.RegisterFacePanel })))

/** Linking a face never holds the departure longer than this. */
const LINK_TIMEOUT_MS = 3000

type FaceLink = 'linking' | 'linked' | 'failed'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function loginErrorMessage(m: Messages, state: LoginState, secondsLeft: number): string | null {
  switch (state.error) {
    case 'missing':
      return m.missingCode
    case 'refused':
      return m.refused(MAX_ATTEMPTS - state.strikes)
    case 'locked':
      return m.locked(secondsLeft)
    default:
      return null
  }
}

/**
 * Access control of Terra Nova: identifier first, then login or citizen registration.
 * Known accounts open login with code + face; registration enrolls the face then `POST /api/auth/register`.
 */
export function AccessHologram({ collapsed, onGranted, onActivity, formRef, faceLogin = true }: AccessHologramProps) {
  const reduced = useReducedMotion()
  const locale = useLocale()
  const m = useMessages(messages)
  const [step, setStep] = useState<AccessStep>('identify')
  const [loginMode, setLoginMode] = useState<'code' | 'face'>('code')
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [lastName, setLastName] = useState('')
  const [districtId, setDistrictId] = useState<number | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [formError, setFormError] = useState<FormError | null>(null)
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
  // F34: back in with the code handed over by the city
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newConfirm, setNewConfirm] = useState('')
  const [recoverError, setRecoverError] = useState<({ field?: 'code' | 'password' | 'confirm' } & FormError) | null>(null)
  const [recovering, setRecovering] = useState(false)
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

  /** Lets the person in; the face captured on the way (registration, unknown face) is linked by the API with the new session */
  const admit = async (session: Session, frames: Blob[] | null = faceFrames) => {
    setGranted(session)
    if (frames) {
      setFaceLink('linking')
      const linked = await Promise.race([
        faceAuthService.link(session, frames),
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
    if (v === 'empty') return setFormError({ key: 'identifierEmpty' })
    if (v === 'email') return setFormError({ key: 'identifierEmail' })
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
    setFormError(null)
    const result = await access.submit(identifier, code)
    if (result?.ok) {
      void admit(result.session)
      return
    }
    // F34: a suspended account is told why, and where to go (no attempt is counted)
    if (result && !result.ok && result.inconclusive === 'disabled') {
      setFormError({ key: 'suspended' })
      return
    }
    codeRef.current?.focus()
    codeRef.current?.select()
  }

  /** Face identify on the face engine, then `GET /api/auth/by-email` when it matches the typed id. */
  const identifyFace = async (frame: Blob) => {
    const result = await access.attempt(() => faceAuthService.identify(frame, identifier))
    if (result?.ok) void admit(result.session)
    return result
  }

  const openRecover = () => {
    setFormError(null)
    setRecoverError(null)
    setStep('recover')
  }

  const onRecoverSubmit = async () => {
    if (recovering || granted) return
    if (resetCode.replace(/[^a-z0-9]/gi, '').length < 8) return setRecoverError({ field: 'code', key: 'resetCode' })
    if (newPassword.length < 8) return setRecoverError({ field: 'password', key: 'newCodeShort' })
    if (newPassword !== newConfirm) return setRecoverError({ field: 'confirm', key: 'newCodeMismatch' })
    setRecoverError(null)
    setRecovering(true)
    const result = await recoverAccess(identifier, resetCode, newPassword)
    setRecovering(false)
    if (!result.ok) return setRecoverError({ field: result.field, text: result.error })
    publish.current?.({ type: 'granted', name: result.session.name })
    void admit(result.session)
  }

  const onRegisterNext = () => {
    const v = validateRegisterIdentity(name, lastName, districtId)
    if (v === 'missing') return setFormError({ key: 'names' })
    if (v === 'district') return setFormError({ key: 'district' })
    setFormError(null)
    setStep('register-2')
  }

  const onRegisterCreate = async () => {
    const v = validateRegisterSecrets(password, confirm)
    if (v === 'short') return setFormError({ key: 'codeShort' })
    if (v === 'mismatch') return setFormError({ key: 'codeMismatch' })
    setFormError(null)
    setStep('register-3')
    // without the face step, the account is created at once (register-3 still shows its progress and errors)
    if (!faceLogin) void registerOnBackend()
  }

  const registerOnBackend = async (frames: Blob[] | null = null) => {
    if (districtId == null) {
      setFormError({ key: 'district' })
      setStep('register-1')
      return
    }
    if (turnstileNeeded && !turnstileToken) {
      setFormError({ key: 'turnstile' })
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
      setFormError({ text: result.error })
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
    void admit(result.session, frames)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (granted || scanning) return
    if (step === 'identify') return void onContinueIdentify()
    if (step === 'login') return void onLoginSubmit()
    if (step === 'register-1') return onRegisterNext()
    if (step === 'register-2') return void onRegisterCreate()
    if (step === 'recover') return void onRecoverSubmit()
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

  const formErrorText = errorText(m, formError)

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
        <Granted session={granted} faceLink={faceLink} m={m} />
      ) : (
        <>
          <div className={styles.header}>
            <NovaMark size={34} stroke={1.6} />
            <div>
              <p className={styles.kicker}>
                <span className={styles.dot} aria-hidden="true" /> {m.kicker}
              </p>
              <h1 className={styles.title} id="airlock-title">
                {faceLogin || step !== 'register-3' ? stepTitle(step, locale) : m.creatingTitle}
              </h1>
              <p className={styles.subtitle}>
                {faceLogin || step !== 'register-3' ? stepSubtitle(step, { face: scanning }, locale) : m.creatingSubtitle}
              </p>
              <div className={styles.meta} aria-hidden="true">
                {m.meta.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>
          </div>

          <i className={styles.divider} aria-hidden="true" />

          <div className={styles.body} key={scanning ? 'face' : step} data-face={step === 'register-3' || scanning || undefined}>
            {step === 'identify' && (
              <IdentifyPanel
                identifier={identifier}
                error={formErrorText}
                checking={lookingUp}
                identifierRef={identifierRef}
                onChange={(value) => {
                  clearError()
                  setIdentifier(value)
                }}
              />
            )}
            {step === 'login' && scanning && (
              <Suspense fallback={<p className={styles.statusText}>{m.openingReader}</p>}>
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
                error={formErrorText ?? loginErrorMessage(m, state, secondsLeft)}
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
                onFace={faceLogin ? () => setLoginMode('face') : undefined}
                onForgot={openRecover}
                onBack={backToIdentify}
              />
            )}
            {step === 'recover' && (
              <RecoverPanel
                identifier={identifier.trim()}
                code={resetCode}
                password={newPassword}
                confirm={newConfirm}
                error={recoverError && { field: recoverError.field, message: errorText(m, recoverError) ?? '' }}
                submitting={recovering}
                onCodeChange={(value) => {
                  setRecoverError(null)
                  setResetCode(value)
                }}
                onPasswordChange={(value) => {
                  setRecoverError(null)
                  setNewPassword(value)
                }}
                onConfirmChange={(value) => {
                  setRecoverError(null)
                  setNewConfirm(value)
                }}
                onBack={() => {
                  setRecoverError(null)
                  setStep('login')
                }}
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
                error={formErrorText}
                districtError={!!formError && 'key' in formError && formError.key === 'district'}
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
                error={formErrorText}
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
                {faceLogin ? (
                  <Suspense fallback={<p className={styles.statusText}>{m.openingReader}</p>}>
                    <RegisterFacePanel
                      name={name.trim() || m.citizen}
                      busy={registering}
                      onEnrolled={(frames) => {
                        setFaceFrames(frames)
                        void registerOnBackend(frames)
                      }}
                      onSkip={() => void registerOnBackend()}
                      onBack={() => setStep('register-2')}
                    />
                  </Suspense>
                ) : (
                  <div className={styles.plainRegister}>
                    <p className={styles.statusText} role="status">
                      {registering ? m.creating : formError ? m.createFailed : m.ready}
                    </p>
                    <Button type="button" disabled={registering} onClick={() => void registerOnBackend()}>
                      {formError ? m.retry : m.create}
                    </Button>
                    <Button type="button" variant="ghost" disabled={registering} onClick={() => setStep('register-2')}>
                      {m.back}
                    </Button>
                  </div>
                )}
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
                            setFormError({ text: retry.error })
                            if (retry.turnstileRequired) setTurnstileToken(null)
                            return
                          }
                          void admit(retry.session)
                        })()
                      }
                    }}
                  />
                )}
              </>
            )}
          </div>

          {formErrorText && step === 'register-3' && (
            <p className={styles.error} role="alert">
              {formErrorText}
            </p>
          )}

          <p className={styles.footer}>
            <span>
              {m.guide} · <b>Nova</b>
            </span>
            <span>{m.protocol}</span>
          </p>
        </>
      )}
    </form>
  )
}

function Granted({ session, faceLink, m }: { session: Session; faceLink: FaceLink | null; m: Messages }) {
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
      <b>{m.granted}</b>
      <p>{m.welcome(session.name)}</p>
      {faceLink && (
        <p className={styles.faceLink} data-state={faceLink}>
          <Icon name="face" size={16} />{' '}
          {faceLink === 'linking' ? m.faceLinking : faceLink === 'linked' ? m.faceLinked : m.faceLinkFailed}
        </p>
      )}
    </div>
  )
}
