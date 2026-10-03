import { Fragment, useEffect, useMemo, useState, type DragEvent } from 'react'
import { nova, useNovaStore } from '../experience/nova/behavior/novaStore'
import { topHold, type Gesture, type Hold } from '../experience/nova/behavior/novaBrain'
import { EMOTIONS, type Emotion } from '../experience/nova/face/faceState'
import type { NovaLightPreset } from '../experience/nova/NovaLighting'
import { NOVA_MODEL_URL } from '../experience/nova/novaModel'
import { NovaSpeechBubble } from '../experience/nova/NovaSpeechBubble'
import { CLIPS, REQUIRED_CLIPS, type RigReport } from '../experience/nova/rig/rigContract'
import { Button } from '../ui/Button'
import { GlassPanel } from '../ui/GlassPanel'
import text from '../ui/text.module.css'
import { BenchStage } from './BenchStage'
import styles from './NovaBench.module.css'

const GESTURES: ReadonlyArray<readonly [Gesture, string]> = [
  ['wave', 'Coucou'],
  ['celebrate', 'Fête'],
  ['refuse', 'Refus'],
  ['point', 'Montre'],
  ['poked', 'Chatouille'],
]
const HOLDS: ReadonlyArray<readonly [Hold, string]> = [
  ['coverEyes', 'Mains sur les yeux'],
  ['peek', "Coup d'œil"],
  ['think', 'Réfléchit'],
  ['listen', 'Écoute'],
  ['present', 'Présente un quartier'],
  ['sulk', 'Bras croisés (sas verrouillé)'],
  ['brace', "S'accroche"],
]
const EMOTION_LABELS: Record<Emotion, string> = {
  neutral: 'Neutre',
  happy: 'Joie',
  sad: 'Tristesse',
  surprised: 'Surprise',
  denied: 'Refus',
  alarmed: 'Alarme',
  focused: 'Concentré',
}
const LIGHTS: ReadonlyArray<readonly [NovaLightPreset, string]> = [
  ['airlock', 'Sas'],
  ['dusk', 'Couchant'],
  ['night', 'Nuit'],
]
const FACE_LABELS: Record<RigReport['face'], string> = {
  visor: 'Visière (yeux dessinés par shader)',
  glow: 'Lignes lumineuses du casque (shader)',
  morphs: 'Morph targets',
  eyes: "Maillages d'yeux",
  none: 'Aucun : Nova ne clignera pas',
}
const SAMPLE = 'Bienvenue à Terra Nova. Je suis Nova, votre guide. Faites défiler, je vous fais visiter.'

/** `?nova=wave` or `?nova=coverEyes` puts Nova in that state on load (for screenshots). */
function applyUrlState() {
  const params = new URLSearchParams(window.location.search)
  const wanted = params.get('nova')
  if (!wanted) return
  if (GESTURES.some(([g]) => g === wanted)) nova.gesture(wanted as Gesture)
  else if (HOLDS.some(([h]) => h === wanted)) nova.hold(wanted as Hold, true)
  else if ((EMOTIONS as readonly string[]).includes(wanted)) nova.emote(wanted as Emotion, 600)
  else if (wanted === 'say') nova.say(SAMPLE, 'happy')
  else if (wanted === 'walk') nova.walk(true)
  else if (wanted === 'alert') nova.alert(true)
}

