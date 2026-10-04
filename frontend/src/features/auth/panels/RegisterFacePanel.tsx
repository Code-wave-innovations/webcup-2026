import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import Webcam from '../../../components/Face/Webcam'
import { Button } from '../../../ui/Button'
import { defineMessages, useMessages } from '../../../i18n'
import { useFacePresence } from '../useFacePresence'
import faceStyles from '../FaceScan.module.css'
import styles from '../AccessHologram.module.css'

const messages = defineMessages(
  {
    starting: 'Ouverture de la caméra…',
    closer: 'Approchez-vous : votre visage doit remplir le cercle.',
    holdStill: 'Ne bougez plus…',
    placeFace: 'Placez votre visage dans le cercle, face à la lumière.',
    capture: (n: number, total: number) => `Capture ${n} / ${total}`,
    sealed: (n: number, total: number) => `Empreinte ${n} / ${total} enregistrée…`,
    enrolled: (name: string) => `Visage de ${name} ancré. Création du compte…`,
    captureFailed: 'La capture a échoué. Réessayez ou continuez sans visage.',
    enrolFailed: 'Échec de l’enrollement.',
    denied: 'Caméra indisponible. Vous pouvez continuer sans visage.',
    step: 'Étape 3 sur 3',
    samples: (done: number, total: number) => `${done} échantillon${done > 1 ? 's' : ''} sur ${total}`,
    creating: 'Création du compte Terra Nova…',
    retry: 'Réessayer le scan',
    withoutFace: 'Continuer sans visage',
    skip: 'Passer pour l’instant',
    back: 'Retour',
    hint: 'Rapprochez-vous et restez immobile : chaque photo est vérifiée avant d’être gardée.',
  },
  {
    starting: 'Opening the camera…',
    closer: 'Come closer: your face should fill the circle.',
    holdStill: 'Hold still…',
    placeFace: 'Place your face in the circle, facing the light.',
    capture: (n, total) => `Capture ${n} / ${total}`,
    sealed: (n, total) => `Print ${n} / ${total} saved…`,
    enrolled: (name) => `${name}'s face anchored. Creating the account…`,
    captureFailed: 'The capture failed. Try again or continue without your face.',
    enrolFailed: 'Enrolment failed.',
    denied: 'Camera unavailable. You can continue without your face.',
    step: 'Step 3 of 3',
    samples: (done, total) => `${done} of ${total} samples`,
    creating: 'Creating the Terra Nova account…',
    retry: 'Scan again',
    withoutFace: 'Continue without my face',
    skip: 'Skip for now',
    back: 'Back',
    hint: 'Come closer and stay still: each photo is checked before it is kept.',
  },
)

const TICKS = 72
const SAMPLES = 3
/** hold still this long with a large-enough face before grabbing */
const ALIGN_MS = 1100
/** pause between accepted samples so the visitor can stay sharp */
const BETWEEN_MS = 450
/** native capture width cap — keep enough pixels for the sharpness check */
const FRAME_WIDTH = 1280
/** face must fill more of the frame than login presence (reduces blur / tiny faces) */
const MIN_FACE_PCT = 22

type Phase = 'starting' | 'searching' | 'capturing' | 'sealing' | 'enrolled' | 'failed' | 'denied'

interface RegisterFacePanelProps {
  name: string
  /** the sharp frames, linked to the account by the API once it exists (D03, F34) */
  onEnrolled: (frames: Blob[]) => void
  onSkip: () => void
  onBack: () => void
  busy?: boolean
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function grab(video: HTMLVideoElement | null): Promise<Blob | null> {
  if (!video || video.readyState < 2 || !video.videoWidth) return Promise.resolve(null)
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(FRAME_WIDTH, video.videoWidth)
  canvas.height = Math.round((canvas.width * video.videoHeight) / video.videoWidth)
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95))
}

/**
 * Live face capture: one sharp frame at a time (presence + hold). The frames are only linked once the
 * account exists, by the API and with its session (`POST /api/me/face`): nobody can enrol a face under
 * an e-mail that is not theirs.
 */
