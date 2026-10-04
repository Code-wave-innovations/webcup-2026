import { useCallback, useLayoutEffect, useRef, useState, startTransition, type ReactNode } from 'react'
import { Router, UNSAFE_createBrowserHistory } from 'react-router'
import { isLightScene } from '../a11y/sceneMode'
import { prefixTo } from '../a11y/scenePaths'

type BrowserHistory = ReturnType<typeof UNSAFE_createBrowserHistory>

/**
 * F96: same router as `BrowserRouter`. In the light version, citizen targets (`/`, `/ville`, `/nova`)
 * are written under `/leger`, so every existing `<Link to="/ville">` stays on the light routes.
 */
function createHistory(): BrowserHistory {
  const history = UNSAFE_createBrowserHistory({ v5Compat: true })
  if (!isLightScene) return history
  const createHref = history.createHref.bind(history)
  history.createHref = (to) => createHref(prefixTo(to))
  return history
}

export function SceneRouter({ children }: { children: ReactNode }) {
  const historyRef = useRef<BrowserHistory | null>(null)
  if (historyRef.current == null) historyRef.current = createHistory()
  const history = historyRef.current
  const [state, setStateImpl] = useState({ action: history.action, location: history.location })
  const setState = useCallback((next: { action: typeof history.action; location: typeof history.location }) => {
    startTransition(() => setStateImpl(next))
  }, [])
  useLayoutEffect(() => history.listen(setState), [history, setState])
  return (
    <Router location={state.location} navigationType={state.action} navigator={history}>
      {children}
    </Router>
  )
}