/** Development test bench: try every gesture, posture and emotion, and check a delivered GLB. */
export default function NovaBench() {
  const [modelUrl, setModelUrl] = useState<string | null>(NOVA_MODEL_URL)
  const [report, setReport] = useState<RigReport | null>(null)
  const [preset, setPreset] = useState<NovaLightPreset>(() => (new URLSearchParams(window.location.search).get('lumiere') as NovaLightPreset) || 'dusk')
  const [dropping, setDropping] = useState(false)
  const [line, setLine] = useState(SAMPLE)
  const brain = useNovaStore((s) => s.brain)
  const held = topHold(brain.holds)

  useEffect(() => {
    nova.reset()
    applyUrlState()
    return () => nova.reset()
  }, [])

  // object URLs of dropped files are released when replaced
  useEffect(() => {
    if (!modelUrl?.startsWith('blob:')) return
    return () => URL.revokeObjectURL(modelUrl)
  }, [modelUrl])

  const loadFile = (file: File | undefined) => {
    if (!file || !/\.(glb|gltf)$/i.test(file.name)) return
    setReport(null)
    setModelUrl(URL.createObjectURL(file))
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDropping(false)
    loadFile(event.dataTransfer.files[0])
  }

  const clipRows = useMemo(() => {
    // a model without any animation gets them all from the gesture library; flag only partial deliveries
    const partial = !!report && Object.keys(report.clips).length > 0
    return CLIPS.map((clip) => {
      const own = report?.clips[clip]
      const status = own ? `du modèle : ${own}` : report?.source.startsWith('Nova provisoire') ? 'code' : 'généré sur son squelette'
      return { clip, status, missing: partial && !own && REQUIRED_CLIPS.includes(clip) }
    })
  }, [report])

  return (
    <div
      className={[styles.bench, dropping && styles.dropping].filter(Boolean).join(' ')}
      onDragOver={(e) => {
        e.preventDefault()
        setDropping(true)
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      <div className={styles.stage}>
        <BenchStage preset={preset} modelUrl={modelUrl} onReady={setReport} />
      </div>
      <NovaSpeechBubble />

      <GlassPanel className={styles.panel}>
        <div>
          <h1 className={styles.title}>Banc d'essai de Nova</h1>
          <p className={text.note}>Développement uniquement. Déposez un fichier .glb sur la scène pour l'essayer.</p>
        </div>

        <section className={styles.section} aria-labelledby="bench-model">
          <h2 id="bench-model">Modèle</h2>
          <dl className={styles.facts}>
            <dt>Source</dt>
            <dd>{report?.source ?? 'Chargement…'}</dd>
            <dt>Visage</dt>
            <dd>{report ? FACE_LABELS[report.face] : '…'}</dd>
            <dt>Os</dt>
            <dd className={report?.missingBones.length ? styles.missing : undefined}>
              {report ? (report.missingBones.length ? `Manquants : ${report.missingBones.join(', ')}` : `${Object.keys(report.bones).length} reconnus`) : '…'}
            </dd>
          </dl>
          <div className={styles.clips}>
            {clipRows.map((row) => (
              <Fragment key={row.clip}>
                <span>{row.clip}</span>
                <span className={row.missing ? styles.missing : undefined}>{row.status}</span>
              </Fragment>
            ))}
          </div>
          <div className={styles.chips}>
            <label>
              <input className={styles.file} type="file" accept=".glb,.gltf" onChange={(e) => loadFile(e.target.files?.[0])} />
              <Button variant="ghost" small onClick={(e) => (e.currentTarget.previousElementSibling as HTMLInputElement | null)?.click()}>
                Charger un GLB
              </Button>
            </label>
            {modelUrl ? (
              <Button variant="ghost" small onClick={() => setModelUrl(null)}>
                Nova provisoire
              </Button>
            ) : (
              NOVA_MODEL_URL && (
                <Button variant="ghost" small onClick={() => setModelUrl(NOVA_MODEL_URL)}>
                  Nova (modèle)
                </Button>
              )
            )}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="bench-gestures">
          <h2 id="bench-gestures">Gestes</h2>
          <div className={styles.chips}>
            {GESTURES.map(([gesture, label]) => (
              <button key={gesture} type="button" onClick={() => nova.gesture(gesture)}>
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="bench-holds">
          <h2 id="bench-holds">Postures</h2>
          <div className={styles.chips}>
            {HOLDS.map(([hold, label]) => {
              const on = brain.holds.includes(hold)
              return (
                <button key={hold} type="button" aria-pressed={on} onClick={() => nova.hold(hold, !on)}>
                  {label}
                </button>
              )
            })}
            <button type="button" aria-pressed={brain.walking} onClick={() => nova.walk(!brain.walking)}>
              Marche
            </button>
            <button type="button" aria-pressed={brain.alert} onClick={() => nova.alert(!brain.alert)}>
              Alerte
            </button>
          </div>
          {held && <p className={text.note}>Posture tenue : {HOLDS.find(([h]) => h === held)?.[1]}</p>}
        </section>

        <section className={styles.section} aria-labelledby="bench-emotions">
          <h2 id="bench-emotions">Émotions</h2>
          <div className={styles.chips}>
            {EMOTIONS.map((emotion) => (
              <button key={emotion} type="button" onClick={() => nova.emote(emotion, 3)}>
                {EMOTION_LABELS[emotion]}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="bench-speech">
          <h2 id="bench-speech">Parole</h2>
          <form
            className={styles.say}
            onSubmit={(e) => {
              e.preventDefault()
              if (line.trim()) nova.say(line.trim(), 'happy')
            }}
          >
            <input aria-label="Phrase à faire dire à Nova" value={line} onChange={(e) => setLine(e.target.value)} onKeyDown={() => nova.hear()} />
            <Button type="submit" small>
              Dire
            </Button>
          </form>
          <p className={text.note}>Activez « Écoute » puis tapez : l'onde réagit aux frappes.</p>
        </section>

        <section className={styles.section} aria-labelledby="bench-light">
          <h2 id="bench-light">Lumière</h2>
          <div className={styles.chips}>
            {LIGHTS.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={preset === value} onClick={() => setPreset(value)}>
                {label}
              </button>
            ))}
          </div>
        </section>
      </GlassPanel>
    </div>
  )
}
