import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DynamicDrawUsage,
  Group,
  Mesh,
  PointLight,
  Points,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from 'three'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { damp } from '../../../lib/math'
import { director } from '../../director/director'
import { FRAME_PRIORITY } from '../../framePriority'
import { useCity } from '../CityContext'
import { CROUCH_SECONDS, NOVA_WORLD_SCALE, novaFlightFrame } from './flightPath'

/** repulsors in Nova's frame (1 unit tall, facing +Z, its left towards +X): feet, then palms (arms along the body) */
const THRUSTERS: ReadonlyArray<{ x: number; y: number; z: number; hand: boolean }> = [
  { x: 0.075, y: 0.015, z: -0.01, hand: false },
  { x: -0.075, y: 0.015, z: -0.01, hand: false },
  { x: 0.205, y: 0.28, z: -0.02, hand: true },
  { x: -0.205, y: 0.28, z: -0.02, hand: true },
]
const ICE = new Color(0.55, 0.88, 1.0)
const TRAIL_POINTS = 90
/** seconds a contrail lingers */
const TRAIL_LIFE = 1.15
const SHOCK_SECONDS = 0.85
const SHOCK_RADIUS = 9

const flameVert = /* glsl */ `
varying float vT; varying vec3 vN; varying vec3 vV;
void main(){
  vT=clamp(-position.y,0.0,1.0);
  vec4 world=modelMatrix*vec4(position,1.0);
  vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-world.xyz);
  gl_Position=projectionMatrix*viewMatrix*world; }`
const flameFrag = /* glsl */ `
uniform float uTemps; uniform float uPoussee; uniform vec3 uCouleur; varying float vT; varying vec3 vN; varying vec3 vV;
void main(){
  float bord=pow(abs(dot(vN,vV)),1.4);
  float flamme=sin(vT*22.0-uTemps*61.0)*0.5+0.5;
  float a=pow(1.0-vT,1.6)*bord*(0.75+0.25*flamme)*uPoussee;
  vec3 col=mix(vec3(1.0),uCouleur,smoothstep(0.0,0.45,vT));
  gl_FragColor=vec4(col*a*1.6,a); }`

const glowVert = /* glsl */ `
attribute float aTaille; uniform float uEchelle; varying float vA; attribute float aForce;
void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv;
  gl_PointSize=clamp(aTaille*uEchelle/max(-mv.z,0.5),0.0,180.0); vA=aForce; }`
const glowFrag = /* glsl */ `
uniform vec3 uCouleur; varying float vA;
void main(){ vec2 p=gl_PointCoord*2.0-1.0; float d=dot(p,p); if(d>1.0) discard;
  float a=(exp(-d*5.0)*0.9+exp(-d*28.0)*0.9)*vA;
  gl_FragColor=vec4(mix(uCouleur,vec3(1.0),exp(-d*20.0))*a,a); }`

const trailVert = /* glsl */ `
attribute float aAlpha; varying float vAlpha; varying float vSide; attribute float aSide;
void main(){ vAlpha=aAlpha; vSide=aSide; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`
const trailFrag = /* glsl */ `
uniform vec3 uCouleur; varying float vAlpha; varying float vSide;
void main(){ float a=vAlpha*(1.0-vSide*vSide);
  gl_FragColor=vec4(mix(uCouleur,vec3(1.0),vAlpha*0.6)*a,a); }`

const shockVert = /* glsl */ `
varying vec2 vP; void main(){ vP=position.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`
const shockFrag = /* glsl */ `
uniform float uAge; uniform vec3 uCouleur; varying vec2 vP;
void main(){ float r=length(vP); float front=mix(0.15,1.0,sqrt(uAge));
  float ring=exp(-pow((r-front)/0.07,2.0))+exp(-pow((r-front*0.7)/0.16,2.0))*0.35;
  float a=ring*(1.0-uAge)*(1.0-uAge)*0.9;
  gl_FragColor=vec4(mix(uCouleur,vec3(1.0),0.35)*a,a); }`

