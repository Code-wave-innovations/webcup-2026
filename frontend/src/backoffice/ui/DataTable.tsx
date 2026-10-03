import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from './Icon'
import { EmptyState } from './Feedback'
import styles from './DataTable.module.css'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** Enables sorting on this column. */
  sortValue?: (row: T) => string | number
  align?: 'start' | 'end'
  /** Hidden in the stacked mobile cards (secondary info). */
  hideOnPhone?: boolean
  width?: string
}

interface DataTableProps<T> {
  caption: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  /** Highlights rows that need attention. */
  rowTone?: (row: T) => 'alert' | 'ember' | undefined
  empty?: ReactNode
  initialSort?: { key: string; dir: 'asc' | 'desc' }
}

/**
 * Semantic table (caption, scope, aria-sort) that turns into stacked cards under 860px.
 * Rows are focusable when clickable, and open with Enter like a link.
 */
export function DataTable<T>({ caption, columns, rows, rowKey, onRowClick, rowTone, empty, initialSort }: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort ?? null)

  const sorted = (() => {
    if (!sort) return rows
    const column = columns.find((c) => c.key === sort.key)
    if (!column?.sortValue) return rows
    const value = column.sortValue
    return [...rows].sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      const order = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'fr')
      return sort.dir === 'asc' ? order : -order
    })
  })()

  const toggleSort = (key: string) =>
    setSort((current) => (current?.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  if (rows.length === 0) return <EmptyState title="Rien à afficher">{empty}</EmptyState>

  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        <caption className="bo-sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key
              return (
                <th
                  key={column.key}
                  scope="col"
                  style={{ width: column.width }}
                  className={column.align === 'end' ? styles.end : undefined}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {column.sortValue ? (
                    <button type="button" className={styles.sort} onClick={() => toggleSort(column.key)}>
                      {column.header}
                      <Icon name={active && sort.dir === 'desc' ? 'arrowDown' : 'arrowUp'} size={13} className={active ? styles.sortOn : styles.sortOff} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {sorted.map((row) => {
              const tone = rowTone?.(row)
              return (
                <motion.tr
                  key={rowKey(row)}
                  layout="position"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className={[styles.row, onRowClick && styles.clickable, tone && styles[tone]].filter(Boolean).join(' ')}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter') onRowClick(row)
                        }
                      : undefined
                  }
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      data-label={column.header}
                      className={[column.align === 'end' && styles.end, column.hideOnPhone && styles.hideOnPhone].filter(Boolean).join(' ')}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </motion.tr>
              )
            })}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  )
}
