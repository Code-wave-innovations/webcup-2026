import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createIncident } from '../../api/requests'
import { useDistricts } from '../../api/districts'
import { useCitizenSessionStore } from '../../api/session'
import { useAuthStore } from '../auth/authStore'
import { useApiForm } from '../../hooks/useApiForm'
import { Button } from '../../ui/Button'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field } from '../../ui/Field'
import { Icon } from '../../ui/Icon'
import text from '../../ui/text.module.css'
import { announce } from '../../ui/toastStore'
import { analyzeReport } from './analyzeReport'
import { CATEGORIES, MIN_REPORT_LENGTH, URGENCIES, photoError, reportSubject, type Category } from './reportModel'
import { reportToken } from './reportToken'
import { useReportStore } from './reportStore'
import styles from './ReportPanel.module.css'

const ANALYSIS_DELAY_MS = 450

class SessionRequired extends Error {
  constructor() {
    super('Connectez-vous avec l’e-mail de votre compte citoyen pour que le signalement parte aux services.')
  }
}

interface Coords {
  latitude: number
  longitude: number
}

interface ReportValues {
  text: string
  location: string
  category: Category
  districtId: number | null
  urgency: (typeof URGENCIES)[number]['value']
  coords: Coords | null
  attachment: File | null
  districtsKnown: boolean
}

