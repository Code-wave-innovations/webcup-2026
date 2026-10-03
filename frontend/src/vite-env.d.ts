/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_URL?: string
  readonly VITE_API_URL?: string
  readonly VITE_IMG_URL?: string
  readonly VITE_FACE_API_URL?: string
  readonly VITE_FACE_API_KEY?: string
  readonly VITE_STT_API_URL?: string
  /** Nova's GLB (default /models/nova.glb); empty for the procedural stand-in */
  readonly VITE_NOVA_MODEL_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
