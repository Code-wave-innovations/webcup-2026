import type { ComponentProps } from 'react'
import { Link } from 'react-router'
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

/** Same look as `Button`, for navigation (in-page anchors). */
export function ButtonLink({ variant, small, className, ...props }: Look & ComponentProps<'a'>) {
  return <a className={classes({ variant, small }, className)} {...props} />
}

/** Same look as `Button`, for navigation to another route of the app. */
export function ButtonRouterLink({ variant, small, className, ...props }: Look & ComponentProps<typeof Link>) {
  return <Link className={classes({ variant, small }, className)} {...props} />
}
