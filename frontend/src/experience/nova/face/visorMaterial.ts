import { Color, MeshPhysicalMaterial, Vector2, type IUniform } from 'three'
import faceShader from './visorFace.glsl?raw'

export interface VisorUniforms {
  [name: string]: IUniform
  uFaceTime: IUniform<number>
  uFaceAspect: IUniform<number>
  uFaceColor: IUniform<Color>
  uFacePower: IUniform<number>
  uEyeOpen: IUniform<Vector2>
  uEyeLook: IUniform<Vector2>
  uEyeScale: IUniform<number>
  uHappy: IUniform<number>
  uSad: IUniform<number>
  uAngry: IUniform<number>
  uMouthOpen: IUniform<number>
  uSmile: IUniform<number>
  uThinking: IUniform<number>
  uListening: IUniform<number>
  uVoice: IUniform<number>
}

/**
 * Black glass that reflects the world (PBR, clearcoat) with Nova's face drawn as emitted light:
 * the face function is injected into the physical material's emissive term.
 */
export function createVisorMaterial(aspect: number): { material: MeshPhysicalMaterial; uniforms: VisorUniforms } {
  const uniforms: VisorUniforms = {
    uFaceTime: { value: 0 },
    uFaceAspect: { value: aspect },
    uFaceColor: { value: new Color(0.55, 1.9, 2.6) },
    uFacePower: { value: 1 },
    uEyeOpen: { value: new Vector2(1, 1) },
    uEyeLook: { value: new Vector2() },
    uEyeScale: { value: 0 },
    uHappy: { value: 0 },
    uSad: { value: 0 },
    uAngry: { value: 0 },
    uMouthOpen: { value: 0 },
    uSmile: { value: 0 },
    uThinking: { value: 0 },
    uListening: { value: 0 },
    uVoice: { value: 0 },
  }
  const material = new MeshPhysicalMaterial({
    color: new Color(0.004, 0.006, 0.01),
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.3,
  })
  material.defines = { ...material.defines, USE_UV: '' }
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${faceShader}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += novaFace(vUv);')
  }
  material.customProgramCacheKey = () => 'nova-visor'
  return { material, uniforms }
}
