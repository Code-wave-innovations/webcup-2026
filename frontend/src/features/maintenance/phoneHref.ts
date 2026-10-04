/** `tel:` href: keeps a leading + and the digits, drops spaces and labels. */
export function phoneHref(value: string): string {
  return `tel:${value.replace(/[^\d+]/g, '')}`
}
