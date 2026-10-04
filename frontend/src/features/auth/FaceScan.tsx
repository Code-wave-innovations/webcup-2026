import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import Webcam from '../../components/Face/Webcam'
import { Button } from '../../ui/Button'
import type { Inconclusive, SignInResult } from './authService'
import type { LoginActivity } from './loginActivity'
import { useFacePresence } from './useFacePresence'
import styles from './FaceScan.module.css'

export interface FaceScanProps {
  /** checks one frame through the access control (null: no check could start) */
  identify: (frame: Blob) => Promise<SignInResult | null>
  /** the face is unknown: these frames can be linked to the account that signs in next */
  onUnknown: (frames: Blob[]) => void
  /** back to the identifier and access code */
  onUseCode: () => void
  onActivity?: (activity: LoginActivity) => void
}

type Phase = 'starting' | 'searching' | 'analysing' | 'recognized' | Exclude<Inconclusive, 'noFace'> | 'denied'

/** a face held this long in the circle is captured */
const ALIGN_MS = 700
/** without a working detector, a frame is captured every so often */
const BLIND_MS = 2200
/** frames sent along with an unknown face so it can be linked (the enrolment needs three) */
const LINK_FRAMES = 3
const LINK_SPACING_MS = 260
const FRAME_WIDTH = 640
const TICKS = 72

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** One JPEG frame of the camera, as the camera sees it (the preview is mirrored, not the frame). */
function grab(video: HTMLVideoElement | null): Promise<Blob | null> {
  if (!video || video.readyState < 2 || !video.videoWidth) return Promise.resolve(null)
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(FRAME_WIDTH, video.videoWidth)
  canvas.height = Math.round((canvas.width * video.videoHeight) / video.videoWidth)
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
}

const MESSAGES: Record<Exclude<Phase, 'searching'>, string> = {
  starting: 'Ouverture de la caméra…',
  analysing: 'Analyse biométrique…',
  recognized: 'Visage reconnu',
  unknown: 'Visage inconnu. Entrez une fois avec votre code : il sera associé à votre compte.',
  mismatch: 'Ce visage ne correspond pas à l’identifiant saisi. Vérifiez l’e-mail, ou entrez avec votre code.',
  unavailable: 'La reconnaissance faciale ne répond pas. Entrez avec votre code.',
  disabled: 'Ce compte est suspendu par la mairie. Présentez-vous au guichet ou appelez la mairie.',
  denied: 'Caméra refusée ou indisponible. Entrez avec votre code.',
}

/**
 * Face login: the camera in a lens ringed with ticks. The ring sweeps while it looks for a face, fills
 * clockwise once a face holds still, pulses while the face engine analyses it, and lights up green when
 * it is recognised. An unknown face hands its frames over so the next code login can link it.
 */
export function FaceScan({ identify, onUnknown, onUseCode, onActivity }: FaceScanProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lensRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('starting')
  const [blurry, setBlurry] = useState(false)
  const publish = useRef(onActivity)
  const handlers = useRef({ identify, onUnknown })
  useEffect(() => {
    publish.current = onActivity
    handlers.current = { identify, onUnknown }
  })

  const present = useFacePresence(videoRef, phase !== 'starting' && phase !== 'denied')
  const aligned = phase === 'searching' && present === true

  // Nova looks at the camera while it is open
  useEffect(() => {
    if (phase !== 'searching') return
    const rect = lensRef.current?.getBoundingClientRect()
    publish.current?.({ type: 'faceScan', open: true, lens: rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null })
  }, [phase])
  useEffect(() => () => publish.current?.({ type: 'faceScan', open: false, lens: null }), [])

  const scan = useCallback(async () => {
    const video = videoRef.current
    const frame = await grab(video)
    if (!frame) return
    setPhase('analysing')
    const result = await handlers.current.identify(frame)
    if (result?.ok) return setPhase('recognized')
    const reason = result && !result.ok ? result.inconclusive : undefined
    if (reason) publish.current?.({ type: 'faceUndecided', reason })
    if (reason === 'unknown') {
      const frames = [frame]
      while (frames.length < LINK_FRAMES) {
        await wait(LINK_SPACING_MS)
        const next = await grab(video)
        if (next) frames.push(next)
        else break
      }
      handlers.current.onUnknown(frames)
      return setPhase('unknown')
    }
    if (reason === 'mismatch') return setPhase('mismatch')
    if (reason === 'unavailable') return setPhase('unavailable')
    if (reason === 'disabled') return setPhase('disabled')
    setBlurry(reason === 'noFace')
    setPhase('searching')
  }, [])

  // capture once a face holds still in the circle (or on a timer without a detector)
  useEffect(() => {
    if (phase !== 'searching' || present === false) return
    const timer = setTimeout(() => void scan(), present ? ALIGN_MS : BLIND_MS)
    return () => clearTimeout(timer)
  }, [phase, present, scan])

  const message = phase === 'searching' ? (aligned ? 'Ne bougez plus…' : blurry ? 'Je ne vous vois pas bien : approchez-vous, face à la lumière.' : 'Placez votre visage dans le cercle.') : MESSAGES[phase]
  const stopped = phase === 'unknown' || phase === 'mismatch' || phase === 'unavailable' || phase === 'disabled' || phase === 'denied'

  return (
    <div className={styles.scan} data-phase={phase} data-aligned={aligned}>
      <div ref={lensRef} className={styles.lens}>
        <svg className={styles.ring} viewBox="0 0 208 208" aria-hidden="true">
          {Array.from({ length: TICKS }, (_, i) => (
            <line key={i} x1="104" y1="3" x2="104" y2="13" transform={`rotate(${(i * 360) / TICKS} 104 104)`} style={{ '--i': i } as CSSProperties} />
          ))}
        </svg>
        <i className={styles.sweep} aria-hidden="true" />
        <div className={styles.eye}>
          <Webcam
            videoRef={videoRef}
            className={styles.video}
            onReady={() => setPhase('searching')}
            onError={() => setPhase('denied')}
          />
          <i className={styles.scanline} aria-hidden="true" />
        </div>
      </div>

      <p className={styles.message} role="status" aria-live="polite">
        {message}
      </p>

      {stopped ? (
        <div className={styles.actions}>
          <Button className={styles.wide} onClick={onUseCode}>
            Entrer avec mon code
          </Button>
          {phase !== 'denied' && (
            <Button variant="ghost" small onClick={() => setPhase('searching')}>
              Réessayer
            </Button>
          )}
        </div>
      ) : (
        phase !== 'recognized' && (
          <button type="button" className={styles.link} onClick={onUseCode}>
            Utiliser mon code d'accès
          </button>
        )
      )}
      <p className={styles.privacy}>L'image est analysée par le service de reconnaissance de Terra Nova, sans être conservée, sauf si vous l'associez à votre compte.</p>
    </div>
  )
}
