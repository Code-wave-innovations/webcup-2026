import { useEffect } from 'react'

/** Adds a class on <body> while `active` is true (page-level states such as scroll lock). */
export function useBodyClass(className: string, active = true): void {
  useEffect(() => {
    if (!active) return
    document.body.classList.add(className)
    return () => document.body.classList.remove(className)
  }, [className, active])
}
