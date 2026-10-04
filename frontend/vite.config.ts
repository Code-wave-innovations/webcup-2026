/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // SWIFTASK_API_KEY (Nova's voice) is read by the browser too, so it ends up in the public bundle
  envPrefix: ['VITE_', 'SWIFTASK_'],
  build: {
    // three.js + postprocessing + R3F + drei are one deliberate vendor chunk (≈ 300 kB gzipped)
    chunkSizeWarningLimit: 1200,
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
    // the city and bird simulations take a few seconds each, and longer when every file runs in parallel
    testTimeout: 30000,
    environment: 'node',
  },
})
