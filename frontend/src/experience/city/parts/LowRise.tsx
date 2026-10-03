import { useMemo } from 'react'
import { BoxGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3, type ShaderMaterial } from 'three'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { useCity } from '../CityContext'
import { LOW_RISE_STRIDE } from '../layout/generateCity'

const UP = new Vector3(0, 1, 0)
const disposeMesh = (mesh: InstancedMesh) => mesh.geometry.dispose()

/**
 * The urban fabric between the towers: hundreds of low blocks in one instanced draw, sharing the towers'
 * material (lit windows at night, roof gardens on one roof in two).
 */
export function LowRise({ material }: { material: ShaderMaterial }) {
  const { data } = useCity()

  const mesh = useMemo(() => {
    const blocks = data.lowRise
    const count = blocks.length / LOW_RISE_STRIDE
    const geometry = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    const instanced = new InstancedMesh(geometry, material, count)
    const seeds = new Float32Array(count)
    const matrix = new Matrix4()
    const rotation = new Quaternion()
    const position = new Vector3()
    const scale = new Vector3()
    for (let n = 0; n < count; n++) {
      const i = n * LOW_RISE_STRIDE
      // sunk a little into the ground so slopes never show a gap under a block
      position.set(blocks[i], blocks[i + 1] - 0.25, blocks[i + 2])
      scale.set(blocks[i + 3], blocks[i + 5] + 0.25, blocks[i + 4])
      instanced.setMatrixAt(n, matrix.compose(position, rotation.setFromAxisAngle(UP, -blocks[i + 6]), scale))
      seeds[n] = blocks[i + 7]
    }
    geometry.setAttribute('aGraine', new InstancedBufferAttribute(seeds, 1))
    instanced.frustumCulled = false
    return instanced
  }, [data, material])
  useDisposeOnUnmount(mesh, disposeMesh)

  return <primitive object={mesh} />
}
