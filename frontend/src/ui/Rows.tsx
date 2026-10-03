import type { ButtonHTMLAttributes, HTMLAttributes, LiHTMLAttributes } from 'react'
import styles from './Rows.module.css'

/** Stacked rows on a glass panel (services, announcements, registry). */
export function RowList({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={[styles.rows, className].filter(Boolean).join(' ')} {...props} />
}

export function Row(props: LiHTMLAttributes<HTMLLIElement>) {
  return <li className={styles.row} {...props} />
}

export function RowButtons(props: HTMLAttributes<HTMLDivElement>) {
  return <div className={styles.rows} {...props} />
}

export function RowButton({ type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={styles.row} {...props} />
}
