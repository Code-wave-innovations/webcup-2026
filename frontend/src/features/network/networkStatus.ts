import { useEffect, useState } from 'react'

/** The browser's own link. A server that stays silent is a separate failure (`isNetworkFailure`). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  useEffect(() => {
    const mark = () => setOnline(navigator.onLine)
    window.addEventListener('online', mark)
    window.addEventListener('offline', mark)
    return () => {
      window.removeEventListener('online', mark)
      window.removeEventListener('offline', mark)
    }
  }, [])
  return online
}
