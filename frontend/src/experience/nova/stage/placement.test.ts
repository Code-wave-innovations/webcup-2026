import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { CAMERA_POSES } from '../../city/cameraPath'
import {
  balconySpot,
  cameraPoint,
  cockpitFrame,
  restingSection,
  stationX,
  walkwayFrame,
  walkwaySpot,
  walkwayX,
  type StageFrame,
  type WalkwaySpot,
} from './placement'

const frame = (): StageFrame => ({ x: 0, y: 0, z: 0, scale: 1, up: 'camera' })
const spot = (): WalkwaySpot => ({ ndcX: 0, ndcY: 0, height: 0, depth: 0 })

/** A city camera framing a district off-centre, as `CityStage` does. */
function cityCamera() {
  const camera = new PerspectiveCamera(40, 1440 / 900, 0.4, 4000)
  camera.setViewOffset(1440, 900, -245, 0, 1440, 900)
  camera.updateMatrixWorld()
  return camera
}

const project = (camera: PerspectiveCamera, p: { x: number; y: number; z: number }) => new Vector3(p.x, p.y, p.z).project(camera)

describe('cameraPoint', () => {
  it('lands on the requested screen point whatever the view offset', () => {
    const camera = cityCamera()
    const screen = project(camera, cameraPoint(camera, 0.68, -0.9, 2.4, new Vector3()))
    expect(screen.x).toBeCloseTo(0.68, 5)
    expect(screen.y).toBeCloseTo(-0.9, 5)
  })
})

describe('city walkway', () => {
  it('rests in the hero corner, then under each district, on the side opposite the text', () => {
    expect(walkwaySpot(0, false, spot()).ndcX).toBeCloseTo(0.68)
    for (let i = 1; i < CAMERA_POSES.length; i++) {
      expect(Math.sign(walkwaySpot(i, false, spot()).ndcX)).toBe(Math.sign(CAMERA_POSES[i].side))
    }
  })

  it('walks between stations as the camera flies, easing in and out', () => {
    const from = stationX(1)
    const to = stationX(2)
    expect(walkwaySpot(1.5, false, spot()).ndcX).toBeCloseTo((from + to) / 2)
    const early = walkwaySpot(1.1, false, spot()).ndcX - from
    const middle = walkwaySpot(1.5, false, spot()).ndcX - walkwaySpot(1.4, false, spot()).ndcX
    expect(Math.abs(early)).toBeLessThan(Math.abs(middle))
  })

  it('stays in place on a phone', () => {
    expect(walkwaySpot(0.4, true, spot()).ndcX).toBe(walkwaySpot(3.2, true, spot()).ndcX)
  })

  it('sizes Nova to a fraction of the screen and measures positions along the walkway in its heights', () => {
    const camera = cityCamera()
    const where = walkwaySpot(0, false, spot())
    const stage = walkwayFrame(camera, where, frame(), new Vector3())
    const top = project(camera, { x: stage.x, y: stage.y + stage.scale, z: stage.z })
    expect((top.y - where.ndcY) / 2).toBeCloseTo(where.height, 5)
    const x = walkwayX(camera, where, stage, where.ndcX, new Vector3())
    expect(project(camera, { x: stage.x + x * stage.scale, y: stage.y, z: stage.z }).x).toBeCloseTo(where.ndcX, 5)
  })

  it('knows when the camera rests on a section', () => {
    expect(restingSection(2)).toBe(2)
    expect(restingSection(2.006)).toBe(2)
    expect(restingSection(2.4)).toBeNull()
  })
})

describe('Observatory balcony', () => {
  it('shows Nova large beside the chat on a desktop, above it on a phone', () => {
    const desk = balconySpot(false, spot())
    expect(desk.ndcX).toBeLessThan(-0.3)
    expect(desk.height).toBeGreaterThan(0.5)
    const phone = balconySpot(true, spot())
    // its feet stand above the conversation, which fills the lower 62 % of the screen
    expect((1 - phone.ndcY) / 2).toBeLessThanOrEqual(0.38)
  })
})

describe('cockpitFrame', () => {
  it('stands on the glare shield on wide screens, follows the cockpit when it narrows', () => {
    const camera = new PerspectiveCamera(55, 1.6, 0.02, 800)
    const wide = cockpitFrame(camera, 1.6, frame(), new Vector3())
    const wideFrame = frame()
    cockpitFrame(camera, 1.6, wideFrame, new Vector3())
    const narrowFrame = frame()
    cockpitFrame(camera, 1.0, narrowFrame, new Vector3())
    expect(wide).toBeGreaterThan(0)
    expect(wideFrame.y).toBeCloseTo(-0.226)
    expect(Math.abs(narrowFrame.x)).toBeLessThan(Math.abs(wideFrame.x))
  })

  it('hovers above the hologram on a phone', () => {
    const camera = new PerspectiveCamera(74, 390 / 844, 0.02, 800)
    camera.updateMatrixWorld()
    const phone = frame()
    cockpitFrame(camera, 390 / 844, phone, new Vector3())
    expect(project(camera, phone).y).toBeCloseTo(0.28, 5)
  })
})
