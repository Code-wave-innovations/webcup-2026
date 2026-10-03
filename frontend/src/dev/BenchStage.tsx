import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { ShaderMaterial } from 'three'
import { Nova } from '../experience/nova/Nova'
import { NovaLighting, type NovaLightPreset } from '../experience/nova/NovaLighting'
import type { RigReport } from '../experience/nova/rig/rigContract'
import { createFilmControls } from '../experience/post/FilmEffect'
import { PostProcessing } from '../experience/post/PostProcessing'
import { detectQuality } from '../experience/quality/quality'

interface BenchStageProps {
  preset: NovaLightPreset
  modelUrl: string | null
  onReady: (report: RigReport) => void
}

/** A hexagonal holo-floor like the walkway Nova will walk on in the city. */
function Floor() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader: 'varying vec3 vPos; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vPos=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
        fragmentShader: `varying vec3 vPos;
          void main(){
            vec2 q=vPos.xz/0.16; float h=max(abs(q.x),abs(q.x)*0.5+abs(q.y)*0.8660254);
            float r=length(vPos.xz);
            float line=smoothstep(0.035,0.0,abs(fract(h)-0.5)-0.465);
            float fade=smoothstep(1.4,0.2,r);
            vec3 c=vec3(0.025,0.035,0.055)*fade+vec3(0.45,1.5,2.0)*line*fade*0.12+vec3(0.3,1.0,1.4)*smoothstep(0.4,0.0,r)*0.03;
            gl_FragColor=vec4(c,fade);
          }`,
      }),
    [],
  )
  return (
    <mesh material={material} rotation-x={-Math.PI / 2} renderOrder={-2}>
      <circleGeometry args={[1.5, 72]} />
    </mesh>
  )
}

/** The bench's film controls: no fade, the clock runs from page load. */
const benchFilm = { ...createFilmControls(), veil: 0 }
const benchStart = performance.now()
const benchTime = () => {
  benchFilm.time = (performance.now() - benchStart) / 1000
  return { dt: 1 / 60, time: benchFilm.time }
}

function BenchScene({ preset, modelUrl, onReady }: BenchStageProps) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const profile = useMemo(() => detectQuality(gl), [gl])

  return (
    <>
      <color attach="background" args={['#04070d']} />
      <NovaLighting preset={preset} />
      <Nova modelUrl={modelUrl} onReady={onReady} />
      <Floor />
      <OrbitControls target={[0, 0.5, 0]} enableDamping minDistance={0.9} maxDistance={4} maxPolarAngle={Math.PI * 0.55} />
      <PostProcessing profile={profile} camera={() => camera} controls={benchFilm} frameTime={benchTime} />
    </>
  )
}

/** Nova alone on a stage, lit like the film and developed through the same film pass. */
export function BenchStage(props: BenchStageProps) {
  return (
    <Canvas flat linear shadows="percentage" camera={{ position: [0.35, 0.7, 2.6], fov: 30, near: 0.05, far: 50 }}>
      <BenchScene {...props} />
    </Canvas>
  )
}
