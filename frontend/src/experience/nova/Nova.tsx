import { useGLTF } from '@react-three/drei'
import { useFrame, type RootState } from '@react-three/fiber'
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Camera,
  type Group,
  type Object3D,
} from 'three'
import { useDisposeOnUnmount } from '../../hooks/useDisposeOnUnmount'
import { clamp, damp, smoothstep } from '../../lib/math'
import { frameState } from '../director/frameState'
import { trackWindowPointer, windowPointer } from '../input/windowPointer'
import { LivingLayers } from './animation/LivingLayers'
import { measureWalkSpeed } from './animation/measureWalk'
import { NovaAnimator } from './animation/NovaAnimator'
import { resolvePose, speechProgress, type NovaPose } from './behavior/novaBrain'
import { trackNovaFocus } from './behavior/novaFocus'
import { nova, novaNow, novaSignals, tellNova, useNovaStore } from './behavior/novaStore'
import { createGltfRig, createStandInRig, type NovaRig } from './rig/createRig'
import type { RigReport } from './rig/rigContract'

export interface NovaProps {
  /** writes the world point Nova should look at and returns true; by default it follows the cursor */
  lookAt?: (out: Vector3, state: RootState) => boolean
  /** called once the model is ready (the test bench lists what was found in it) */
  onReady?: (report: RigReport) => void
  /** the visitor can hover and click Nova in the canvas (in the film, a DOM hit zone does it instead) */
  interactive?: boolean
  /** camera filming Nova, for its place on screen (bubble, hit zone, cursor distance); the canvas camera by default */
  camera?: () => Camera | null
  /** render layer of the whole body (the film keeps Nova out of the lake's reflection) */
  layer?: number
  /** a foot touched the ground while walking (world position): the walkway lights a footprint */
  onStep?: (foot: Vector3) => void
}

interface ModelProps extends NovaProps {
  modelUrl?: string | null
  /**
   * While the GLB downloads: show the stand-in (test bench), or suspend so that the parent's Suspense
   * waits for it (the film keeps its loading screen up rather than showing Nova pop in).
   */
  whileLoading?: 'standIn' | 'suspend'
}

