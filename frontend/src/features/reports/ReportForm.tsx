import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Icon } from '../../ui/Icon'
import { analyzeReport } from './analyzeReport'
import { CATEGORIES, MIN_REPORT_LENGTH, SECTORS, URGENCIES, type Sector, type Urgency } from './reportModel'
import { useReportStore } from './reportStore'
import styles from './ReportPanel.module.css'

const ANALYSIS_DELAY_MS = 450

/** One sentence is enough: NOVA proposes the category, sector and urgency while the visitor types. */
export function ReportForm() {
  const draft = useReportStore((s) => s.draft)
  const { editDraft, applySuggestion, submit } = useReportStore.getState()
  const [missing, setMissing] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (draft.text.trim().length < MIN_REPORT_LENGTH) return
    const timer = setTimeout(() => applySuggestion(analyzeReport(draft.text, useReportStore.getState().draft.sector)), ANALYSIS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draft.text, applySuggestion])

  const send = (event: FormEvent) => {
    event.preventDefault()
    if (draft.text.trim().length < MIN_REPORT_LENGTH) {
      setMissing(true)
      textRef.current?.focus()
      return
    }
    submit()
  }

  return (
    <form className={styles.form} noValidate onSubmit={send}>
      <Field label="Que se passe-t-il ?" htmlFor="report-text" error={missing ? 'Décrivez le problème en quelques mots.' : null} errorId="report-error">
        <textarea
          ref={textRef}
          id="report-text"
          maxLength={200}
          placeholder="Exemple : fuite d'eau près du sas du dôme 3, depuis ce matin."
          value={draft.text}
          aria-describedby={missing ? 'report-error' : undefined}
          onChange={(e) => {
            setMissing(false)
            editDraft({ text: e.target.value })
          }}
        />
      </Field>
      <div className={styles.nova}>
        <Icon name="hex" size={16} />
        <span>{draft.suggested ? 'Proposé par NOVA, à vérifier' : 'NOVA remplit la suite par mots-clés pendant que vous écrivez'}</span>
      </div>
      <Field label="Catégorie" group>
        <div className={styles.chips}>
          {CATEGORIES.map((category) => (
            <button key={category} type="button" aria-pressed={category === draft.category} onClick={() => editDraft({ category })}>
              {category}
            </button>
          ))}
        </div>
      </Field>
      <div className={styles.pair}>
        <Field label="Secteur" htmlFor="report-sector">
          <select id="report-sector" value={draft.sector} onChange={(e) => editDraft({ sector: e.target.value as Sector })}>
            {SECTORS.map((sector) => (
              <option key={sector}>{sector}</option>
            ))}
          </select>
        </Field>
        <Field label="Urgence" htmlFor="report-urgency">
          <select id="report-urgency" value={draft.urgency} onChange={(e) => editDraft({ urgency: e.target.value as Urgency })}>
            {URGENCIES.map((urgency) => (
              <option key={urgency}>{urgency}</option>
            ))}
          </select>
        </Field>
      </div>
      <Button type="submit">Envoyer au Haut Conseil</Button>
    </form>
  )
}
