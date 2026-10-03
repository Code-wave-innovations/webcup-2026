import { useEffect } from 'react'

const SITE = 'NOVA · Terra Nova'

/** Names the browser tab after the page, which screen readers also announce on navigation. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${SITE}`
    return () => {
      document.title = SITE
    }
  }, [title])
}
