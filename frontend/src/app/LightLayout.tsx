import { Outlet } from 'react-router'
import { AlertCenter } from '../features/announcements/AlertCenter'
import { Toast } from '../ui/Toast'

/**
 * F96: shell of the light version, in place of `FilmLayout`: no 3D, no loading screen, no sound or voice,
 * no Nova overlays. Alerts still take over the screen, with what to do. The pages keep their URLs
 * and their functions (D20). Never import the film from here.
 */
export function LightLayout() {
  return (
    <>
      <Outlet />
      <AlertCenter />
      <Toast />
    </>
  )
}
