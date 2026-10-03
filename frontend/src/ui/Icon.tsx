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
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
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
