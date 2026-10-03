const COLORS = ['var(--color-ice)', 'var(--color-ice-bright)', 'var(--color-ember)', 'var(--color-ok)']

/**
 * Celebration: a burst of small hexagons from `origin` (CSS pixels), falling under a little gravity and
 * spinning out. Pure DOM and Web Animations, cleaned up when done. Nothing when motion is reduced.
 */
export function hexBurst(origin: { x: number; y: number }, count = 34): void {
  if (typeof document === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:30;overflow:hidden'
  document.body.append(layer)
  const done: Promise<unknown>[] = []
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('i')
    const size = 6 + Math.random() * 9
    piece.style.cssText =
      `position:absolute;left:${origin.x}px;top:${origin.y}px;width:${size}px;height:${size * 1.15}px;margin:${-size / 2}px;` +
      `background:${COLORS[i % COLORS.length]};clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);` +
      `box-shadow:0 0 10px currentColor`
    layer.append(piece)
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5
    const speed = 140 + Math.random() * 260
    const dx = Math.cos(angle) * speed
    const dy = Math.sin(angle) * speed
    const spin = (Math.random() - 0.5) * 900
    const duration = 1100 + Math.random() * 700
    const animation = piece.animate(
      [
        { transform: 'translate(0,0) rotate(0deg) scale(0.4)', opacity: 1 },
        { transform: `translate(${dx * 0.7}px,${dy * 0.7}px) rotate(${spin * 0.5}deg) scale(1)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${dx}px,${dy + 220}px) rotate(${spin}deg) scale(0.6)`, opacity: 0 },
      ],
      { duration, easing: 'cubic-bezier(.15,.7,.35,1)', fill: 'forwards' },
    )
    done.push(animation.finished)
  }
  void Promise.allSettled(done).then(() => layer.remove())
}
