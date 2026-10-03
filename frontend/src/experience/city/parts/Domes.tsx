import { useMemo } from 'react'
import { SphereGeometry, type ShaderMaterial } from 'three'
import { DOME_BASE, DOME_FLATTEN, DOMES } from '../cityConfig'
import { useCity } from '../CityContext'
import { createWorldMaterial } from '../worldMaterial'
import towerVert from '../glsl/tower.vert.glsl?raw'
import domeFrag from '../glsl/dome.frag.glsl?raw'

/** Glass domes over a lattice, warm inside (green for the greenhouse), on dark plinths. */
export function Domes({ plinthMaterial }: { plinthMaterial: ShaderMaterial }) {
  const { uniforms } = useCity()
  const hemisphere = useMemo(() => new SphereGeometry(1, 56, 22, 0, Math.PI * 2, 0, Math.PI / 2), [])
  const materials = useMemo(
    () => DOMES.map((dome) => createWorldMaterial(uniforms, towerVert, domeFrag, { uChaleur: { value: dome.greenhouse ? 1 : 0 } })),
    [uniforms],
  )

  return (
    <>
      {DOMES.map((dome, i) => (
        <group key={dome.id} position={[dome.x, 0, dome.z]}>
          <mesh geometry={hemisphere} material={materials[i]} position-y={DOME_BASE} scale={[dome.r, dome.r * DOME_FLATTEN, dome.r]} />
          <mesh material={plinthMaterial} position-y={0.75}>
            <cylinderGeometry args={[dome.r * 1.02, dome.r * 1.07, 1.5, 44, 1, true]} />
          </mesh>
        </group>
      ))}
    </>
  )
}
