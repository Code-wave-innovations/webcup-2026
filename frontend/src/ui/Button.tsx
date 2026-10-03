import type { ComponentProps } from 'react'
import { Link, type LinkProps } from 'react-router'
import { useMagnetic } from './useMagnetic'
import styles from './Button.module.css'

type Variant = 'solid' | 'ghost' | 'inverse'

interface Look {
  variant?: Variant
  small?: boolean
}

function classes({ variant = 'solid', small }: Look, extra?: string) {
  return [styles.button, styles[variant], small && styles.small, extra].filter(Boolean).join(' ')
}

export function Button({ variant, small, className, type = 'button', ...props }: Look & ComponentProps<'button'>) {
  return <button type={type} className={classes({ variant, small }, className)} {...props} />
}

/**
 * Same look as `Button`, for navigation (in-page anchors). `magnetic` calls to action lean towards the
 * cursor (they then take no `ref` of their own).
 */
export function ButtonLink({ variant, small, magnetic, className, ref, ...props }: Look & { magnetic?: boolean } & ComponentProps<'a'>) {
  const magnet = useMagnetic<HTMLAnchorElement>()
  return <a ref={magnetic ? magnet : ref} className={classes({ variant, small }, className)} {...props} />
}

/** Same look as `Button`, for a route of the app (client-side navigation, the 3D film keeps running). */
export function ButtonRouteLink({ variant, small, className, ...props }: Look & LinkProps) {
  return <Link className={classes({ variant, small }, className)} {...props} />
}
