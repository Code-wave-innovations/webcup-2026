import styles from './HoneypotFields.module.css'

/**
 * Hidden field bots tend to fill. Must stay empty for humans.
 * Keep out of the tab order and off screen readers' main path via aria-hidden.
 */
export function HoneypotFields() {
  return (
    <div className={styles.trap} aria-hidden="true">
      <label>
        Site web
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  )
}
