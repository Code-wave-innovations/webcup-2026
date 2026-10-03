/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // three.js + postprocessing + R3F are one deliberate vendor chunk (≈ 260 kB gzipped)
    chunkSizeWarningLimit: 1024,
    rolldownOptions: {
      output: {
        // The 3D engine changes far less often than the app code: keep it in its own long-cached chunk
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/](three|postprocessing|@react-three)[\\/]/ }],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
