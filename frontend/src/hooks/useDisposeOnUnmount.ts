import { useEffect, useRef } from 'react'

/**
 * Disposes a memoised resource (three.js objects, mixers…) when it is replaced or the component unmounts,
 * but not during React strict mode's simulated unmount/remount (the resource is still in use then).
 */
export function useDisposeOnUnmount<T>(value: T, dispose: (value: T) => void): void {
  const mounted = useRef<T | null>(null)
  useEffect(() => {
    mounted.current = value
    return () => {
      mounted.current = null
      queueMicrotask(() => {
        if (mounted.current !== value) dispose(value)
      })
    }
  }, [value, dispose])
}
