import { DISTRICTS } from '../mocks/people'
import styles from './shared.module.css'

const POSITION: Record<string, string> = {
  NORD: styles.nord,
  OUEST: styles.ouest,
  CENTRE: styles.centre,
  EST: styles.est,
  SUD: styles.sud,
}

interface DistrictMapProps {
  /** Number shown in each tile (e.g. open incidents). */
  counts?: Record<number, number>
  countLabel?: string
  /** Districts with a critical situation pulse red. */
  critical?: number[]
  /** Selection mode (alert targeting): tiles become toggle buttons. */
  selected?: number[]
  onToggle?: (districtId: number) => void
  label: string
}

/** Stylised HUD map of Terra Nova's five districts. */
export function DistrictMap({ counts, countLabel = 'signalements', critical = [], selected, onToggle, label }: DistrictMapProps) {
  const max = Math.max(1, ...Object.values(counts ?? {}))
  return (
    <div className={styles.map} role={onToggle ? 'group' : 'img'} aria-label={label}>
      <span className={styles.compass} aria-hidden="true">
        N ▲
      </span>
      {DISTRICTS.map((district) => {
        const count = counts?.[district.id] ?? 0
        const heat = `${Math.round(8 + (count / max) * 30)}%`
        const className = [
          styles.tile,
          POSITION[district.code],
          critical.includes(district.id) ? styles.tileCritical : count > 0 && styles.tileHot,
        ]
          .filter(Boolean)
          .join(' ')
        const content = (
          <>
            {counts && <strong>{count}</strong>}
            <span>{district.name}</span>
          </>
        )
        return onToggle ? (
          <button
            key={district.id}
            type="button"
            className={className}
            style={{ ['--heat' as string]: heat }}
            aria-pressed={selected?.includes(district.id) ?? false}
            onClick={() => onToggle(district.id)}
          >
            {content}
          </button>
        ) : (
          <div
            key={district.id}
            className={className}
            style={{ ['--heat' as string]: heat }}
            aria-label={counts ? `${district.name} : ${count} ${countLabel}` : district.name}
          >
            {content}
          </div>
        )
      })}
    </div>
  )
}
