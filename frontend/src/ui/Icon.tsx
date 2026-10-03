const PATHS = {
  check: <path d="M20 6 9 17l-5-5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  alert: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  hex: <path d="M12 2 20.7 7v10L12 22 3.3 17V7z" />,
  send: (
    <>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4z" />
    </>
  ),
  back: (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  face: (
    <>
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  walk: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M8 21l2-7-3-3 2-4 5 4 2 3" />
      <path d="m15 21-1.5-6" />
    </>
  ),
  golf: (
    <>
      <path d="M12 18V3l7 4-7 4" />
      <circle cx="12" cy="20" r="2" />
    </>
  ),
  stadium: (
    <>
      <ellipse cx="12" cy="12" rx="10" ry="6" />
      <path d="M2 12v3c0 3.3 4.5 6 10 6s10-2.7 10-6v-3" />
      <path d="M2 12V9c0-3.3 4.5-6 10-6s10 2.7 10 6v3" />
    </>
  ),
  village: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V7l4-4 4 4v14" />
      <path d="M13 21v-6l3.5-3L20 15v6" />
      <path d="M7 9v.01M7 13v.01M11 9v.01M11 13v.01" />
    </>
  ),
  rocket: (
    <>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </>
  ),
} as const

export type IconName = keyof typeof PATHS

/** Line icons (decorative: the surrounding text carries the meaning). */
export function Icon({ name, size = 18, stroke = 2 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}

/** NOVA's mark: a hexagon with a lit core. `filled` draws the small solid variant used as a place marker. */
export function NovaMark({ size = 24, stroke = 2, filled = false }: { size?: number; stroke?: number; filled?: boolean }) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2 20.7 7v10L12 22 3.3 17V7z" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 20.7 7v10L12 22 3.3 17V7z" />
      <path d="M12 8.2 15.3 10.1v3.8L12 15.8 8.7 13.9v-3.8z" fill="currentColor" stroke="none" />
    </svg>
  )
}
