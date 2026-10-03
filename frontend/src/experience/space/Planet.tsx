import { useMemo, type Ref } from 'react'
import { AdditiveBlending, BackSide, Quaternion, ShaderMaterial, type Group, type IUniform, type Mesh, type Texture, type Vector3 } from 'three'
import planetVert from './glsl/planet.vert.glsl?raw'
import planetFrag from './glsl/planet.frag.glsl?raw'
import cloudsFrag from './glsl/clouds.frag.glsl?raw'
import atmosphereFrag from './glsl/atmosphere.frag.glsl?raw'
import { CITY_FACING, CITY_ON_PLANET, PLANET_RADIUS } from './spaceConfig'

export interface PlanetUniforms {
  [name: string]: IUniform
  tSol: IUniform<Texture>
  tRelief: IUniform<Texture>
  uSoleilE: IUniform<Vector3>
  uTemps: IUniform<number>
  uAlerte: IUniform<number>
}

interface PlanetProps {
  uniforms: PlanetUniforms
  groupRef: Ref<Group>
  surfaceRef: Ref<Mesh>
  cloudsRef: Ref<Mesh>
}

/** Terra Nova from space: lit ground and city lights, a cloud veil, and the atmosphere rim. */
export function Planet({ uniforms, groupRef, surfaceRef, cloudsRef }: PlanetProps) {
  const orientation = useMemo(() => new Quaternion().setFromUnitVectors(CITY_ON_PLANET, CITY_FACING), [])
  const materials = useMemo(
    () => ({
      surface: new ShaderMaterial({ uniforms, vertexShader: planetVert, fragmentShader: planetFrag }),
      clouds: new ShaderMaterial({ uniforms, vertexShader: planetVert, fragmentShader: cloudsFrag, transparent: true, depthWrite: false }),
      atmosphere: new ShaderMaterial({
        uniforms,
        vertexShader: planetVert,
        fragmentShader: atmosphereFrag,
        side: BackSide,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    }),
    [uniforms],
  )

  return (
    <group ref={groupRef}>
      <mesh ref={surfaceRef} quaternion={orientation} material={materials.surface}>
        <sphereGeometry args={[PLANET_RADIUS, 160, 110]} />
      </mesh>
      <mesh ref={cloudsRef} quaternion={orientation} material={materials.clouds}>
        <sphereGeometry args={[PLANET_RADIUS * 1.012, 96, 64]} />
      </mesh>
      <mesh material={materials.atmosphere}>
        <sphereGeometry args={[PLANET_RADIUS * 1.0867, 96, 64]} />
      </mesh>
    </group>
  )
}
