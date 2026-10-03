import { Color, MeshStandardMaterial, Vector4, type IUniform, type Material, type Mesh, type Object3D } from 'three'
import glowShader from './glowFace.glsl?raw'
import type { FaceMode } from '../rig/rigContract'
import type { FaceState } from './faceState'
import { createVisorMaterial, type VisorUniforms } from './visorMaterial'

/** Draws a FaceState on a model, whichever way that model can show eyes. */
export interface FaceDriver {
  readonly mode: FaceMode
  apply(face: FaceState, time: number): void
  dispose(): void
}

const ICE = new Color(0.55, 1.9, 2.6)
const ALARM = new Color(2.8, 0.42, 0.3)

/** The face as light on a visor screen (the stand-in, or a model with a `Face` / `Visor` mesh with 0-1 UVs). */
export class VisorFaceDriver implements FaceDriver {
  readonly mode = 'visor' as const
  private readonly uniforms: VisorUniforms
  private readonly material: Material
  private readonly previous: Material | Material[]
  private readonly mesh: Mesh

  constructor(mesh: Mesh, aspect: number) {
    const visor = createVisorMaterial(aspect)
    this.mesh = mesh
    this.previous = mesh.material
    this.material = visor.material
    this.uniforms = visor.uniforms
    mesh.material = visor.material
  }

  apply(face: FaceState, time: number): void {
    const u = this.uniforms
    u.uFaceTime.value = time
    u.uEyeOpen.value.set(face.eyeOpen[0], face.eyeOpen[1])
    u.uEyeLook.value.set(face.look.x, face.look.y)
    u.uEyeScale.value = face.surprised
    u.uHappy.value = face.happy
    u.uSad.value = face.sad
    u.uAngry.value = face.angry
    u.uMouthOpen.value = face.mouth
    u.uSmile.value = face.smile
    u.uThinking.value = face.thinking
    u.uListening.value = face.listening
    u.uVoice.value = face.voice
    u.uFaceColor.value.copy(ICE).lerp(ALARM, face.alert)
  }

  dispose(): void {
    this.mesh.material = this.previous
    this.material.dispose()
  }
}

interface MorphChannel {
  mesh: Mesh
  index: number
}

/** Morph targets of the model: `Blink` (required), optional `Happy`, `Sad`, `Surprised`, `Angry`. */
export class MorphFaceDriver implements FaceDriver {
  readonly mode = 'morphs' as const
  private readonly channels: Record<'blink' | 'happy' | 'sad' | 'surprised' | 'angry', MorphChannel[]>

  constructor(meshes: Mesh[]) {
    const find = (pattern: RegExp): MorphChannel[] =>
      meshes.flatMap((mesh) =>
        Object.entries(mesh.morphTargetDictionary ?? {})
          .filter(([name]) => pattern.test(name))
          .map(([, index]) => ({ mesh, index })),
      )
    this.channels = {
      blink: find(/blink|eyes?_?closed/i),
      happy: find(/happy|smile|joy/i),
      sad: find(/sad/i),
      surprised: find(/surpris/i),
      angry: find(/angry|mad/i),
    }
  }

  static detect(meshes: Mesh[]): boolean {
    return meshes.some((m) => Object.keys(m.morphTargetDictionary ?? {}).some((name) => /blink|eyes?_?closed/i.test(name)))
  }

  apply(face: FaceState): void {
    const set = (channels: MorphChannel[], value: number) => {
      for (const { mesh, index } of channels) if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = value
    }
    set(this.channels.blink, 1 - Math.min(face.eyeOpen[0], face.eyeOpen[1]))
    set(this.channels.happy, face.happy)
    set(this.channels.sad, face.sad)
    set(this.channels.surprised, face.surprised)
    set(this.channels.angry, face.angry)
  }

  dispose(): void {}
}

/** Separate eye meshes (`EyeL`, `EyeR`): blinks squash them, the gaze nudges them. */
export class EyeMeshFaceDriver implements FaceDriver {
  readonly mode = 'eyes' as const
  private readonly eyes: Array<{ node: Object3D; scaleY: number; x: number; y: number }>

  constructor(left: Object3D, right: Object3D) {
    this.eyes = [left, right].map((node) => ({ node, scaleY: node.scale.y, x: node.position.x, y: node.position.y }))
  }

  apply(face: FaceState): void {
    this.eyes.forEach((eye, i) => {
      eye.node.scale.y = eye.scaleY * Math.max(0.08, face.eyeOpen[i])
      eye.node.position.x = eye.x + face.look.x * 0.004
      eye.node.position.y = eye.y + face.look.y * 0.003
    })
  }

  dispose(): void {}
}