interface Trail {
  /** x, y, z, birth time, strength per point (a ring buffer) */
  points: Float32Array
  head: number
  geometry: BufferGeometry
}

function createTrail(): Trail {
  const geometry = new BufferGeometry()
  const position = new BufferAttribute(new Float32Array(TRAIL_POINTS * 2 * 3), 3).setUsage(DynamicDrawUsage)
  const alpha = new BufferAttribute(new Float32Array(TRAIL_POINTS * 2), 1).setUsage(DynamicDrawUsage)
  const side = new Float32Array(TRAIL_POINTS * 2).map((_, i) => (i % 2 ? 1 : -1))
  geometry.setAttribute('position', position)
  geometry.setAttribute('aAlpha', alpha)
  geometry.setAttribute('aSide', new BufferAttribute(side, 1))
  const index: number[] = []
  for (let i = 0; i < TRAIL_POINTS - 1; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  geometry.setIndex(index)
  return { points: new Float32Array(TRAIL_POINTS * 5).fill(-1e3), head: 0, geometry }
}

interface Fx {
  body: Group
  flames: Mesh[]
  glow: Points
  light: PointLight
  trails: Trail[]
  trailMeshes: Mesh[]
  shock: Mesh
  materials: ShaderMaterial[]
  geometries: BufferGeometry[]
}

const disposeFx = (fx: Fx) => {
  fx.materials.forEach((m) => m.dispose())
  fx.geometries.forEach((g) => g.dispose())
  fx.light.dispose()
}

const _foot = new Vector3()
const _a = new Vector3()
const _b = new Vector3()
const _toCamera = new Vector3()
const _side = new Vector3()

/**
 * Nova's flight effects: repulsor flames and glows at its feet and palms (and their light on its armour), two
 * vapour contrails from the feet, and a shockwave on the ground at the burst and at the touchdown.
 */
export function FlightFx({ light: lowTier }: { light: boolean }) {
  const { pointScale } = useCity()

  const fx = useMemo<Fx>(() => {
    const flameMaterial = new ShaderMaterial({
      uniforms: { uTemps: { value: 0 }, uPoussee: { value: 0 }, uCouleur: { value: ICE } },
      vertexShader: flameVert,
      fragmentShader: flameFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const flameGeometry = new ConeGeometry(1, 1, 14, 1, true)
    flameGeometry.rotateX(Math.PI)
    flameGeometry.translate(0, -0.5, 0)
    const body = new Group()
    const flames = THRUSTERS.map((t) => {
      const flame = new Mesh(flameGeometry, flameMaterial)
      flame.position.set(t.x, t.y, t.z)
      flame.frustumCulled = false
      body.add(flame)
      return flame
    })

    const glowGeometry = new BufferGeometry()
    glowGeometry.setAttribute('position', new BufferAttribute(Float32Array.from(THRUSTERS.flatMap((t) => [t.x, t.y - 0.03, t.z])), 3))
    glowGeometry.setAttribute('aTaille', new BufferAttribute(Float32Array.from(THRUSTERS, (t) => (t.hand ? 0.5 : 0.65)), 1))
    glowGeometry.setAttribute('aForce', new BufferAttribute(new Float32Array(THRUSTERS.length), 1).setUsage(DynamicDrawUsage))
    const glowMaterial = new ShaderMaterial({
      uniforms: { uEchelle: pointScale, uCouleur: { value: ICE } },
      vertexShader: glowVert,
      fragmentShader: glowFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const glow = new Points(glowGeometry, glowMaterial)
    glow.frustumCulled = false
    body.add(glow)

    // the repulsors light Nova's legs from below
    const light = new PointLight(ICE.clone(), 0, 2.2, 2)
    light.position.set(0, 0.05, 0)
    body.add(light)

    const trailMaterial = new ShaderMaterial({
      uniforms: { uCouleur: { value: ICE } },
      vertexShader: trailVert,
      fragmentShader: trailFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const trails = [createTrail(), createTrail()]
    const trailMeshes = trails.map((trail) => {
      const mesh = new Mesh(trail.geometry, trailMaterial)
      mesh.frustumCulled = false
      mesh.visible = false
      return mesh
    })

    const shockGeometry = new RingGeometry(0, 1, 64, 1)
    shockGeometry.rotateX(-Math.PI / 2)
    const shockMaterial = new ShaderMaterial({
      uniforms: { uAge: { value: 1 }, uCouleur: { value: ICE } },
      vertexShader: shockVert,
      fragmentShader: shockFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const shock = new Mesh(shockGeometry, shockMaterial)
    shock.frustumCulled = false
    shock.visible = false

    return {
      body,
      flames,
      glow,
      light,
      trails,
      trailMeshes,
      shock,
      materials: [flameMaterial, glowMaterial, trailMaterial, shockMaterial],
      geometries: [flameGeometry, glowGeometry, shockGeometry, ...trails.map((t) => t.geometry)],
    }
  }, [pointScale])
  useDisposeOnUnmount(fx, disposeFx)

  const state = useMemo(() => ({ thrust: 0, lastT: -1, shockAt: -10, shockPos: new Vector3() }), [])

  useFrame(({ camera }) => {
    const time = director.time
    const flight = director.flight
    const reduced = director.reducedMotion
    const inWorld = director.novaInWorld && !reduced
    const target = inWorld && flight ? flight.sample.thrust : 0
    state.thrust += (target - state.thrust) * damp(target > state.thrust ? 18 : 6, director.dt)
    const thrust = state.thrust
    const phase = flight?.phase ?? null
    const airborne = phase === 'takeoff' || phase === 'cruise' || phase === 'flare'

    // the repulsors, carried by Nova's body
    fx.body.visible = inWorld && thrust > 0.01
    if (fx.body.visible) {
      novaFlightFrame(director.roam.nova, NOVA_WORLD_SCALE, fx.body.position, fx.body.quaternion)
      fx.body.scale.setScalar(NOVA_WORLD_SCALE)
      const force = fx.glow.geometry.getAttribute('aForce') as BufferAttribute
      THRUSTERS.forEach((t, i) => {
        const on = t.hand ? (airborne ? thrust : 0) : thrust
        const flicker = 0.85 + 0.15 * Math.sin(time * 53 + i * 1.7)
        fx.flames[i].visible = on > 0.02
        fx.flames[i].scale.set(0.034 + 0.012 * on, (0.12 + 0.5 * on) * flicker * (t.hand ? 0.75 : 1), 0.034 + 0.012 * on)
        force.setX(i, on * flicker)
      })
      force.needsUpdate = true
      ;(fx.flames[0].material as ShaderMaterial).uniforms.uTemps.value = time
      ;(fx.flames[0].material as ShaderMaterial).uniforms.uPoussee.value = Math.min(1, thrust * 1.3)
      fx.light.intensity = thrust * 6
    }

    // contrails: a point per frame from each foot while the flight is fast enough, fading with age
    const emitting = inWorld && airborne && !lowTier && (flight?.speed ?? 0) > 0.3
    fx.trails.forEach((trail, n) => {
      if (emitting) {
        _foot.set(THRUSTERS[n].x, -0.08, 0)
        fx.body.localToWorld(_foot)
        const p = trail.points
        const at = trail.head * 5
        p[at] = _foot.x
        p[at + 1] = _foot.y
        p[at + 2] = _foot.z
        p[at + 3] = time
        p[at + 4] = Math.min(1, (flight!.speed - 0.3) * 2.5)
        trail.head = (trail.head + 1) % TRAIL_POINTS
      }
      fx.trailMeshes[n].visible = writeTrail(trail, time, camera.position)
    })

    // the shockwave: at the burst (where it pushed off) and at the touchdown
    if (flight && inWorld) {
      const t = flight.t
      if (state.lastT < CROUCH_SECONDS && t >= CROUCH_SECONDS) {
        state.shockAt = time
        state.shockPos.copy(flight.plan.curve.points[0])
      }
      if (flight.plan.lands && state.lastT < flight.plan.arrival && t >= flight.plan.arrival) {
        state.shockAt = time
        state.shockPos.copy(flight.sample.position)
      }
      state.lastT = t
    } else {
      state.lastT = -1
    }
    const age = (time - state.shockAt) / SHOCK_SECONDS
    fx.shock.visible = age >= 0 && age < 1
    if (fx.shock.visible) {
      fx.shock.position.set(state.shockPos.x, state.shockPos.y + 0.06, state.shockPos.z)
      fx.shock.scale.setScalar(SHOCK_RADIUS)
      ;(fx.shock.material as ShaderMaterial).uniforms.uAge.value = age
    }
  }, FRAME_PRIORITY.details)

  return (
    <>
      <primitive object={fx.body} />
      {fx.trailMeshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
      <primitive object={fx.shock} />
    </>
  )
}

/** Writes a contrail's ribbon (oldest point first, facing the camera, widening as it dissipates); false when empty. */
function writeTrail(trail: Trail, time: number, eye: Vector3): boolean {
  const position = trail.geometry.getAttribute('position') as BufferAttribute
  const alpha = trail.geometry.getAttribute('aAlpha') as BufferAttribute
  const p = trail.points
  const ageOf = (k: number) => (time - p[((trail.head + k) % TRAIL_POINTS) * 5 + 3]) / TRAIL_LIFE
  // dead points (the oldest ones) collapse onto the first live one, so no strip stretches back to an old flight
  let first = 0
  while (first < TRAIL_POINTS && !(ageOf(first) >= 0 && ageOf(first) < 1)) first++
  if (first === TRAIL_POINTS) return false
  const anchor = ((trail.head + first) % TRAIL_POINTS) * 5
  for (let k = 0; k < first; k++) {
    position.setXYZ(k * 2, p[anchor], p[anchor + 1], p[anchor + 2])
    position.setXYZ(k * 2 + 1, p[anchor], p[anchor + 1], p[anchor + 2])
    alpha.setX(k * 2, 0)
    alpha.setX(k * 2 + 1, 0)
  }
  for (let k = first; k < TRAIL_POINTS; k++) {
    // k = 0 is the oldest point of the ring buffer
    const i = (trail.head + k) % TRAIL_POINTS
    const next = (trail.head + Math.min(k + 1, TRAIL_POINTS - 1)) % TRAIL_POINTS
    const prev = (trail.head + Math.max(k - 1, first)) % TRAIL_POINTS
    const age = (time - p[i * 5 + 3]) / TRAIL_LIFE
    const live = age >= 0 && age < 1
    _a.set(p[next * 5], p[next * 5 + 1], p[next * 5 + 2])
    _b.set(p[prev * 5], p[prev * 5 + 1], p[prev * 5 + 2])
    _a.sub(_b)
    _toCamera.set(eye.x - p[i * 5], eye.y - p[i * 5 + 1], eye.z - p[i * 5 + 2])
    _side.crossVectors(_a, _toCamera)
    const len = _side.length()
    const width = live ? 0.08 + 0.9 * age : 0
    if (len > 1e-6) _side.multiplyScalar(width / len)
    else _side.set(0, 0, 0)
    position.setXYZ(k * 2, p[i * 5] - _side.x, p[i * 5 + 1] - _side.y, p[i * 5 + 2] - _side.z)
    position.setXYZ(k * 2 + 1, p[i * 5] + _side.x, p[i * 5 + 1] + _side.y, p[i * 5 + 2] + _side.z)
    const a = live ? Math.pow(1 - age, 2) * p[i * 5 + 4] * 0.22 : 0
    alpha.setX(k * 2, a)
    alpha.setX(k * 2 + 1, a)
  }
  position.needsUpdate = true
  alpha.needsUpdate = true
  return true
}
