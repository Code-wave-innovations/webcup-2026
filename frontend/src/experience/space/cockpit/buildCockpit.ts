import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type IUniform,
  type Material,
} from 'three'
import valueNoise from '../../glsl/valueNoise.glsl?raw'
import hullVert from '../glsl/hull.vert.glsl?raw'
import hullFrag from '../glsl/hull.frag.glsl?raw'
import canopyVert from '../glsl/canopy.vert.glsl?raw'
import canopyFrag from '../glsl/canopy.frag.glsl?raw'
import { createCockpitScreen, type CockpitScreen } from './cockpitScreens'

/** Uniforms shared by every cockpit surface, updated each frame in camera space. */
export interface CockpitUniforms {
  [name: string]: IUniform
  uSoleilVue: IUniform<Vector3>
  uPlaneteVue: IUniform<Vector3>
  uEcrans: IUniform<number>
  uPlasma: IUniform<number>
  uTemps: IUniform<number>
}

export interface Cockpit {
  /** attach to the camera: the cockpit moves with the view */
  group: Group
  /** the hologram emitter lens on the dashboard */
  lens: Mesh
  screens: CockpitScreen[]
  uniforms: CockpitUniforms
}

type Vec3 = readonly [number, number, number]

const INDICATOR_TINTS: Vec3[] = [
  [0.2, 1.3, 1.7], [0.2, 1.3, 1.7], [1.7, 0.9, 0.2], [0.3, 1.6, 0.6],
  [1.7, 0.25, 0.15], [0.03, 0.04, 0.05], [0.03, 0.04, 0.05], [0.03, 0.04, 0.05],
]
const DASH_TILT = -0.35

