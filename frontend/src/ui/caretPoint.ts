let measure: CanvasRenderingContext2D | null = null

/** Password fields show this glyph for each character. */
const MASK = '•'

/**
 * Where the text caret of a single-line input is on screen (CSS pixels): the typed text up to the caret is
 * measured with the input's own font, minus its horizontal scroll. Null if the input is not focused.
 */
export function caretPoint(input: HTMLInputElement): { x: number; y: number } | null {
  if (document.activeElement !== input) return null
  measure ??= document.createElement('canvas').getContext('2d')
  const style = getComputedStyle(input)
  const rect = input.getBoundingClientRect()
  const caret = input.selectionEnd ?? input.value.length
  const typed = input.type === 'password' ? MASK.repeat(caret) : input.value.slice(0, caret)
  let width = 0
  if (measure) {
    measure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    width = measure.measureText(typed).width + (parseFloat(style.letterSpacing) || 0) * typed.length
  }
  const left = rect.left + input.clientLeft + parseFloat(style.paddingLeft)
  const right = rect.right - parseFloat(style.paddingRight)
  return { x: Math.min(right, left + width - input.scrollLeft), y: rect.top + rect.height / 2 }
}
