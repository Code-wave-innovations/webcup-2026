import { useMemo } from 'react'
import { BufferAttribute, DataTexture, LinearFilter, PlaneGeometry, Vector3 } from 'three'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { GROUND_MAP } from '../layout/cityGround'
import { useCity } from '../CityContext'
import { createWorldMaterial } from '../worldMaterial'
import terrainVert from '../glsl/terrain.vert.glsl?raw'
import terrainFrag from '../glsl/terrain.frag.glsl?raw'

const disposeTexture = (texture: DataTexture) => texture.dispose()

/** Mountains, basin and city floor, with the setting sun's cast shadows baked per vertex and the city's own shadows. */
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

  // the city's soft shadows on the ground, baked with the layout
  const shadows = useMemo(() => {
    const texture = new DataTexture(data.groundShadows, GROUND_MAP.size, GROUND_MAP.size)
    texture.magFilter = texture.minFilter = LinearFilter
    texture.needsUpdate = true
    return texture
  }, [data])
  useDisposeOnUnmount(shadows, disposeTexture)

  const material = useMemo(
    () =>
      createWorldMaterial(uniforms, terrainVert, terrainFrag, {
        tDetail: { value: textures.rockDetail },
        tSolVille: { value: shadows },
        uSolVille: { value: new Vector3(GROUND_MAP.centerX, GROUND_MAP.centerZ, GROUND_MAP.half) },
      }),
    [uniforms, textures, shadows],
  )

  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}
