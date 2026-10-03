import { useMemo } from 'react'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { useCity } from '../CityContext'
import { createTreeMeshes, disposeTreeMeshes, type TreeSpec } from '../flora/trees'
import { TREE_STRIDE } from '../layout/generateCity'

/** The terraced gardens around the domes and the avenue's trees: trunks and leafy crowns swaying, two draws. */
export function Greenery() {
  const { data, uniforms } = useCity()

  const meshes = useMemo(() => {
    const trees = data.trees
    const specs: TreeSpec[] = []
    for (let i = 0; i < trees.length; i += TREE_STRIDE) {
      const size = trees[i + 3]
      const seed = trees[i + 4]
      // the generated size was the crown's width: a tree is about 1.6 times taller than wide
      specs.push({ x: trees[i], y: trees[i + 1], z: trees[i + 2], height: size * (1.45 + seed * 0.45), seed, conifer: fract(seed * 3.7) < 0.22 })
    }
    return createTreeMeshes(uniforms, specs)
  }, [data, uniforms])
  useDisposeOnUnmount(meshes, disposeTreeMeshes)

  return (
    <>
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </>
  )
}

const fract = (v: number) => v - Math.floor(v)
