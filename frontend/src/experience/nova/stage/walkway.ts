import { AdditiveBlending, Color, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3, type IUniform } from 'three'
import walkwayVert from './glsl/walkway.vert.glsl?raw'
import walkwayFrag from './glsl/walkway.frag.glsl?raw'

const STEPS = 12

interface WalkwayUniforms {
  [name: string]: IUniform
  uTime: IUniform<number>
  uOpacity: IUniform<number>
  uCenter: IUniform<number>
  uHalf: IUniform<Vector2>
  uNovaX: IUniform<number>
  uActivity: IUniform<number>
  uSteps: IUniform<Vector3[]>
  uColor: IUniform<Color>
}

export interface Walkway {
  mesh: Mesh
  uniforms: WalkwayUniforms
  /** lights a footprint at (x, z) on the floor, in Nova heights, at `time` (the walkway's clock) */
  step(x: number, z: number, time: number): void
  dispose(): void
}

/** Nova's holographic walkway in the city: one additive draw, footprints recycled from a pool of 12. */
export function createWalkway(): Walkway {
  const uniforms: WalkwayUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uCenter: { value: 0 },
    uHalf: { value: new Vector2(1, 0.42) },
    uNovaX: { value: 0 },
    uActivity: { value: 0 },
    uSteps: { value: Array.from({ length: STEPS }, () => new Vector3(0, 0, -100)) },
    uColor: { value: new Color(0.56, 0.91, 1).multiplyScalar(1.6) },
  }
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: walkwayVert,
    fragmentShader: walkwayFrag,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  const mesh = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material)
  // the vertices are placed by uniforms: the bounding sphere does not describe them
  mesh.frustumCulled = false
  mesh.renderOrder = -2
  let next = 0
  return {
    mesh,
    uniforms,
    step(x, z, time) {
      uniforms.uSteps.value[next].set(x, z, time)
      next = (next + 1) % STEPS
    },
    dispose() {
      mesh.geometry.dispose()
      material.dispose()
    },
  }
}
