import { Outlet, useLocation } from 'react-router'
import { barePath } from '../a11y/scenePaths'
import { AlertCenter } from '../features/announcements/AlertCenter'
import { Toast } from '../ui/Toast'
import { CityHorizon } from './CityHorizon'

/**
 * F96: shell of the light version, in place of `FilmLayout`: no 3D engine, no loading screen, no sound
 * or voice, no Nova overlays. A painted city sits behind the pages. Alerts still take over the screen,
 * with what to do. Never import the film from here.
 */
export function LightLayout() {
  const { pathname } = useLocation()
  return (
    <>
      <CityHorizon fixed={barePath(pathname) === '/'} />
      <Outlet />
      <AlertCenter />
      <Toast />
    </>
  )
}