/** Nova from a GLB when one is given, the procedural stand-in otherwise (and if loading fails). */
export function Nova({ modelUrl, whileLoading = 'standIn', ...props }: ModelProps) {
  const fallback = <StandInNova {...props} />
  const body = modelUrl ? <GltfNova url={modelUrl} {...props} /> : fallback
  return (
    <ModelBoundary key={modelUrl ?? 'stand-in'} fallback={fallback}>
      {whileLoading === 'standIn' ? <Suspense fallback={fallback}>{body}</Suspense> : body}
    </ModelBoundary>
  )
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('Nova model could not be loaded, using the stand-in:', error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const disposeRig = (rig: NovaRig) => rig.dispose()

function StandInNova(props: NovaProps) {
  const rig = useMemo(() => createStandInRig(), [])
  useDisposeOnUnmount(rig, disposeRig)
  return <NovaBody rig={rig} {...props} />
}

function GltfNova({ url, ...props }: NovaProps & { url: string }) {
  const gltf = useGLTF(url, false, true)
  const rig = useMemo(() => createGltfRig(gltf, url.startsWith('blob:') ? 'Fichier déposé' : url), [gltf, url])
  useDisposeOnUnmount(rig, disposeRig)
  return <NovaBody rig={rig} {...props} />
}

let glowTexture: CanvasTexture | null = null
let shadowTexture: CanvasTexture | null = null

/** Soft radial gradients, drawn once: the hover jets' glow and the contact shadow. */
function radialTexture(stops: Array<[number, string]>): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const c = canvas.getContext('2d')!
  const gradient = c.createRadialGradient(32, 32, 0, 32, 32, 32)
  for (const [at, color] of stops) gradient.addColorStop(at, color)
  c.fillStyle = gradient
  c.fillRect(0, 0, 64, 64)
  return new CanvasTexture(canvas)
}

const UP = new Vector3(0, 1, 0)

const disposeAnimator = (animator: NovaAnimator) => animator.dispose()
const disposeDressing = (dressing: { jets: readonly Sprite[]; shadow: Mesh }) => {
  dressing.jets.forEach((jet) => jet.material.dispose())
  dressing.shadow.geometry.dispose()
  ;(dressing.shadow.material as MeshBasicMaterial).dispose()
}

/** Distance (CSS px) under which the approaching cursor makes Nova hop, and the hop's cooldown in seconds. */
const HOP_DISTANCE = 70
const HOP_COOLDOWN = 6
/** Distance (CSS px) at which Nova starts to lean towards the cursor. */
const ATTENTION_DISTANCE = 220

/** The body: brain → clip, living layers on top, face, hover jets, contact shadow, its place on screen. */
function NovaBody({ rig, lookAt, onReady, interactive = true, camera: viewCamera, layer, onStep }: NovaProps & { rig: NovaRig }) {
  const groupRef = useRef<Group>(null)
  const walkSpeed = useMemo(() => measureWalkSpeed(rig), [rig])
  const animator = useMemo(() => new NovaAnimator(rig, (id) => tellNova({ type: 'gestureEnded', id })), [rig])
  const layers = useMemo(() => new LivingLayers(rig), [rig])
  const scratch = useMemo(
    () => ({
      target: new Vector3(),
      head: new Vector3(),
      foot: new Vector3(),
      hips: new Vector3(),
      scale: new Vector3(),
      eye: new Vector3(),
      hand: new Vector3(),
      elbow: new Vector3(),
    }),
    [],
  )
  const approach = useRef({ attention: 0, near: false, hopReady: 0 })
  /** each foot's last height and whether it was going down (a step lands when it stops going down) */
  const feet = useRef([
    { y: 0, falling: false },
    { y: 0, falling: false },
  ])

  const dressing = useMemo(() => {
    glowTexture ??= radialTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']])
    shadowTexture ??= radialTexture([[0, 'rgba(0,0,0,.85)'], [0.45, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,0)']])
    const jet = () =>
      new Sprite(new SpriteMaterial({ map: glowTexture, color: new Color(0.5, 1.7, 2.4), blending: AdditiveBlending, transparent: true, depthWrite: false }))
    const shadow = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, color: 0x000000 }))
    shadow.rotation.x = -Math.PI / 2
    shadow.renderOrder = -1
    return { jets: [jet(), jet()] as const, shadow }
  }, [])

  useEffect(() => {
    trackWindowPointer()
    trackNovaFocus()
    onReady?.(rig.report)
    if (import.meta.env.DEV) Object.assign(window, { __novaRig: rig })
  }, [rig, onReady])

  useLayoutEffect(() => {
    if (layer === undefined) return
    groupRef.current?.traverse((object) => object.layers.set(layer))
  }, [rig, layer])

  useDisposeOnUnmount(animator, disposeAnimator)
  useDisposeOnUnmount(dressing, disposeDressing)

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return
    const camera = viewCamera?.() ?? state.camera
    const dt = Math.min(delta, 0.05)
    const now = novaNow()
    const { brain } = useNovaStore.getState()
    const pose = resolvePose(brain, now)

    animator.play(pose.clip, pose.once, pose.key)
    if (pose.clip === 'walk') animator.setPace(novaSignals.pace > 0 ? clamp(novaSignals.pace / walkSpeed, 0.35, 2.6) : 1)
    layers.beforeMixer()
    animator.update(dt)

    const hasTarget = lookAt ? lookAt(scratch.target, state) : lookTarget(camera, rig, scratch.target, scratch.head, scratch.eye)
    const speech = speechProgress(brain.speech, now)
    const spokenChar = speech.talking && brain.speech ? (brain.speech.text[speech.shown] ?? null) : null
    layers.update(dt, now, {
      pose,
      target: hasTarget ? scratch.target : null,
      spokenChar,
      voice: novaSignals.voice,
      curious: novaSignals.curious,
      attention: approach.current.attention,
    })
    novaSignals.voice = Math.max(0, novaSignals.voice - dt * 3)
    rig.face.apply(layers.face, now)

    // hover jets under the feet, contact shadow under the hips (smaller and lighter while off the ground)
    rig.root.updateMatrixWorld()
    const worldScale = group.getWorldScale(scratch.scale).y
    ;(['LeftFoot', 'RightFoot'] as const).forEach((foot, i) => {
      const jet = dressing.jets[i]
      const node = rig.bones[foot]
      if (!node) return
      group.worldToLocal(node.getWorldPosition(scratch.foot))
      const step = feet.current[i]
      const falling = scratch.foot.y < step.y - 1e-4
      if (step.falling && !falling && pose.clip === 'walk') onStep?.(node.getWorldPosition(scratch.hand))
      step.falling = falling
      step.y = scratch.foot.y
      jet.position.set(scratch.foot.x, scratch.foot.y - 0.055, scratch.foot.z + 0.02)
      const flicker = 0.85 + 0.15 * Math.sin(now * 37 + i * 2)
      jet.material.opacity = layers.hover * flicker
      jet.scale.setScalar(0.09 * (0.7 + 0.3 * layers.hover))
      jet.visible = layers.hover > 0.02
    })
    const hips = rig.bones.Hips ? group.worldToLocal(rig.bones.Hips.getWorldPosition(scratch.hips)) : scratch.hips.set(0, rig.hipsHeight, 0)
    const lift = Math.max(0, layers.hoverHeight, hips.y - rig.hipsHeight)
    dressing.shadow.position.set(hips.x, 0.002, hips.z)
    dressing.shadow.scale.setScalar(0.5 * (1 + lift * 3))
    ;(dressing.shadow.material as MeshBasicMaterial).opacity = 0.55 * (1 - Math.min(0.75, lift * 5))

    // place on screen: the speech bubble hangs above the head, the hit zone covers the body
    const head = rig.bones.Head
    const { head: anchor, box } = frameState.nova
    const shown = isShown(group)
    if (head) {
      // above the top of the head and its antenna
      head.getWorldPosition(scratch.head).addScaledVector(UP, (rig.headOffset * 1.1 + 0.1) * worldScale)
      scratch.head.project(camera)
      group.getWorldPosition(scratch.foot).project(camera)
      anchor.x = (scratch.head.x * 0.5 + 0.5) * state.size.width
      anchor.y = (-scratch.head.y * 0.5 + 0.5) * state.size.height
      anchor.visible = scratch.head.z < 1 && shown
      const bottom = (-scratch.foot.y * 0.5 + 0.5) * state.size.height
      box.height = Math.max(0, bottom - anchor.y)
      box.width = box.height * 0.5
      box.left = ((scratch.head.x + scratch.foot.x) * 0.25 + 0.5) * state.size.width - box.width / 2
      box.top = anchor.y
      box.visible = anchor.visible
    }

    // the presenting hand's fingertip, a little beyond the wrist along the forearm
    const hand = rig.bones.RightHand
    const forearm = rig.bones.RightForeArm
    const { finger } = frameState.nova
    frameState.nova.pointing += ((pose.clip === 'present' && shown ? 1 : 0) - frameState.nova.pointing) * damp(5, dt)
    if (hand && forearm) {
      hand.getWorldPosition(scratch.hand)
      // forearm vector (elbow → wrist); the fingertip is about half a forearm past the wrist
      scratch.elbow.subVectors(scratch.hand, forearm.getWorldPosition(scratch.elbow))
      scratch.hand.addScaledVector(scratch.elbow, 0.45).project(camera)
      finger.x = (scratch.hand.x * 0.5 + 0.5) * state.size.width
      finger.y = (-scratch.hand.y * 0.5 + 0.5) * state.size.height
      finger.visible = shown && scratch.hand.z < 1
    }

    followCursor(approach.current, pose, now, state.size)
  })

  return (
    <group ref={groupRef}>
      <primitive
        object={rig.root}
        onPointerOver={interactive ? () => (novaSignals.curious = true) : undefined}
        onPointerOut={interactive ? () => (novaSignals.curious = false) : undefined}
        onClick={interactive ? nova.poke : undefined}
      />
      <primitive object={dressing.shadow} />
      <primitive object={dressing.jets[0]} />
      <primitive object={dressing.jets[1]} />
    </group>
  )
}

