import { generateCity } from './generateCity'

/** Builds the city off the main thread while the visitor is still in the cockpit. */
self.onmessage = (event: MessageEvent<{ light: boolean }>) => {
  const data = generateCity(event.data.light)
  self.postMessage(data, { transfer: [data.terrain.positions.buffer, data.terrain.horizon.buffer, data.beaconPhases.buffer] })
}