const GOLD = new Vector4(1, 0.72, 0.32, 0)
const SORROW = new Vector4(0.3, 0.4, 1, 0)
const RED = new Vector4(1, 0.14, 0.08, 0)

interface GlowUniforms {
  [name: string]: IUniform
  uGlowTime: IUniform<number>
  uHelmetGlow: IUniform<Vector4>
  uHelmetLevel: IUniform<number>
  uBodyGlow: IUniform<Vector4>
  uBodyLevel: IUniform<number>
  uCoreGlow: IUniform<Vector4>
  uCoreLevel: IUniform<number>
  uScan: IUniform<number>
}

/**
 * Faceless helmet (Nova's delivered model): the armour lines carry the feelings. The helmet lines blink,
 * pulse with the voice, warm up with joy, fade with sadness, turn red on a refusal or an alert, and a band
 * of light sweeps them while thinking; the chest core beats and answers what Nova hears.
 */
export class GlowFaceDriver implements FaceDriver {
  readonly mode = 'glow' as const
  private readonly uniforms: GlowUniforms
  private readonly patched: Array<{ mesh: Mesh; previous: Material | Material[]; material: Material }> = []

  constructor(meshes: Mesh[]) {
    this.uniforms = {
      uGlowTime: { value: 0 },
      uHelmetGlow: { value: new Vector4(1, 1, 1, 0) },
      uHelmetLevel: { value: 1 },
      uBodyGlow: { value: new Vector4(1, 1, 1, 0) },
      uBodyLevel: { value: 0.35 },
      uCoreGlow: { value: new Vector4(1, 1, 1, 0) },
      uCoreLevel: { value: 1 },
      uScan: { value: 0 },
    }
    for (const mesh of meshes) {
      if (!mesh.geometry.getAttribute('_novazone') || !(mesh.material instanceof MeshStandardMaterial)) continue
      const material = mesh.material.clone()
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, this.uniforms)
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float _novazone;\nvarying float vNovaZone;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvNovaZone = _novazone;')
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\n${glowShader}`)
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += novaGlow(diffuseColor.rgb);')
      }
      material.customProgramCacheKey = () => 'nova-glow'
      this.patched.push({ mesh, previous: mesh.material, material })
      mesh.material = material
    }
  }

  static detect(meshes: Mesh[]): boolean {
    return meshes.some((m) => !!m.geometry.getAttribute('_novazone'))
  }

  apply(face: FaceState, time: number): void {
    const u = this.uniforms
    const open = Math.min(face.eyeOpen[0], face.eyeOpen[1])
    const red = Math.max(face.alert, face.angry * 0.9)
    const pulse = face.alert > 0.05 ? 0.75 + 0.25 * Math.sin(time * 7) : 1
    u.uGlowTime.value = time
    // blinks dim the helmet, speech makes it pulse, surprise flares it, sadness fades it
    u.uHelmetLevel.value = (0.18 + 0.82 * open) * (1 + face.mouth * 1.1) * (1 + face.surprised * 0.7 + face.happy * 0.35) * (1 - face.sad * 0.55) * pulse
    tint(u.uHelmetGlow.value, face.happy * 0.5, face.sad * 0.6, red)
    u.uScan.value = face.thinking
    u.uBodyLevel.value = 0.32 + 0.3 * face.alert * (0.5 + 0.5 * Math.sin(time * 7))
    tint(u.uBodyGlow.value, 0, 0, face.alert)
    const beat = 0.85 + 0.15 * Math.pow(Math.max(0, Math.sin(time * 2.4)), 6)
    u.uCoreLevel.value = beat * (1 + face.voice * face.listening * 1.6 + face.mouth * 0.4) * (1 - face.sad * 0.4)
    tint(u.uCoreGlow.value, face.happy * 0.35, face.sad * 0.5, face.alert)
  }

  dispose(): void {
    for (const { mesh, previous, material } of this.patched) {
      mesh.material = previous
      material.dispose()
    }
  }
}

/** Blends the tint towards gold (joy), blue (sadness) and red (refusal, alert); alpha = how much it replaces the native colours. */
function tint(out: Vector4, joy: number, sorrow: number, alarm: number) {
  out.set(1, 1, 1, 0)
  const mixIn = (target: Vector4, amount: number) => {
    if (amount <= 0.001) return
    const k = amount / Math.max(out.w + amount, 1e-4)
    out.x += (target.x - out.x) * k
    out.y += (target.y - out.y) * k
    out.z += (target.z - out.z) * k
    out.w = Math.min(1, out.w + amount)
  }
  mixIn(GOLD, joy)
  mixIn(SORROW, sorrow)
  mixIn(RED, alarm * 1.2)
}

export class NoFaceDriver implements FaceDriver {
  readonly mode = 'none' as const
  apply(): void {}
  dispose(): void {}
}
