/** Last pointer position over the window in normalised device coordinates (-1 → 1, y up). */
export const windowPointer = { x: 0, y: 0, seen: false }

let listening = false

/** Starts tracking (once): the 3D sits behind the DOM, so the canvas itself never receives the pointer. */
export function trackWindowPointer(): void {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener(
    'pointermove',
    (event) => {
      windowPointer.x = (event.clientX / window.innerWidth) * 2 - 1
      windowPointer.y = -((event.clientY / window.innerHeight) * 2 - 1)
      windowPointer.seen = true
    },
    { passive: true },
  )
}
