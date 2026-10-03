import styles from './HudBackground.module.css'

/** The client's painted sunset (3D fallback), dimmed, under a HUD grid and a slow scanning beam. */
export function HudBackground() {
  return (
    <div className={styles.bg} aria-hidden="true">
      <div className={styles.sky} />
      <div className={styles.grid} />
      <div className={styles.beam} />
      <div className={styles.vignette} />
    </div>
  )
}