/** One sentence is enough: NOVA proposes the category, the district and the urgency while the visitor types. */
export function ReportForm() {
  const draft = useReportStore((s) => s.draft)
  const citizenToken = useCitizenSessionStore((s) => s.token)
  const filmToken = useAuthStore((s) => s.session?.token)
  const signedIn = Boolean(citizenToken || filmToken)
  const { editDraft, applySuggestion, accept } = useReportStore.getState()
  const districts = useDistricts()
  const [coords, setCoords] = useState<Coords | null>(null)
  const [geoNote, setGeoNote] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const previewUrl = useRef<string | null>(null)

  useEffect(() => {
    if (draft.text.trim().length < MIN_REPORT_LENGTH) return
    const list = districts.data ?? []
    const timer = setTimeout(() => applySuggestion(analyzeReport(draft.text, list)), ANALYSIS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draft.text, districts.data, applySuggestion])

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    },
    [],
  )

  const form = useApiForm<ReportValues, Awaited<ReturnType<typeof createIncident>>>({
    labels: {
      text: 'Que se passe-t-il ?',
      location: 'Où ?',
      districtId: 'Quartier',
      attachment: 'Photo',
    },
    validate: (values) => {
      const errors: Record<string, string> = {}
      if (districts.isLoading) errors.districtId = 'Les quartiers arrivent, patientez un instant.'
      if (values.text.trim().length < MIN_REPORT_LENGTH) errors.text = 'Décrivez le problème en quelques mots.'
      if (!values.location.trim() && !values.coords) errors.location = 'Indiquez le lieu, ou utilisez votre position.'
      if (values.districtsKnown && !values.districtId) errors.districtId = 'Indiquez le quartier.'
      if (values.attachment) {
        const photo = photoError(values.attachment)
        if (photo) errors.attachment = photo
      }
      return errors
    },
    submit: (values) => {
      const token = reportToken()
      if (!token) throw new SessionRequired()
      const district = districts.data?.find((item) => item.id === values.districtId)
      return createIncident({
        token,
        subject: reportSubject(values.text),
        message: values.text.trim(),
        category: values.category,
        district_id: values.districtId ?? undefined,
        location_label: values.location.trim() || undefined,
        latitude: values.coords?.latitude,
        longitude: values.coords?.longitude,
        urgency_hint: values.urgency,
        attachment: values.attachment ?? undefined,
      }).then((created) => {
        accept({
          id: created.request.id,
          code: created.reference,
          title: created.request.subject,
          category: values.category,
          districtName: created.request.district?.name ?? district?.name ?? 'Quartier non précisé',
          districtCode: created.request.district?.code ?? district?.code ?? null,
          location: values.location.trim() || 'Position envoyée',
          urgency: values.urgency,
          status: created.status,
          confirmation: created.message,
          receivedAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        })
        return created
      })
    },
    onSuccess: (created) => announce(`Demande ${created.reference} envoyée`),
    describeError: (error) => (error instanceof SessionRequired ? error.message : null),
  })

  const chooseFile = (next: File | null) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    const url = next ? URL.createObjectURL(next) : null
    previewUrl.current = url
    setPreview(url)
    setFile(next)
    form.clearError('attachment')
  }

  const locate = () => {
    if (!navigator.geolocation) {
      setGeoNote('La position n’est pas disponible sur cet appareil. Indiquez le lieu en toutes lettres.')
      return
    }
    setLocating(true)
    setGeoNote(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        setGeoNote('Position enregistrée. Le lieu en toutes lettres aide quand même les équipes.')
        setLocating(false)
        form.clearError('location')
      },
      () => {
        setCoords(null)
        setGeoNote('Position refusée. Indiquez le lieu en toutes lettres : une adresse ou un repère.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    )
  }

  const send = (event: FormEvent) => {
    event.preventDefault()
    const current = useReportStore.getState().draft
    void form.handleSubmit({
      text: current.text,
      location: current.location,
      category: current.category,
      districtId: current.districtId,
      urgency: current.urgency,
      coords,
      attachment: file,
      districtsKnown: Boolean(districts.data?.length),
    })
  }

  return (
    <form className={styles.form} noValidate onSubmit={send}>
      <ErrorSummary errors={form.summary} formError={form.formError} id={form.summaryId} />
      <Field label="Que se passe-t-il ?" required error={form.errors.text} htmlFor={form.fieldId('text')}>
        {(control) => (
          <textarea
            {...control}
            maxLength={2000}
            placeholder="Exemple : lampadaire cassé devant le 12, rue des Lilas, quartier sud."
            value={draft.text}
            onChange={(e) => {
              form.clearError('text')
              editDraft({ text: e.target.value })
            }}
          />
        )}
      </Field>
      <div className={styles.nova}>
        <Icon name="hex" size={16} />
        <span>{draft.suggested ? 'Proposé par NOVA, à vérifier' : 'NOVA propose la catégorie, le quartier et l’urgence pendant que vous écrivez'}</span>
      </div>
      <Field label="Où ?" required hint="Une adresse ou un repère. Obligatoire sans position." error={form.errors.location} htmlFor={form.fieldId('location')}>
        {(control) => (
          <input
            {...control}
            maxLength={191}
            placeholder="12 rue des Lilas"
            value={draft.location}
            onChange={(e) => {
              form.clearError('location')
              editDraft({ location: e.target.value })
            }}
          />
        )}
      </Field>
      <div className={styles.geo}>
        <Button type="button" variant="ghost" small onClick={locate} disabled={locating}>
          {locating ? 'Recherche de la position…' : coords ? 'Position prise' : 'Utiliser ma position'}
        </Button>
        {geoNote && <p className={text.note}>{geoNote}</p>}
      </div>
      <Field label="Catégorie" group error={form.errors.category}>
        <div className={styles.chips}>
          {CATEGORIES.map((category, index) => (
            <button
              key={category}
              id={index === 0 ? form.fieldId('category') : undefined}
              type="button"
              aria-pressed={category === draft.category}
              onClick={() => editDraft({ category })}
            >
              {category}
            </button>
          ))}
        </div>
      </Field>
      <div className={styles.pair}>
        <Field label="Quartier" required={Boolean(districts.data?.length)} error={form.errors.districtId} htmlFor={form.fieldId('districtId')}>
          {(control) => (
            <select
              {...control}
              value={draft.districtId ? String(draft.districtId) : ''}
              disabled={!districts.data}
              onChange={(e) => {
                form.clearError('districtId')
                editDraft({ districtId: e.target.value ? Number(e.target.value) : null })
              }}
            >
              <option value="">{districts.isError ? 'Quartiers indisponibles' : districts.data ? 'Choisir un quartier' : 'Chargement…'}</option>
              {(districts.data ?? []).map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Urgence estimée" hint="Le service confirme la priorité." htmlFor="report-urgency">
          <select id="report-urgency" value={draft.urgency} onChange={(e) => editDraft({ urgency: e.target.value as ReportValues['urgency'] })}>
            {URGENCIES.map((urgency) => (
              <option key={urgency.value} value={urgency.value}>
                {urgency.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Photo" hint="Facultative. JPG, PNG ou WebP, 10 Mo au plus." error={form.errors.attachment} htmlFor={form.fieldId('attachment')}>
        {(control) => (
          <input
            {...control}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
          />
        )}
      </Field>
      {preview && <img className={styles.preview} src={preview} alt="Aperçu de la photo jointe" />}
      {!signedIn && (
        <p className={text.note}>Pour que le signalement parte aux services, connectez-vous avec l’e-mail de votre compte citoyen.</p>
      )}
      <Button type="submit" disabled={form.pending}>
        {form.pending ? 'Envoi…' : 'Envoyer au service concerné'}
      </Button>
    </form>
  )
}
