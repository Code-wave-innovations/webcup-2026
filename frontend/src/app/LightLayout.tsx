import { Outlet } from 'react-router'
import { Toast } from '../ui/Toast'

/**
 * F96: shell of the light version, in place of `FilmLayout`: no 3D, no loading screen, no sound or voice,
 * no Nova overlays. The pages keep their URLs and their functions (D20). Never import the film from here.
 */
export function LightLayout() {
  return (
    <>
      <Outlet />
      <Toast />
    </>
  )
}
