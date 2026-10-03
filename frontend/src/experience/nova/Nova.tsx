import { useGLTF } from '@react-three/drei'
import { useFrame, type RootState } from '@react-three/fiber'
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { AdditiveBlending, CanvasTexture, Color, Mesh, MeshBasicMaterial, PlaneGeometry, Sprite, SpriteMaterial, Vector3, type Group } from 'three'
import { useDisposeOnUnmount } from '../../hooks/useDisposeOnUnmount'
import { frameState } from '../director/frameState'
import { trackWindowPointer, windowPointer } from '../input/windowPointer'
import { LivingLayers } from './animation/LivingLayers'
import { NovaAnimator } from './animation/NovaAnimator'
import { resolvePose, speechProgress } from './behavior/novaBrain'
import { nova, novaNow, novaSignals, tellNova, useNovaStore } from './behavior/novaStore'
import { pickQuip } from './behavior/quips'
import { createGltfRig, createStandInRig, type NovaRig } from './rig/createRig'
import type { RigReport } from './rig/rigContract'

export interface NovaProps {
  /** writes the world point Nova should look at and returns true; by default it follows the cursor */
  lookAt?: (out: Vector3, state: RootState) => boolean
  /** called once the model is ready (the test bench lists what was found in it) */
  onReady?: (report: RigReport) => void
  /** the visitor can hover and click Nova */
  interactive?: boolean
}

/** Nova from a GLB when one is given, the procedural stand-in otherwise (also while loading, or if loading fails). */
export function Nova({ modelUrl, ...props }: NovaProps & { modelUrl?: string | null }) {
  const fallback = <StandInNova {...props} />
  return (
    <ModelBoundary key={modelUrl ?? 'stand-in'} fallback={fallback}>
      <Suspense fallback={fallback}>{modelUrl ? <GltfNova url={modelUrl} {...props} /> : fallback}</Suspense>
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

/** The body: brain → clip, living layers on top, face, hover jets, contact shadow, head anchor for the bubble. */
function NovaBody({ rig, lookAt, onReady, interactive = true }: NovaProps & { rig: NovaRig }) {
  const groupRef = useRef<Group>(null)
  const curious = useRef(false)
  const animator = useMemo(() => new NovaAnimator(rig, (id) => tellNova({ type: 'gestureEnded', id })), [rig])
  const layers = useMemo(() => new LivingLayers(rig), [rig])
  const scratch = useMemo(() => ({ target: new Vector3(), head: new Vector3(), foot: new Vector3(), hips: new Vector3(), scale: new Vector3() }), [])

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
    onReady?.(rig.report)
    if (import.meta.env.DEV) Object.assign(window, { __novaRig: rig })
  }, [rig, onReady])

  useDisposeOnUnmount(animator, disposeAnimator)
  useDisposeOnUnmount(dressing, disposeDressing)

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return
    const dt = Math.min(delta, 0.05)
    const now = novaNow()
    const { brain } = useNovaStore.getState()
    const pose = resolvePose(brain, now)

    animator.play(pose.clip, pose.once, pose.key)
    layers.beforeMixer()
    animator.update(dt)

    const hasTarget = lookAt ? lookAt(scratch.target, state) : cursorTarget(state, rig, scratch.target, scratch.head)
    const speech = speechProgress(brain.speech, now)
    const spokenChar = speech.talking && brain.speech ? (brain.speech.text[speech.shown] ?? null) : null
    layers.update(dt, now, { pose, target: hasTarget ? scratch.target : null, spokenChar, voice: novaSignals.voice, curious: curious.current })
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

    // the speech bubble hangs above the head
    const head = rig.bones.Head
    const anchor = frameState.nova.head
    if (head) {
      // above the top of the head and its antenna
      head.getWorldPosition(scratch.head).addScaledVector(UP, (rig.headOffset * 1.1 + 0.1) * worldScale)
      scratch.head.project(state.camera)
      anchor.x = (scratch.head.x * 0.5 + 0.5) * state.size.width
      anchor.y = (-scratch.head.y * 0.5 + 0.5) * state.size.height
      anchor.visible = scratch.head.z < 1 && group.visible
    }
  })

  return (
    <group ref={groupRef}>
      <primitive
        object={rig.root}
        onPointerOver={interactive ? () => (curious.current = true) : undefined}
        onPointerOut={interactive ? () => (curious.current = false) : undefined}
        onClick={
          interactive
            ? () => {
                nova.gesture('poked')
                nova.say(pickQuip(), 'happy')
              }
            : undefined
        }
      />
      <primitive object={dressing.shadow} />
      <primitive object={dressing.jets[0]} />
      <primitive object={dressing.jets[1]} />
    </group>
  )
}

/**
 * Default gaze: the visitor. A point on the ray under the cursor, halfway between the camera and Nova,
 * so a centred cursor means "looking at me" and the edges of the screen turn the head.
 */
function cursorTarget(state: RootState, rig: NovaRig, out: Vector3, head: Vector3): boolean {
  const camera = state.camera
  const node = rig.bones.Head
  if (!node) return false
  node.getWorldPosition(head)
  const distance = head.distanceTo(camera.position)
  out.set(windowPointer.seen ? windowPointer.x : 0, windowPointer.seen ? windowPointer.y : 0, 0.5).unproject(camera)
  out.sub(camera.position).normalize().multiplyScalar(distance * 0.5).add(camera.position)
  return true
}
