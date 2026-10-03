import { useToastStore } from './toastStore'
import styles from './Toast.module.css'

export function Toast() {
  const { message, key } = useToastStore()
  return (
    <div className={styles.toast} key={key} role="status" aria-live="polite" hidden={!message}>
      {message}
    </div>
  )
}