export function RegisterFacePanel({ name, onEnrolled, onSkip, onBack, busy }: RegisterFacePanelProps) {
  const m = useMessages(messages)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [phase, setPhase] = useState<Phase>('starting')
  const [sample, setSample] = useState(0)
  const [failed, setFailed] = useState(false)
  const capturing = useRef(false)
  const frames = useRef<Blob[]>([])

  const present = useFacePresence(videoRef, phase === 'searching' || phase === 'capturing', { minFacePercent: MIN_FACE_PCT })
  const aligned = phase === 'searching' && present === true

  const captureOne = useCallback(async () => {
    if (capturing.current) return
    capturing.current = true
    setPhase('capturing')
    setFailed(false)
    try {
      await wait(80)
      const blob = await grab(videoRef.current)
      if (!blob) {
        setPhase('searching')
        return
      }
      setPhase('sealing')
      frames.current = [...frames.current, blob]
      const count = frames.current.length
      setSample(Math.min(SAMPLES, count))
      if (count >= SAMPLES) {
        setPhase('enrolled')
        await wait(500)
        onEnrolled(frames.current)
        return
      }
      await wait(BETWEEN_MS)
      setPhase('searching')
    } catch {
      setFailed(true)
      setPhase('failed')
    } finally {
      capturing.current = false
    }
  }, [onEnrolled])

  useEffect(() => {
    // enroll only when a large-enough face is held still — never fire blind/timer captures
    if (phase !== 'searching' || present !== true) return
    const timer = setTimeout(() => void captureOne(), ALIGN_MS)
    return () => clearTimeout(timer)
  }, [phase, present, captureOne])

  const retry = () => {
    setFailed(false)
    frames.current = []
    setSample(0)
    setPhase('searching')
  }

  const message =
    phase === 'starting'
      ? m.starting
      : phase === 'searching'
        ? present === false
          ? m.closer
          : aligned
            ? m.holdStill
            : m.placeFace
        : phase === 'capturing'
          ? m.capture(Math.min(sample + 1, SAMPLES), SAMPLES)
          : phase === 'sealing'
            ? m.sealed(Math.min(sample + 1, SAMPLES), SAMPLES)
            : phase === 'enrolled'
              ? m.enrolled(name)
              : phase === 'failed'
                ? failed
                  ? m.captureFailed
                  : m.enrolFailed
                : m.denied

  const lensPhase =
    phase === 'enrolled'
      ? 'recognized'
      : phase === 'sealing'
        ? 'analysing'
        : phase === 'failed' || phase === 'denied'
          ? 'denied'
          : phase === 'capturing'
            ? 'analysing'
            : phase

  return (
    <div className={`${styles.panel} ${styles.panelEnter} ${styles.facePanel}`}>
      <div className={styles.dots} aria-label={m.step}>
        <i data-active="false" />
        <i data-active="false" />
        <i data-active="true" />
      </div>

      <div className={faceStyles.scan} data-phase={lensPhase} data-aligned={aligned}>
        <div className={faceStyles.lens}>
          <svg className={faceStyles.ring} viewBox="0 0 208 208" aria-hidden="true">
            {Array.from({ length: TICKS }, (_, i) => (
              <line key={i} x1="104" y1="3" x2="104" y2="13" transform={`rotate(${(i * 360) / TICKS} 104 104)`} style={{ '--i': i } as CSSProperties} />
            ))}
          </svg>
          <i className={faceStyles.sweep} aria-hidden="true" />
          <div className={faceStyles.eye}>
            <Webcam
              videoRef={videoRef}
              className={faceStyles.video}
              onReady={() => setPhase((p) => (p === 'starting' ? 'searching' : p))}
              onError={() => setPhase('denied')}
            />
            <i className={faceStyles.scanline} aria-hidden="true" />
          </div>
        </div>

        <div className={styles.enrollPips} role="img" aria-label={m.samples(sample, SAMPLES)}>
          {Array.from({ length: SAMPLES }, (_, i) => (
            <i key={i} data-done={i < sample || phase === 'enrolled'} />
          ))}
        </div>

        <p className={faceStyles.message} role="status" aria-live="polite">
          {busy ? m.creating : message}
        </p>
      </div>

      <div className={styles.actions}>
        {phase === 'denied' || phase === 'failed' ? (
          <>
            {phase === 'failed' && (
              <Button type="button" className={styles.submit} onClick={retry} disabled={busy} data-nova-look>
                {m.retry}
              </Button>
            )}
            <Button type="button" variant="ghost" className={styles.back} onClick={onSkip} disabled={busy}>
              {m.withoutFace}
            </Button>
          </>
        ) : phase === 'enrolled' || phase === 'sealing' || phase === 'capturing' ? null : (
          <Button type="button" variant="ghost" className={styles.back} onClick={onSkip} disabled={busy}>
            {m.skip}
          </Button>
        )}
        {phase !== 'enrolled' && phase !== 'sealing' && phase !== 'capturing' && (
          <Button type="button" variant="ghost" className={styles.back} onClick={onBack} disabled={busy}>
            {m.back}
          </Button>
        )}
      </div>

      <p className={styles.hint}>{m.hint}</p>
    </div>
  )
}
