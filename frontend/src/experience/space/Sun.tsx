import { useMemo } from 'react'
import { AdditiveBlending, CanvasTexture, Color, SpriteMaterial } from 'three'
import { SUN_DIRECTION } from './spaceConfig'

const DISTANCE = 500
const SIZE = 56

/** A very bright core only: the glow around it comes from the film's halo pass. */
export function Sun() {
  const material = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const c = canvas.getContext('2d')!
    const gradient = c.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.07, 'rgba(255,255,255,.95)')
    gradient.addColorStop(0.16, 'rgba(255,255,255,.14)')
    gradient.addColorStop(0.5, 'rgba(255,255,255,.02)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = gradient
    c.fillRect(0, 0, 128, 128)
    return new SpriteMaterial({
      map: new CanvasTexture(canvas),
      color: new Color(11, 8, 5.2),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
  }, [])

  const position = useMemo(() => SUN_DIRECTION.clone().multiplyScalar(DISTANCE), [])
  return <sprite material={material} position={position} scale={[SIZE, SIZE, 1]} />
}
