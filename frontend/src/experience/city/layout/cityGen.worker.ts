import { generateCity } from './generateCity'

/** Builds the city off the main thread while the visitor is still in the cockpit. */
self.onmessage = (event: MessageEvent<{ light: boolean }>) => {
  const data = generateCity(event.data.light)
  const transfer = [data.terrain.positions, data.terrain.horizon, data.beaconPhases, data.lowRise, data.trees, data.groundShadows].map((a) => a.buffer)
  self.postMessage(data, { transfer })
}
