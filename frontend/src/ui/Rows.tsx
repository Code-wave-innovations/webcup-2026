import type { ButtonHTMLAttributes, HTMLAttributes, LiHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import styles from './Rows.module.css'

/** Stacked rows on a glass panel (services, announcements, registry). */
export function RowList({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={[styles.rows, className].filter(Boolean).join(' ')} {...props} />
}

export function Row(props: LiHTMLAttributes<HTMLLIElement>) {
  return <li className={styles.row} {...props} />
}

/** A row that opens a route of the app (the 3D film keeps running). */
export function RowLink({ className, ...props }: LinkProps) {
  return (
    <li>
      <Link className={[styles.row, className].filter(Boolean).join(' ')} {...props} />
    </li>
  )
}

export function RowButtons(props: HTMLAttributes<HTMLDivElement>) {
  return <div className={styles.rows} {...props} />
}

export function RowButton({ type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={styles.row} {...props} />
}
