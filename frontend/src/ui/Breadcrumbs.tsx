import { Link } from 'react-router'
import styles from './Breadcrumbs.module.css'

export interface Crumb {
  label: string
  /** absent on the current page */
  to?: string
}

/** D15: where the visitor is, each level above being a link back to it. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className={styles.breadcrumbs} aria-label="Fil d’Ariane">
      <ol>
        {items.map((item, i) => (
          <li key={`${i}-${item.label}`}>
            {i > 0 && (
              <span className={styles.separator} aria-hidden="true">
                ›
              </span>
            )}
            {item.to && i < items.length - 1 ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}
