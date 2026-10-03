import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router'
import { Icon, type IconName } from './Icon'
import styles from './Button.module.css'

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle'

interface Look {
  variant?: Variant
  size?: 'md' | 'sm'
  icon?: IconName
  /** Icon-only button: the label becomes the accessible name. */
  iconOnly?: boolean
  children?: ReactNode
}

const classes = ({ variant = 'ghost', size = 'md', iconOnly }: Look, extra?: string) =>
  [styles.button, styles[variant], size === 'sm' && styles.sm, iconOnly && styles.iconOnly, extra].filter(Boolean).join(' ')

export function Button({ variant, size, icon, iconOnly, className, children, type = 'button', ...props }: Look & ComponentProps<'button'>) {
  return (
    <button type={type} className={classes({ variant, size, iconOnly }, className)} {...props}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {iconOnly ? <span className="bo-sr-only">{children}</span> : children}
    </button>
  )
}

/** Router link with the button look. */
export function ButtonLink({ variant, size, icon, className, children, ...props }: Omit<Look, 'iconOnly'> & ComponentProps<typeof Link>) {
  return (
    <Link className={classes({ variant, size }, className)} {...props}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </Link>
  )
}
