import { CanvasTexture } from 'three'

export interface CockpitScreen {
  canvas: HTMLCanvasElement
  texture: CanvasTexture
  kind: 'radar' | 'trajectory' | 'systems'
}

export interface ScreenReadout {
  distanceKm: number
  /** entry plasma 0 → 1: the shield gauge turns amber and drains */
  plasma: number
}

const WIDTH = 512
const HEIGHT = 160
const LINE = 'rgba(120,225,255,.9)'
const TEXT = 'rgba(150,235,255,.95)'

export function createCockpitScreen(kind: CockpitScreen['kind']): CockpitScreen {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  return { canvas, texture: new CanvasTexture(canvas), kind }
}

/** Redraws the three dashboard displays (radar, approach trajectory, ship systems). */
export function drawCockpitScreens(screens: readonly CockpitScreen[], time: number, readout: ScreenReadout): void {
  for (const screen of screens) {
    const c = screen.canvas.getContext('2d')
    if (!c) continue
    c.fillStyle = '#020a12'
    c.fillRect(0, 0, WIDTH, HEIGHT)
    c.strokeStyle = LINE
    c.fillStyle = TEXT
    c.lineWidth = 2
    c.font = '600 17px "Chakra Petch", sans-serif'
    if (screen.kind === 'radar') drawRadar(c, time)
    else if (screen.kind === 'trajectory') drawTrajectory(c, time, readout.distanceKm)
    else drawSystems(c, time, readout.plasma)
    screen.texture.needsUpdate = true
  }
}

function drawRadar(c: CanvasRenderingContext2D, time: number) {
  c.save()
  c.translate(86, 80)
  for (let i = 1; i <= 3; i++) {
    c.globalAlpha = 0.5
    c.beginPath()
    c.arc(0, 0, i * 22, 0, Math.PI * 2)
    c.stroke()
  }
  c.globalAlpha = 1
  const angle = time * 1.3
  c.beginPath()
  c.moveTo(0, 0)
  c.lineTo(Math.cos(angle) * 66, Math.sin(angle) * 66)
  c.stroke()
  const sweep = c.createRadialGradient(0, 0, 0, 0, 0, 66)
  sweep.addColorStop(0, 'rgba(120,225,255,0)')
  sweep.addColorStop(1, 'rgba(120,225,255,.35)')
  c.fillStyle = sweep
  c.beginPath()
  c.moveTo(0, 0)
  c.arc(0, 0, 66, angle - 0.7, angle)
  c.fill()
  c.fillStyle = '#ffc56b'
  for (const [x, y] of [[26, -16], [-36, 22], [9, 44]]) {
    c.beginPath()
    c.arc(x, y, 4, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()
  c.fillStyle = TEXT
  c.fillText('TRAFIC ORBITAL', 190, 40)
  c.fillText('3 contacts, couloir libre', 190, 68)
  c.fillStyle = '#7CFFB2'
  c.fillText('APPROCHE STABLE', 190, 124)
}

function drawTrajectory(c: CanvasRenderingContext2D, time: number, distanceKm: number) {
  c.globalAlpha = 0.45
  for (let i = 0; i < 6; i++) {
    c.beginPath()
    c.moveTo(20, 24 + i * 24)
    c.lineTo(492, 24 + i * 24)
    c.stroke()
  }
  c.globalAlpha = 1
  c.lineWidth = 3
  c.strokeStyle = '#ffc56b'
  c.beginPath()
  c.moveTo(30, 136)
  c.quadraticCurveTo(250, 124, 440, 46)
  c.stroke()
  const p = (time * 0.06) % 1
  const x = (1 - p) * (1 - p) * 30 + 2 * (1 - p) * p * 250 + p * p * 440
  const y = (1 - p) * (1 - p) * 136 + 2 * (1 - p) * p * 124 + p * p * 46
  c.fillStyle = '#fff'
  c.beginPath()
  c.arc(x, y, 6, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = LINE
  c.beginPath()
  c.arc(452, 40, 20, 0, Math.PI * 2)
  c.stroke()
  c.fillStyle = TEXT
  c.fillText('TERRA NOVA', 318, 92)
  c.fillText(`${distanceKm} km`, 30, 36)
}

const SYSTEMS: ReadonlyArray<readonly [string, number]> = [
  ['ÉNERGIE', 0.84],
  ['BOUCLIER', 0.96],
  ['OXYGÈNE', 0.91],
  ['COQUE', 0.99],
]

function drawSystems(c: CanvasRenderingContext2D, time: number, plasma: number) {
  SYSTEMS.forEach(([label, level], n) => {
    const y = 36 + n * 34
    const shield = n === 1
    const value = level + Math.sin(time * 0.7 + n) * 0.01
    c.fillStyle = TEXT
    c.fillText(label, 24, y)
    c.fillStyle = 'rgba(120,225,255,.18)'
    c.fillRect(170, y - 13, 310, 13)
    c.fillStyle = shield && plasma > 0.1 ? '#ffc56b' : LINE
    c.fillRect(170, y - 13, 310 * value * (shield ? 1 - plasma * 0.4 : 1), 13)
  })
}
