import { generateCity, type CityData } from './generateCity'

/** Generates the city in a Web Worker (about a second of number crunching), inline if workers are unavailable. */
export function loadCityData(light: boolean): Promise<CityData> {
  if (typeof Worker === 'undefined') return Promise.resolve(generateCity(light))
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./cityGen.worker.ts', import.meta.url), { type: 'module' })
    const finish = (data: CityData) => {
      worker.terminate()
      resolve(data)
    }
    worker.onmessage = (event: MessageEvent<CityData>) => finish(event.data)
    worker.onerror = () => finish(generateCity(light))
    worker.postMessage({ light })
  })
}
