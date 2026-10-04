import { unlockSpeech } from '../../hooks/useSpeakMessage'
import { useSoundStore } from './soundStore'
import styles from './SoundToggle.module.css'

/** Turns the film's sound on or off. Sound plays by default; the click that turns it on also unlocks Nova's voice. */
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
