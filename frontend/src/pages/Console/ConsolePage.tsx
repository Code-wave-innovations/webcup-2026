import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { defineMessages, useMessages } from '../../i18n'
import { Breadcrumbs, type Crumb } from '../../ui/Breadcrumbs'
import styles from './ConsoleLayout.module.css'

const messages = defineMessages({ home: 'Accueil' }, { home: 'Home' })

interface ConsolePageProps {
  title: string
  lead?: ReactNode
  /** levels between the city's home and this page (D15); the home and the page itself are added */
  crumbs?: Crumb[]
  /** buttons next to the title */
  actions?: ReactNode
  children: ReactNode
}

/** Frame of a console page: trail, title (focused on arrival), lead, then the content. */
export function ConsolePage({ title, lead, crumbs = [], actions, children }: ConsolePageProps) {
  useDocumentTitle(title)
  const m = useMessages(messages)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const { pathname } = useLocation()

  // arriving on a page (lazy-loaded ones included): its title takes the focus for keyboard and screen reader users
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [pathname])
  return (
    <>
      <header className={styles.header}>
        <Breadcrumbs items={[{ label: m.home, to: '/ville' }, ...crumbs, { label: title }]} />
        <div className={styles.titleRow}>
          <h1 ref={titleRef} className={styles.title} tabIndex={-1}>
            {title}
          </h1>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
        {lead && <p className={styles.lead}>{lead}</p>}
      </header>
      <div className={styles.body}>{children}</div>
    </>
  )
}
