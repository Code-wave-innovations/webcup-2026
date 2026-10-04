import type { CityAlert, AlertRecommendation } from '../api/types'

// D18 / F31: how an alert's text reads, for the residents and in the back-office preview alike

/**
 * "What you must do" as separate actions: one per line, or one per sentence. A short instruction
 * stays one step.
 */
export function stepsOf(instructions: string | null): string[] {
  if (!instructions) return []
  return instructions
    .split(/\n+/)
    .map((line) => line.trim().replace(/^(?:[-•*]|\d+[.)])\s+/, ''))
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ])/))
    .map((step) => step.trim())
    .filter(Boolean)
}

/** F31: recommendations are objects now, plain strings in older alerts. */
export function recommendationsOf(alert: Pick<CityAlert, 'recommendations'>): AlertRecommendation[] {
  return (alert.recommendations ?? []).map((r) => (typeof r === 'string' ? { text: r } : r)).filter((r) => r.text.trim())
}

