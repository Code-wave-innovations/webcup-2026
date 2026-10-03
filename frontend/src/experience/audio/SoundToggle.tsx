import { useSoundStore } from './soundStore'
import styles from './SoundToggle.module.css'

/** Sound is off by default: this switch turns the film's sound on (and its gesture unlocks the audio). */
export function SoundToggle() {
  const enabled = useSoundStore((s) => s.enabled)
  const toggle = useSoundStore((s) => s.toggle)
  return (
    <button type="button" className={styles.toggle} aria-pressed={enabled} onClick={toggle}>
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
