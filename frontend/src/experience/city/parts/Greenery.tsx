import { useMemo } from 'react'
import { IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { useCity } from '../CityContext'
import { TREE_STRIDE } from '../layout/generateCity'
import { createWorldMaterial } from '../worldMaterial'
import treeVert from '../glsl/tree.vert.glsl?raw'
import treeFrag from '../glsl/tree.frag.glsl?raw'

const disposeMesh = (mesh: InstancedMesh) => {
  mesh.geometry.dispose()
  ;(mesh.material as { dispose(): void }).dispose()
}

/** The terraced gardens around the domes and the avenue's trees: low-poly crowns swaying in one draw. */
export function Greenery() {
  const { data, uniforms } = useCity()

  const mesh = useMemo(() => {
    const trees = data.trees
    const count = trees.length / TREE_STRIDE
    const geometry = new IcosahedronGeometry(0.5, 1)
    const instanced = new InstancedMesh(geometry, createWorldMaterial(uniforms, treeVert, treeFrag), count)
    const seeds = new Float32Array(count)
    const matrix = new Matrix4()
    const rotation = new Quaternion()
    const position = new Vector3()
    const scale = new Vector3()
    for (let n = 0; n < count; n++) {
      const i = n * TREE_STRIDE
      const size = trees[i + 3]
      const seed = trees[i + 4]
      const tall = 1.15 + seed * 0.5
      position.set(trees[i], trees[i + 1] + size * tall * 0.5 + 0.15, trees[i + 2])
      scale.set(size, size * tall, size)
      instanced.setMatrixAt(n, matrix.compose(position, rotation.identity(), scale))
      seeds[n] = seed
    }
    geometry.setAttribute('aGraine', new InstancedBufferAttribute(seeds, 1))
    instanced.frustumCulled = false
    return instanced
  }, [data, uniforms])
  useDisposeOnUnmount(mesh, disposeMesh)

  return <primitive object={mesh} />
}
