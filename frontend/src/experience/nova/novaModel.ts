/**
 * Nova's 3D model: the rigged GLB built by `yarn model:nova`. Set `VITE_NOVA_MODEL_URL` to another file,
 * or to an empty value to use the procedural stand-in.
 */
export const NOVA_MODEL_URL: string | null = (import.meta.env.VITE_NOVA_MODEL_URL ?? '/models/nova.glb') || null
