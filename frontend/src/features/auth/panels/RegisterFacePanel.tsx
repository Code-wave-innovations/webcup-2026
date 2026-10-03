import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import axios from 'axios'
import Webcam from '../../../components/Face/Webcam'
import { enrollFrames, type FaceJson } from '../../../hooks/useFaceApi'
import { Button } from '../../../ui/Button'
import { faceIdentityFromEmail } from '../faceIdentity'
import { useFacePresence } from '../useFacePresence'
import faceStyles from '../FaceScan.module.css'
import styles from '../AccessHologram.module.css'

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
  email: string
  name: string
  onEnrolled: () => void
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

function enrollErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as FaceJson | undefined
    const reason = data?.quality?.reason ?? data?.error
    if (reason === 'too_blurry') return 'Image trop floue. Approchez-vous, face à la lumière, et restez immobile.'
    if (reason === 'face_too_small') return 'Visage trop loin. Rapprochez-vous du cercle.'
    if (data?.message) return data.message
    if (error.response?.status === 400) return 'Échantillon refusé. Réessayez face à la caméra.'
  }
  return 'Le service de reconnaissance ne répond pas. Réessayez ou continuez sans visage.'
}

/**
 * Live face enrolment: one sharp frame at a time (presence + hold), then `/enroll` until committed.
 */
export function RegisterFacePanel({ email, name, onEnrolled, onSkip, onBack, busy }: RegisterFacePanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [phase, setPhase] = useState<Phase>('starting')
  const [sample, setSample] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const capturing = useRef(false)
  const accepted = useRef(0)

  const present = useFacePresence(videoRef, phase === 'searching' || phase === 'capturing', { minFacePercent: MIN_FACE_PCT })
  const aligned = phase === 'searching' && present === true

  const captureOne = useCallback(async () => {
    if (capturing.current) return
    capturing.current = true
    setPhase('capturing')
    setError(null)
    try {
      await wait(80)
      const blob = await grab(videoRef.current)
      if (!blob) {
        setPhase('searching')
        return
      }
      setPhase('sealing')
      const identity = faceIdentityFromEmail(email)
      const result = await enrollFrames(identity, [blob])
      if (!result.ok) {
        setError(result.message || 'Échantillon refusé. Réessayez.')
        setPhase('failed')
        return
      }
      const count = result.samples ?? accepted.current + 1
      accepted.current = count
      setSample(Math.min(SAMPLES, count))
      if (result.committed) {
        setPhase('enrolled')
        await wait(500)
        onEnrolled()
        return
      }
      await wait(BETWEEN_MS)
      setPhase('searching')
    } catch (err) {
      setError(enrollErrorMessage(err))
      setPhase('failed')
    } finally {
      capturing.current = false
    }
  }, [email, onEnrolled])

  useEffect(() => {
    // enroll only when a large-enough face is held still — never fire blind/timer captures
    if (phase !== 'searching' || present !== true) return
    const timer = setTimeout(() => void captureOne(), ALIGN_MS)
    return () => clearTimeout(timer)
  }, [phase, present, captureOne])

  const retry = () => {
    setError(null)
    accepted.current = 0
    setSample(0)
    setPhase('searching')
  }

  const message =
    phase === 'starting'
      ? 'Ouverture de la caméra…'
      : phase === 'searching'
        ? present === false
          ? 'Approchez-vous : votre visage doit remplir le cercle.'
          : aligned
            ? 'Ne bougez plus…'
            : 'Placez votre visage dans le cercle, face à la lumière.'
        : phase === 'capturing'
          ? `Capture ${Math.min(sample + 1, SAMPLES)} / ${SAMPLES}`
          : phase === 'sealing'
            ? `Vérification de la netteté (${Math.min(sample + 1, SAMPLES)} / ${SAMPLES})…`
            : phase === 'enrolled'
              ? `Visage de ${name} ancré. Création du compte…`
              : phase === 'failed'
                ? error || 'Échec de l’enrollement.'
                : 'Caméra indisponible. Vous pouvez continuer sans visage.'

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
      <div className={styles.dots} aria-label="Étape 3 sur 3">
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

        <div className={styles.enrollPips} role="img" aria-label={`${sample} échantillons sur ${SAMPLES}`}>
          {Array.from({ length: SAMPLES }, (_, i) => (
            <i key={i} data-done={i < sample || phase === 'enrolled'} />
          ))}
        </div>

        <p className={faceStyles.message} role="status" aria-live="polite">
          {busy ? 'Création du compte Terra Nova…' : message}
        </p>
      </div>

      <div className={styles.actions}>
        {phase === 'denied' || phase === 'failed' ? (
          <>
            {phase === 'failed' && (
              <Button type="button" className={styles.submit} onClick={retry} disabled={busy} data-nova-look>
                Réessayer le scan
              </Button>
            )}
            <Button type="button" variant="ghost" className={styles.back} onClick={onSkip} disabled={busy}>
              Continuer sans visage
            </Button>
          </>
        ) : phase === 'enrolled' || phase === 'sealing' || phase === 'capturing' ? null : (
          <Button type="button" variant="ghost" className={styles.back} onClick={onSkip} disabled={busy}>
            Passer pour l’instant
          </Button>
        )}
        {phase !== 'enrolled' && phase !== 'sealing' && phase !== 'capturing' && (
          <Button type="button" variant="ghost" className={styles.back} onClick={onBack} disabled={busy}>
            Retour
          </Button>
        )}
      </div>

      <p className={styles.hint}>Rapprochez-vous et restez immobile : chaque photo est vérifiée avant d’être gardée.</p>
    </div>
  )
}
