import { ShaderMaterial, Vector3, type ShaderMaterialParameters, type IUniform } from 'three'
import valueNoise from '../glsl/valueNoise.glsl?raw'
import world from './glsl/world.glsl?raw'

/** Uniforms every surface of the city reads: sun, time of day, alert, haze, reflection clip plane. */
export interface WorldUniforms {
  [name: string]: IUniform
  uSoleil: IUniform<Vector3>
  uAstre: IUniform<Vector3>
  /** sky darkening 0 → 1 */
  uHeure: IUniform<number>
  /** artificial lights 0 → 1 */
  uNuit: IUniform<number>
  uTemps: IUniform<number>
  uAlerte: IUniform<number>
  uBrume: IUniform<number>
  /** fragments below this height are discarded (only above the water in the reflection pass) */
  uCoupe: IUniform<number>
  /** height under which tower bases are in the mountains' shadow */
  uOmbreY: IUniform<number>
}

export function createWorldUniforms(): WorldUniforms {
  return {
    uSoleil: { value: new Vector3(0, 0.1, -1) },
    uAstre: { value: new Vector3(-0.285, 0.375, -0.88).normalize() },
    uHeure: { value: 0 },
    uNuit: { value: 0 },
    uTemps: { value: 0 },
    uAlerte: { value: 0 },
    uBrume: { value: 0.0016 },
    uCoupe: { value: -1e6 },
    uOmbreY: { value: 0 },
  }
}

/**
 * A city surface material: the shared world chunk (sky, haze, sun colour) is prepended to `fragment`,
 * and the world uniforms are shared by reference so one update reaches every material.
 */
export function createWorldMaterial(
  uniforms: WorldUniforms,
  vertex: string,
  fragment: string,
  extra: Record<string, IUniform> = {},
  options: Omit<ShaderMaterialParameters, 'uniforms' | 'vertexShader' | 'fragmentShader'> = {},
): ShaderMaterial {
  return new ShaderMaterial({
    ...options,
    uniforms: { ...uniforms, ...extra },
    vertexShader: vertex,
    fragmentShader: `${valueNoise}\n${world}\n${fragment}`,
  })
}