/** Dark-metal cockpit seen from the pilot seat: dashboard, canopy frame, screens, indicators, canopy glass. */
export function buildCockpit(): Cockpit {
  const group = new Group()
  const uniforms: CockpitUniforms = {
    uSoleilVue: { value: new Vector3() },
    uPlaneteVue: { value: new Vector3() },
    uEcrans: { value: 1 },
    uPlasma: { value: 0 },
    uTemps: { value: 0 },
  }
  const metal = (r: number, g: number, b: number, gloss: number) =>
    new ShaderMaterial({
      uniforms: { ...uniforms, uBase: { value: new Color(r, g, b) }, uBrillant: { value: gloss } },
      vertexShader: hullVert,
      fragmentShader: `${valueNoise}\n${hullFrag}`,
      side: DoubleSide,
    })
  const steel = metal(0.06, 0.07, 0.09, 1)
  const dark = metal(0.02, 0.023, 0.03, 0.22)

  const box = (size: Vec3, position: Vec3, rotation: Vec3 = [0, 0, 0], material: Material = steel) => {
    const mesh = new Mesh(new BoxGeometry(...size), material)
    mesh.position.set(...position)
    mesh.rotation.set(...rotation)
    group.add(mesh)
  }
  const strut = (from: Vec3, to: Vec3, thickness: number, width: number) => {
    const a = new Vector3(...from)
    const direction = new Vector3(...to).sub(a)
    const mesh = new Mesh(new BoxGeometry(thickness, direction.length(), width), steel)
    mesh.position.copy(a).addScaledVector(direction, 0.5)
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize())
    group.add(mesh)
  }

  // dashboard tilted towards the pilot, glare shield, canopy pillars, top arch, ceiling console
  box([2.9, 0.5, 0.05], [0, -0.5, -0.731], [DASH_TILT, 0, 0], dark)
  box([2.9, 0.045, 0.8], [0, -0.238, -1.16], [0.055, 0, 0], dark)
  box([2.9, 0.06, 0.06], [0, -0.243, -0.775], [DASH_TILT, 0, 0])
  box([2.5, 0.05, 0.07], [0, -0.255, -1.53])
  for (const side of [-1, 1]) {
    strut([1.02 * side, -0.26, -1.52], [0.56 * side, 0.64, -0.74], 0.095, 0.12)
    strut([1.02 * side, -0.26, -1.52], [1.5 * side, -0.3, -0.4], 0.1, 0.09)
    strut([0.56 * side, 0.64, -0.74], [1.25 * side, 0.6, -0.05], 0.09, 0.1)
  }
  box([1.22, 0.075, 0.11], [0, 0.642, -0.74], [0.2, 0, 0])
  box([0.5, 0.085, 0.36], [0, 0.575, -0.62], [0.3, 0, 0], dark)

  // hologram emitter on the glare shield
  const base = new Mesh(new CylinderGeometry(0.05, 0.062, 0.022, 28), steel)
  base.position.set(0.28, -0.2105, -0.84)
  group.add(base)
  const lens = new Mesh(new CylinderGeometry(0.036, 0.036, 0.006, 28), new MeshBasicMaterial({ color: new Color(1.2, 3.4, 4.2) }))
  lens.position.set(0.28, -0.1965, -0.84)
  group.add(lens)

  // three live dashboard displays
  const screens = (['radar', 'trajectory', 'systems'] as const).map((kind, index) => {
    const x = (index - 1) * 0.415
    const screen = createCockpitScreen(kind)
    const display = new Mesh(new PlaneGeometry(0.38, 0.119), new MeshBasicMaterial({ map: screen.texture, color: new Color(1.25, 1.25, 1.25) }))
    display.position.set(x, -0.335, -0.756)
    display.rotation.x = DASH_TILT
    group.add(display)
    const bezel = new Mesh(new PlaneGeometry(0.4, 0.14), steel)
    bezel.position.set(x, -0.3355, -0.76)
    bezel.rotation.x = DASH_TILT
    group.add(bezel)
    return screen
  })

  group.add(buildIndicators())
  for (let i = 0; i < 14; i++) {
    const lit = i % 4 === 0
    const row = (i / 7) | 0
    const button = new Mesh(
      new BoxGeometry(0.018, 0.006, 0.012),
      new MeshBasicMaterial({ color: new Color(lit ? 2.6 : 0.25, lit ? 0.5 : 1.9, lit ? 0.2 : 2.4) }),
    )
    button.position.set(-0.19 + (i % 7) * 0.063, 0.535 - row * 0.02, -0.52 - row * 0.07)
    group.add(button)
  }

  // canopy glass: dust and streaks, visible only against the sun
  const canopy = new Mesh(
    new PlaneGeometry(2.6, 1.15),
    new ShaderMaterial({
      uniforms,
      vertexShader: canopyVert,
      fragmentShader: `${valueNoise}\n${canopyFrag}`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  )
  canopy.position.set(0, 0.24, -1.32)
  canopy.rotation.x = 0.42
  group.add(canopy)

  return { group, lens, screens, uniforms }
}

/** 150 small indicator lights snapped to a grid on the dashboard, in four clusters. */
function buildIndicators(): InstancedMesh {
  const count = 150
  const indicators = new InstancedMesh(new BoxGeometry(0.0085, 0.008, 0.004), new MeshBasicMaterial(), count)
  const matrix = new Matrix4()
  const tilt = new Quaternion().setFromEuler(new Euler(DASH_TILT, 0, 0))
  const one = new Vector3(1, 1, 1)
  const color = new Color()
  for (let i = 0; i < count; i++) {
    const zone = i % 4
    let x = zone < 2 ? (zone ? 0.2075 : -0.2075) + (Math.random() - 0.5) * 0.022 : (zone === 2 ? -0.7 : 0.7) + (Math.random() - 0.5) * 0.16
    let y = -0.28 - Math.random() * 0.105
    x = Math.round(x / 0.0115) * 0.0115
    y = Math.round(y / 0.015) * 0.015
    matrix.compose(new Vector3(x, y, -0.764 - (y + 0.305) * 0.365), tilt, one)
    indicators.setMatrixAt(i, matrix)
    const tint = INDICATOR_TINTS[(Math.random() * INDICATOR_TINTS.length) | 0]
    indicators.setColorAt(i, color.setRGB(tint[0], tint[1], tint[2]))
  }
  return indicators
}
