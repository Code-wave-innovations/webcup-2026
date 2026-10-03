import { useEffect, useId, useRef, useState } from 'react'
import { fieldErrors, messageFor } from '../api/errors'

/** One line of an error summary: the field to reach, its label, what to fix. */
export interface SummaryError {
  /** id of the control */
  id: string
  label: string
  message: string
}

interface ApiFormOptions<TValues, TResult> {
  /** visible label of each field, keyed by the API field name: used by the error summary */
  labels: Record<string, string>
  submit: (values: TValues) => Promise<TResult>
  /** checks run before calling the API, as { field: message } */
  validate?: (values: TValues) => Record<string, string>
  onSuccess?: (result: TResult) => void
}

/**
 * F42: submits a form to the API without double sends, places the API's validation errors on their
 * fields (in French), keeps the other errors for the top of the form, and moves the focus to the
 * `ErrorSummary` after a failure. Pair it with a `Field` whose control id is `fieldId(name)`, and an `ErrorSummary` whose id is
 * `summaryId` (citizen `ui/` and back-office `ui/` both have one).
 */
export function useApiForm<TValues, TResult>({ labels, submit, validate, onSuccess }: ApiFormOptions<TValues, TResult>) {
  const formId = useId()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [failures, setFailures] = useState(0)
  const busy = useRef(false)
  const summaryId = `${formId}-summary`

  // after a failed submit, the summary takes the focus so it is read out
  useEffect(() => {
    if (failures > 0) document.getElementById(summaryId)?.focus()
  }, [failures, summaryId])

  const fieldId = (name: string) => `${formId}-${name}`

  const fail = (fields: Record<string, string>, message: string | null) => {
    setErrors(fields)
    setFormError(message)
    setFailures((count) => count + 1)
  }

  const handleSubmit = async (values: TValues) => {
    if (busy.current) return
    const local = validate?.(values) ?? {}
    if (Object.keys(local).length) return fail(local, null)
    busy.current = true
    setPending(true)
    setErrors({})
    setFormError(null)
    try {
      // not `onSuccess?.(await submit(values))`: without onSuccess, the optional call skips its argument
      const result = await submit(values)
      onSuccess?.(result)
    } catch (error) {
      const fields = fieldErrors(error)
      fail(fields, Object.keys(fields).length ? null : messageFor(error))
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  /** Forgets a field's error while it is being corrected. */
  const clearError = (name: string) =>
    setErrors((current) => {
      if (!(name in current)) return current
      const rest = { ...current }
      delete rest[name]
      return rest
    })

  const summary: SummaryError[] = Object.entries(errors).map(([name, message]) => ({
    id: fieldId(name),
    label: labels[name] ?? name,
    message,
  }))

  return { fieldId, errors, formError, summary, summaryId, pending, handleSubmit, clearError }
}
