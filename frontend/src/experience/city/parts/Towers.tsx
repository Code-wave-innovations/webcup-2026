import { useMemo } from 'react'
import { InstancedBufferAttribute, InstancedMesh, LatheGeometry, Matrix4, Quaternion, Vector2, Vector3, type ShaderMaterial } from 'three'
import { useCity } from '../CityContext'
import type { Tower } from '../layout/generateCity'

type Profile = ReadonlyArray<readonly [radius: number, height: number]>

/** Lathe silhouettes (unit height): stepped spire, tapered tower, flat-topped block. */
const PROFILES: readonly Profile[] = [
  [[0.5, 0], [0.5, 0.04], [0.34, 0.07], [0.3, 0.52], [0.4, 0.535], [0.4, 0.56], [0.24, 0.58], [0.2, 0.8], [0.27, 0.81], [0.27, 0.825], [0.08, 0.86], [0.03, 1]],
  [[0.42, 0], [0.46, 0.3], [0.38, 0.62], [0.44, 0.63], [0.44, 0.66], [0.2, 0.7], [0.12, 0.92], [0.02, 1]],
  [[0.5, 0], [0.5, 0.72], [0.42, 0.74], [0.42, 0.95], [0.12, 1]],
]
const SEGMENTS = [14, 12, 8]
const UP = new Vector3(0, 1, 0)

/** One instanced draw per silhouette; the tower shader lights the windows floor by floor. */
export function Towers({ material }: { material: ShaderMaterial }) {
  const { data } = useCity()

  const meshes = useMemo(() => {
    const matrix = new Matrix4()
    const rotation = new Quaternion()
    return PROFILES.map((profile, kind) => {
      const towers = data.towers.filter((t) => t.kind === kind)
      if (!towers.length) return null
      const geometry = new LatheGeometry(profile.map(([r, h]) => new Vector2(r, h)), SEGMENTS[kind])
      const mesh = new InstancedMesh(geometry, material, towers.length)
      const seeds = new Float32Array(towers.length)
      towers.forEach((t: Tower, n) => {
        matrix.compose(new Vector3(t.x, 0.5, t.z), rotation.setFromAxisAngle(UP, t.seed * 6.2832), new Vector3(t.width, t.height, t.width))
        mesh.setMatrixAt(n, matrix)
        seeds[n] = t.seed
      })
      geometry.setAttribute('aGraine', new InstancedBufferAttribute(seeds, 1))
      mesh.frustumCulled = false
      return mesh
    })
  }, [data, material])

  return (
    <>
      {meshes.map((mesh, kind) => (mesh ? <primitive key={kind} object={mesh} /> : null))}
    </>
  )
}
