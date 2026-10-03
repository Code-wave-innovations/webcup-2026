import { useMemo } from 'react'
import { BufferAttribute, PlaneGeometry } from 'three'
import { useCity } from '../CityContext'
import { createWorldMaterial } from '../worldMaterial'
import terrainVert from '../glsl/terrain.vert.glsl?raw'
import terrainFrag from '../glsl/terrain.frag.glsl?raw'

/** Mountains, basin and city floor, with the setting sun's cast shadows baked per vertex. */
export function Terrain() {
  const { data, uniforms, textures } = useCity()

  const geometry = useMemo(() => {
    const { segments, positions, horizon } = data.terrain
    const plane = new PlaneGeometry(2, 2, segments, segments)
    plane.rotateX(-Math.PI / 2)
    plane.setAttribute('position', new BufferAttribute(positions, 3))
    plane.setAttribute('aHorizon', new BufferAttribute(horizon, 1))
    plane.computeVertexNormals()
    plane.computeBoundingSphere()
    return plane
  }, [data])

  const material = useMemo(
    () => createWorldMaterial(uniforms, terrainVert, terrainFrag, { tDetail: { value: textures.rockDetail } }),
    [uniforms, textures],
  )

  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}
