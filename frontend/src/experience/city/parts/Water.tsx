import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { HalfFloatType, LinearFilter, UnsignedByteType, Vector2, WebGLRenderTarget, type Mesh, type PerspectiveCamera } from 'three'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { director } from '../../director/director'
import { FRAME_PRIORITY } from '../../framePriority'
import { useCity } from '../CityContext'
import { createWorldMaterial } from '../worldMaterial'
import waterVert from '../glsl/water.vert.glsl?raw'
import waterFrag from '../glsl/water.frag.glsl?raw'

const disposeTarget = (target: WebGLRenderTarget) => target.dispose()

interface WaterProps {
  /** the camera seeing the world upside down from under the water plane */
  mirrorCamera: PerspectiveCamera
  sky: RefObject<Mesh | null>
}

/**
 * Lake and river: a flat plane that samples a half-resolution render of the city mirrored under the water
 * (planar reflection), distorted by animated ripples and blended with a Fresnel term.
 */
export function Water({ mirrorCamera, sky }: WaterProps) {
  const { uniforms, pointScale, hdr } = useCity()
  const meshRef = useRef<Mesh>(null)
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const viewportDpr = useThree((s) => s.viewport.dpr)

  const mirror = useMemo(
    () => new WebGLRenderTarget(2, 2, { minFilter: LinearFilter, magFilter: LinearFilter, type: hdr ? HalfFloatType : UnsignedByteType, depthBuffer: true }),
    [hdr],
  )
  const material = useMemo(
    () => createWorldMaterial(uniforms, waterVert, waterFrag, { tReflet: { value: mirror.texture }, uResol: { value: new Vector2(1, 1) } }),
    [uniforms, mirror],
  )
  const buffer = useMemo(() => new Vector2(), [])

  useEffect(() => {
    gl.getDrawingBufferSize(buffer)
    mirror.setSize(Math.max(2, Math.round(buffer.x / 2)), Math.max(2, Math.round(buffer.y / 2)))
    material.uniforms.uResol.value.copy(buffer)
  }, [gl, size, viewportDpr, mirror, material, buffer])

  useDisposeOnUnmount(mirror, disposeTarget)

  useFrame(({ scene }) => {
    const water = meshRef.current
    const skyDome = sky.current
    if (!water || !skyDome || director.stage !== 'city') return
    const mainScale = pointScale.value
    skyDome.position.copy(mirrorCamera.position)
    water.visible = false
    uniforms.uCoupe.value = 0.04
    pointScale.value = mainScale / 2
    gl.setRenderTarget(mirror)
    gl.render(scene, mirrorCamera)
    gl.setRenderTarget(null)
    pointScale.value = mainScale
    uniforms.uCoupe.value = -1e6
    water.visible = true
    const camera = director.cameras.city
    if (camera) skyDome.position.copy(camera.position)
  }, FRAME_PRIORITY.reflection)

  return (
    <mesh ref={meshRef} material={material} frustumCulled={false} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[3200, 3200]} />
    </mesh>
  )
}
