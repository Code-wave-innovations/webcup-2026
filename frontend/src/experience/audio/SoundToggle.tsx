import { unlockSpeech } from '../../hooks/useSpeakMessage'
import { useSoundStore } from './soundStore'
import styles from './SoundToggle.module.css'

/** Sound is off by default: this switch turns the film's sound on (and its gesture unlocks the audio). */
export function SoundToggle() {
  const enabled = useSoundStore((s) => s.enabled)
  const toggle = useSoundStore((s) => s.toggle)
  const onClick = () => {
    // the click is the gesture that allows Nova's voice to speak later on its own
    if (!enabled) unlockSpeech()
    toggle()
  }
  return (
    <button type="button" className={styles.toggle} aria-pressed={enabled} onClick={onClick}>
      <span className={styles.bars} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      Son
    </button>
  )
}