function isShown(object: Object3D): boolean {
  for (let node: Object3D | null = object; node; node = node.parent) if (!node.visible) return false
  return true
}

/**
 * The cursor coming close: Nova leans towards it (attention), and hops once when it gets very close,
 * if it is not busy with something else.
 */
function followCursor(approach: { attention: number; near: boolean; hopReady: number }, pose: NovaPose, now: number, size: { width: number; height: number }) {
  const { box } = frameState.nova
  if (!box.visible || !windowPointer.seen) {
    approach.attention = 0
    approach.near = false
    return
  }
  const x = (windowPointer.x * 0.5 + 0.5) * size.width
  const y = (-windowPointer.y * 0.5 + 0.5) * size.height
  const dx = Math.max(box.left - x, 0, x - box.left - box.width)
  const dy = Math.max(box.top - y, 0, y - box.top - box.height)
  const distance = Math.hypot(dx, dy)
  approach.attention = 1 - smoothstep(0, ATTENTION_DISTANCE, distance)
  const near = distance < HOP_DISTANCE
  if (near && !approach.near && now > approach.hopReady && pose.clip === 'idle') {
    approach.hopReady = now + HOP_COOLDOWN
    nova.gesture('hop')
  }
  // hysteresis: leave the zone clearly before another hop
  approach.near = near || (approach.near && distance < HOP_DISTANCE * 1.6)
}

/**
 * Default gaze: the hovered call to action if there is one, otherwise the visitor. A point on the ray
 * under that screen position, halfway between the camera and Nova, so a centred cursor means
 * "looking at me" and the edges of the screen turn the head.
 */
function lookTarget(camera: Camera, rig: NovaRig, out: Vector3, head: Vector3, eye: Vector3): boolean {
  const node = rig.bones.Head
  if (!node) return false
  node.getWorldPosition(head)
  camera.getWorldPosition(eye)
  const glance = novaSignals.glance && novaNow() < novaSignals.glance.until ? novaSignals.glance : null
  const focus = glance ?? novaSignals.focus
  const x = focus ? (focus.x / window.innerWidth) * 2 - 1 : windowPointer.seen ? windowPointer.x : 0
  const y = focus ? -((focus.y / window.innerHeight) * 2 - 1) : windowPointer.seen ? windowPointer.y : 0
  out.set(x, y, 0.5).unproject(camera)
  out.sub(eye).normalize().multiplyScalar(head.distanceTo(eye) * 0.5).add(eye)
  return true
}
