import { Environment, Lightformer } from '@react-three/drei'

export type NovaLightPreset = 'airlock' | 'dusk' | 'night'

type Vec3 = [number, number, number]

interface Preset {
  /** the sun (or moon): soft key light, also the shadow caster */
  key: { color: string; intensity: number; position: Vec3 }
  /** large soft sources reflected by the ceramic and the visor */
  formers: Array<{ color: string; intensity: number; position: Vec3; scale: Vec3; form?: 'rect' | 'circle' | 'ring' }>
}

/**
 * Light that matches each scene of the film, so Nova sits in the picture instead of on top of it:
 * warm sun and cold screens in the cockpit, sunset in the city, moon and city glow at night.
 * The environment is rendered once from light shapes (no HDRI file to download).
 */
const PRESETS: Record<NovaLightPreset, Preset> = {
  airlock: {
    key: { color: '#ffb47a', intensity: 2.6, position: [-2, 2.2, -3] },
    formers: [
      { color: '#dfeeff', intensity: 1.4, position: [1.5, 2, 4], scale: [4, 3, 1] },
      { color: '#ffb47a', intensity: 6, position: [-3, 3, -5], scale: [3, 3, 1], form: 'circle' },
      { color: '#2ac4e8', intensity: 1.6, position: [0, -2, 3], scale: [6, 2, 1] },
      { color: '#b8562c', intensity: 0.9, position: [-5, 1, 1], scale: [3, 4, 1] },
      { color: '#8fe9ff', intensity: 2.2, position: [3, 1.5, -4], scale: [1, 4, 1] },
    ],
  },
  dusk: {
    key: { color: '#ff9a52', intensity: 3.2, position: [2.5, 1.2, -3] },
    formers: [
      { color: '#ffe8d2', intensity: 2, position: [-2, 2.5, 4], scale: [4, 3, 1] },
      { color: '#ff9a52', intensity: 7, position: [4, 1.5, -6], scale: [4, 2, 1], form: 'circle' },
      { color: '#6d5a94', intensity: 1.4, position: [0, 6, 0], scale: [8, 8, 1] },
      { color: '#7a3a22', intensity: 0.8, position: [0, -3, 2], scale: [8, 2, 1] },
      { color: '#8fe9ff', intensity: 1.8, position: [-3, 2, -4], scale: [1, 4, 1] },
    ],
  },
  night: {
    key: { color: '#9db8ff', intensity: 1.4, position: [-2, 3, 2] },
    formers: [
      { color: '#c9d8ff', intensity: 1.1, position: [1.5, 2, 4], scale: [4, 3, 1] },
      { color: '#9db8ff', intensity: 2.2, position: [-3, 5, 2], scale: [3, 3, 1], form: 'circle' },
      { color: '#ffb15c', intensity: 1.6, position: [0, -3, 3], scale: [8, 2, 1] },
      { color: '#1b2a5c', intensity: 1, position: [0, 6, 0], scale: [8, 8, 1] },
      { color: '#8fe9ff', intensity: 2.6, position: [2.5, 2, -4], scale: [1, 4, 1] },
    ],
  },
}

export function NovaLighting({ preset, shadows = true }: { preset: NovaLightPreset; shadows?: boolean }) {
  const { key, formers } = PRESETS[preset]
  return (
    <>
      <Environment key={preset} resolution={256} frames={1}>
        {formers.map((f, i) => (
          <Lightformer key={i} form={f.form ?? 'rect'} color={f.color} intensity={f.intensity} position={f.position} scale={f.scale} target={[0, 0.5, 0]} />
        ))}
      </Environment>
      <directionalLight
        position={key.position}
        color={key.color}
        intensity={key.intensity}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.015}
        shadow-camera-left={-0.9}
        shadow-camera-right={0.9}
        shadow-camera-top={1.4}
        shadow-camera-bottom={-0.4}
        shadow-camera-near={0.1}
        shadow-camera-far={10}
        shadow-radius={4}
      />
    </>
  )
}
