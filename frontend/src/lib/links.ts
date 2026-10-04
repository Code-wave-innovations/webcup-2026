// Notification links are neutral API paths (`/announcements/12`, `/transport/lines/T1`…). This turns them into
// citizen routes; the back-office has its own mapping (backoffice/layout/Topbar.tsx, `staffLink`).

const CITIZEN_ROUTES: [RegExp, (match: RegExpMatchArray) => string][] = [
  [/^\/transport\/lines\/([^/?#]+)/, (m) => `/ville/transports?ligne=${encodeURIComponent(decodeURIComponent(m[1]))}`],
  [/^\/announcements\/(\d+)/, (m) => `/ville/annonces/${m[1]}`],
]

/** Citizen route for a notification link, or null when the citizen space has no page for it yet. */
export function citizenLink(link: string | null | undefined): string | null {
  if (!link) return null
  for (const [pattern, route] of CITIZEN_ROUTES) {
    const match = link.match(pattern)
    if (match) return route(match)
  }
  return null
}
