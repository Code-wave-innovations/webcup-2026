import { parsePath, type To } from 'react-router'

/**
 * F96: the light version lives under `/leger` (airlock `/leger`, city `/leger/ville`, chat `/leger/nova`).
 * The complete film keeps `/`, `/ville` and `/nova`. Staff, the team page and the demos stay at the root.
 */
export const LIGHT_PREFIX = '/leger'

export function isLightPath(pathname: string): boolean {
  return pathname === LIGHT_PREFIX || pathname.startsWith(`${LIGHT_PREFIX}/`)
}

/** Path the routes and the screens compare, with `/leger` removed. */
export function barePath(pathname: string): string {
  if (pathname === LIGHT_PREFIX) return '/'
  if (pathname.startsWith(`${LIGHT_PREFIX}/`)) return pathname.slice(LIGHT_PREFIX.length) || '/'
  return pathname
}

/** Airlock, city and chat: the pages that exist in both versions. */
export function isCitizenPath(pathname: string): boolean {
  const path = barePath(pathname)
  return path === '/' || path === '/ville' || path.startsWith('/ville/') || path === '/nova' || path.startsWith('/nova/')
}

export function toLight(pathname: string): string {
  const bare = barePath(pathname)
  if (!isCitizenPath(bare)) return pathname
  return bare === '/' ? LIGHT_PREFIX : `${LIGHT_PREFIX}${bare}`
}

/** Where `pathname` should sit for this version. Staff and demo URLs are left as they are. */
export function pathForMode(pathname: string, mode: 'light' | 'complete'): string {
  const bare = barePath(pathname)
  if (!isCitizenPath(bare)) return pathname
  return mode === 'light' ? toLight(bare) : bare
}

/** Prefix a citizen target while the light version is on. Relative targets are resolved by the router first. */
export function prefixTo(to: To): To {
  if (typeof to === 'string') {
    if (!to.startsWith('/')) return to
    const parsed = parsePath(to)
    if (!parsed.pathname || !isCitizenPath(parsed.pathname)) return to
    return { ...parsed, pathname: toLight(parsed.pathname) }
  }
  if (!to.pathname || !to.pathname.startsWith('/') || !isCitizenPath(to.pathname)) return to
  return { ...to, pathname: toLight(to.pathname) }
}
