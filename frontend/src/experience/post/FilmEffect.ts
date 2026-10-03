import { Effect, EffectAttribute, ShaderPass } from 'postprocessing'
import {
  Color,
  HalfFloatType,
  LinearFilter,
  ShaderMaterial,
  Uniform,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type TextureDataType,
  type WebGLRenderer,
} from 'three'
import valueNoise from '../glsl/valueNoise.glsl?raw'
import fullscreenVert from '../glsl/fullscreen.vert.glsl?raw'
import filmFrag from './glsl/film.frag.glsl?raw'
import thresholdFrag from './glsl/threshold.frag.glsl?raw'
import blurFrag from './glsl/blur.frag.glsl?raw'

/** Values the stages drive every frame (exposure, entry plasma, veil…). */
export interface FilmControls {
  time: number
  exposure: number
  halo: number
  /** radial speed blur towards `center` (0 = off) */
  speedBlur: number
  plasma: number
  /** full-screen fade: 0 = scene, 1 = `veilColor` */
  veil: number
  veilColor: Color
  /** speed blur focus, in UV */
  center: Vector2
  /** rack focus: 0 = all sharp, 1 = everything outside `focus` thrown out of focus */
  focusPull: number
  /** what stays sharp: centre in UV and radius in screen heights */
  focus: Vector3
  /** crepuscular rays streaming from the sun (0 = off) */
  rays: number
  /** the sun on screen, in UV (may lie outside the frame) */
  sun: Vector2
}

export function createFilmControls(): FilmControls {
  return { time: 0, exposure: 1, halo: 1, speedBlur: 0, plasma: 0, veil: 1, veilColor: new Color(0, 0, 0), center: new Vector2(0.5, 0.5), focusPull: 0, focus: new Vector3(0.5, 0.5, 0.2), rays: 0, sun: new Vector2(0.5, 0.5) }
}

/**
 * The prototype's film look as a single postprocessing effect: it renders its own halo chain
 * (highlight threshold, gaussian blurs at 1/4 and 1/8, horizontal anamorphic streak) in `update`,
 * then grades, tone maps and gamma-encodes in one fullscreen pass.
 */
export class FilmEffect extends Effect {
  private readonly hdr: boolean
  private readonly thresholdPass: ShaderPass
  private readonly blurPass: ShaderPass
  private readonly blurMaterial: ShaderMaterial
  private readonly thresholdMaterial: ShaderMaterial
  private readonly fullSize = new Vector2(2, 2)
  private quarterA!: WebGLRenderTarget
  private quarterB!: WebGLRenderTarget
  private eighthA!: WebGLRenderTarget
  private eighthB!: WebGLRenderTarget

  constructor(hdr: boolean) {
    super('FilmEffect', `${valueNoise}\n${filmFrag}`, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['tH1', new Uniform(null)],
        ['tH2', new Uniform(null)],
        ['tTrait', new Uniform(null)],
        ['uTemps', new Uniform(0)],
        ['uExpo', new Uniform(1)],
        ['uHalo', new Uniform(1)],
        ['uVitesse', new Uniform(0)],
        ['uPlasma', new Uniform(0)],
        ['uVoile', new Uniform(1)],
        ['uVoileC', new Uniform(new Color(0, 0, 0))],
        ['uGrain', new Uniform(0.034)],
        ['uCentre', new Uniform(new Vector2(0.5, 0.5))],
        ['uLdr', new Uniform(hdr ? 0 : 1)],
        ['uMap', new Uniform(0)],
        ['uRayons', new Uniform(0)],
        ['uSoleilUv', new Uniform(new Vector2(0.5, 0.5))],
        ['uNet', new Uniform(new Vector3(0.5, 0.5, 0.2))],
      ]),
    })
    this.hdr = hdr
    this.thresholdMaterial = new ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: thresholdFrag,
      uniforms: { inputBuffer: { value: null }, uPas: { value: new Vector2() }, uSeuil: { value: hdr ? 1.0 : 0.74 } },
      depthTest: false,
      depthWrite: false,
    })
    this.blurMaterial = new ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: blurFrag,
      uniforms: { inputBuffer: { value: null }, uPas: { value: new Vector2() } },
      depthTest: false,
      depthWrite: false,
    })
    this.thresholdPass = new ShaderPass(this.thresholdMaterial)
    this.blurPass = new ShaderPass(this.blurMaterial)
    this.allocate(2, 2)
  }

  apply(controls: FilmControls): void {
    const u = this.uniforms
    u.get('uTemps')!.value = controls.time
    u.get('uExpo')!.value = controls.exposure
    u.get('uHalo')!.value = controls.halo
    u.get('uVitesse')!.value = controls.speedBlur
    u.get('uPlasma')!.value = controls.plasma
    u.get('uVoile')!.value = controls.veil
    ;(u.get('uVoileC')!.value as Color).copy(controls.veilColor)
    ;(u.get('uCentre')!.value as Vector2).copy(controls.center)
    u.get('uMap')!.value = controls.focusPull
    u.get('uRayons')!.value = controls.rays
    ;(u.get('uSoleilUv')!.value as Vector2).copy(controls.sun)
    ;(u.get('uNet')!.value as Vector3).copy(controls.focus)
  }

  override update(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget): void {
    const { x: width, y: height } = this.fullSize
    this.thresholdMaterial.uniforms.uPas.value.set(1 / width, 1 / height)
    this.thresholdPass.render(renderer, inputBuffer, this.quarterA)
    this.blur(renderer, this.quarterA, this.quarterB, 4, 0)
    this.blur(renderer, this.quarterB, this.quarterA, 0, 4)
    this.blur(renderer, this.quarterA, this.eighthB, 8, 0)
    this.blur(renderer, this.eighthB, this.eighthA, 0, 8)
    this.blur(renderer, this.eighthA, this.eighthB, 26, 0)
    this.blur(renderer, this.eighthB, this.quarterB, 64, 0)
    this.uniforms.get('tH1')!.value = this.quarterA.texture
    this.uniforms.get('tH2')!.value = this.eighthA.texture
    this.uniforms.get('tTrait')!.value = this.quarterB.texture
  }

  override setSize(width: number, height: number): void {
    this.allocate(width, height)
  }

  override dispose(): void {
    this.disposeTargets()
    this.thresholdMaterial.dispose()
    this.blurMaterial.dispose()
    super.dispose()
  }

  /** Blur offsets are expressed in full-resolution pixels, whatever the size of the target. */
  private blur(renderer: WebGLRenderer, source: WebGLRenderTarget, target: WebGLRenderTarget, px: number, py: number) {
    this.blurMaterial.uniforms.uPas.value.set(px / this.fullSize.x, py / this.fullSize.y)
    this.blurPass.render(renderer, source, target)
  }

  private allocate(width: number, height: number) {
    this.disposeTargets()
    this.fullSize.set(Math.max(2, width), Math.max(2, height))
    const type: TextureDataType = this.hdr ? HalfFloatType : UnsignedByteType
    const target = (divisor: number) =>
      new WebGLRenderTarget(Math.max(2, Math.round(width / divisor)), Math.max(2, Math.round(height / divisor)), {
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        type,
        depthBuffer: false,
        stencilBuffer: false,
      })
    this.quarterA = target(4)
    this.quarterB = target(4)
    this.eighthA = target(8)
    this.eighthB = target(8)
  }

  private disposeTargets() {
    this.quarterA?.dispose()
    this.quarterB?.dispose()
    this.eighthA?.dispose()
    this.eighthB?.dispose()
  }
}
