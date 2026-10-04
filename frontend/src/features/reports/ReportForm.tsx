import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createIncident } from '../../api/requests'
import { useDistricts } from '../../api/districts'
import { useCitizenSessionStore } from '../../api/session'
import { useAuthStore } from '../auth/authStore'
import { useApiForm } from '../../hooks/useApiForm'
import { defineMessages, localeTag, messagesFor, useMessages } from '../../i18n'
import { Button } from '../../ui/Button'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field } from '../../ui/Field'
import { Icon } from '../../ui/Icon'
import text from '../../ui/text.module.css'
import { announce } from '../../ui/toastStore'
import { analyzeReport } from './analyzeReport'
import { CATEGORIES, MIN_REPORT_LENGTH, URGENCIES, categoryLabel, photoError, reportSubject, urgencyLabel, type Category } from './reportModel'
import { reportToken } from './reportToken'
import { useOnline } from '../network/networkStatus'
import { useReportStore } from './reportStore'
import styles from './ReportPanel.module.css'

const ANALYSIS_DELAY_MS = 450

const messages = defineMessages(
  {
    sessionRequired: 'Connectez-vous avec l’e-mail de votre compte citoyen pour que le signalement parte aux services.',
    labels: {
      text: 'Que se passe-t-il ?',
      location: 'Où ?',
      districtId: 'Quartier',
      attachment: 'Photo',
    },
    districtsLoading: 'Les quartiers arrivent, patientez un instant.',
    textRequired: 'Décrivez le problème en quelques mots.',
    locationRequired: 'Indiquez le lieu, ou utilisez votre position.',
    districtRequired: 'Indiquez le quartier.',
    sent: (reference: string) => `Demande ${reference} envoyée`,
    geoUnavailable: 'La position n’est pas disponible sur cet appareil. Indiquez le lieu en toutes lettres.',
    geoSaved: 'Position enregistrée. Le lieu en toutes lettres aide quand même les équipes.',
    geoRefused: 'Position refusée. Indiquez le lieu en toutes lettres : une adresse ou un repère.',
    step1: '1 / 2 · Le problème',
    step2: '2 / 2 · Précisions',
    offline: 'Cet appareil est hors réseau. Ce texte reste enregistré ici et partira quand vous réessaierez.',
    textPlaceholder: 'Exemple : lampadaire cassé devant le 12, rue des Lilas, quartier sud.',
    suggested: 'Proposé par NOVA, à vérifier',
    suggesting: 'NOVA propose la catégorie, le quartier et l’urgence pendant que vous écrivez',
    locationHint: 'Adresse ou repère — obligatoire sans position.',
    locationPlaceholder: '12 rue des Lilas',
    positionTaken: 'Position prise',
    myPosition: 'Ma position',
    next: 'Continuer',
    category: 'Catégorie',
    districtsUnavailable: 'Quartiers indisponibles',
    chooseDistrict: 'Choisir un quartier',
    loading: 'Chargement…',
    urgency: 'Urgence estimée',
    urgencyHint: 'Le service confirme la priorité.',
    photoHint: 'Facultative. JPG, PNG ou WebP, 10 Mo au plus.',
    photoPreview: 'Aperçu de la photo jointe',
    signInNote: 'Pour que le signalement parte aux services, connectez-vous avec l’e-mail de votre compte citoyen.',
    back: 'Retour',
    sending: 'Envoi…',
    send: 'Envoyer au service concerné',
  },
  {
    sessionRequired: 'Sign in with the e-mail of your citizen account so the report reaches the services.',
    labels: {
      text: 'What is happening?',
      location: 'Where?',
      districtId: 'District',
      attachment: 'Photo',
    },
    districtsLoading: 'The districts are on their way, please wait a moment.',
    textRequired: 'Describe the problem in a few words.',
    locationRequired: 'Give the place, or use your position.',
    districtRequired: 'Choose the district.',
    sent: (reference) => `Request ${reference} sent`,
    geoUnavailable: 'Position is not available on this device. Write the place out in full.',
    geoSaved: 'Position saved. Writing the place out still helps the teams.',
    geoRefused: 'Position refused. Write the place out in full: an address or a landmark.',
    step1: '1 / 2 · The problem',
    step2: '2 / 2 · Details',
    offline: 'This device is offline. The text stays saved here and will be sent when you try again.',
    textPlaceholder: 'Example: broken streetlight outside no. 12, rue des Lilas, south district.',
    suggested: 'Suggested by NOVA, please check',
    suggesting: 'NOVA suggests the category, the district and the urgency as you type',
    locationHint: 'Address or landmark — required without a position.',
    locationPlaceholder: '12 rue des Lilas',
    positionTaken: 'Position taken',
    myPosition: 'My position',
    next: 'Continue',
    category: 'Category',
    districtsUnavailable: 'Districts unavailable',
    chooseDistrict: 'Choose a district',
    loading: 'Loading…',
    urgency: 'Estimated urgency',
    urgencyHint: 'The service confirms the priority.',
    photoHint: 'Optional. JPG, PNG or WebP, 10 MB at most.',
    photoPreview: 'Preview of the attached photo',
    signInNote: 'For the report to reach the services, sign in with the e-mail of your citizen account.',
    back: 'Back',
    sending: 'Sending…',
    send: 'Send to the service concerned',
  },
)

class SessionRequired extends Error {
  constructor() {
    super(messagesFor(messages).sessionRequired)
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
  urgency: (typeof URGENCIES)[number]
  coords: Coords | null
  attachment: File | null
  districtsKnown: boolean
}

type Step = 1 | 2

/** One sentence is enough: NOVA proposes the category, the district and the urgency while the visitor types. */
export function ReportForm() {
  const draft = useReportStore((s) => s.draft)
  const citizenToken = useCitizenSessionStore((s) => s.token)
  const filmToken = useAuthStore((s) => s.session?.token)
  const signedIn = Boolean(citizenToken || filmToken)
  const online = useOnline()
  const { editDraft, applySuggestion, accept } = useReportStore.getState()
  const districts = useDistricts()
  const [step, setStep] = useState<Step>(1)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [geoNote, setGeoNote] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const previewUrl = useRef<string | null>(null)
  const stepHeadingRef = useRef<HTMLParagraphElement>(null)
  const m = useMessages(messages)

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

  useEffect(() => {
    stepHeadingRef.current?.focus()
  }, [step])

  const form = useApiForm<ReportValues, Awaited<ReturnType<typeof createIncident>>>({
    labels: m.labels,
    validate: (values) => {
      const errors: Record<string, string> = {}
      if (districts.isLoading) errors.districtId = m.districtsLoading
      if (values.text.trim().length < MIN_REPORT_LENGTH) errors.text = m.textRequired
      if (!values.location.trim() && !values.coords) errors.location = m.locationRequired
      if (values.districtsKnown && !values.districtId) errors.districtId = m.districtRequired
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
          // empty when unknown: the tracker and Nova then name no district
          districtName: created.request.district?.name ?? district?.name ?? '',
          districtCode: created.request.district?.code ?? district?.code ?? null,
          // empty with a position only: the tracker says « Position envoyée » in the visitor's language
          location: values.location.trim(),
          urgency: values.urgency,
          status: created.status,
          confirmation: created.message,
          receivedAt: new Date().toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' }),
        })
        return created
      })
    },
    onSuccess: (created) => announce(messagesFor(messages).sent(created.reference)),
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
      setGeoNote(messagesFor(messages).geoUnavailable)
      return
    }
    setLocating(true)
    setGeoNote(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        setGeoNote(messagesFor(messages).geoSaved)
        setLocating(false)
        form.clearError('location')
      },
      () => {
        setCoords(null)
        setGeoNote(messagesFor(messages).geoRefused)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    )
  }

  const valuesFromDraft = (): ReportValues => {
    const current = useReportStore.getState().draft
    return {
      text: current.text,
      location: current.location,
      category: current.category,
      districtId: current.districtId,
      urgency: current.urgency,
      coords,
      attachment: file,
      districtsKnown: Boolean(districts.data?.length),
    }
  }

  const goNext = () => {
    const values = valuesFromDraft()
    const errors: Record<string, string> = {}
    if (values.text.trim().length < MIN_REPORT_LENGTH) errors.text = m.textRequired
    if (!values.location.trim() && !values.coords) errors.location = m.locationRequired
    if (Object.keys(errors).length) {
      form.applyErrors(errors)
      return
    }
    setStep(2)
  }

  const send = (event: FormEvent) => {
    event.preventDefault()
    if (step === 1) {
      goNext()
      return
    }
    void form.handleSubmit(valuesFromDraft())
  }

  return (
    <form className={styles.form} noValidate onSubmit={send}>
      <div className={styles.stepper} aria-hidden="true">
        <span data-active={step === 1 || undefined} />
        <span data-active={step === 2 || undefined} />
      </div>
      <p ref={stepHeadingRef} className={styles.stepLabel} tabIndex={-1}>
        {step === 1 ? m.step1 : m.step2}
      </p>

      <ErrorSummary errors={form.summary} formError={form.formError} id={form.summaryId} />
      {!online && (
        <p className={text.note}>{m.offline}</p>
      )}

      {step === 1 ? (
        <>
          <div className={styles.group}>
            <Field label={m.labels.text} required error={form.errors.text} htmlFor={form.fieldId('text')}>
              {(control) => (
                <textarea
                  {...control}
                  maxLength={2000}
                  rows={2}
                  placeholder={m.textPlaceholder}
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
              <span>{draft.suggested ? m.suggested : m.suggesting}</span>
            </div>
          </div>

          <div className={styles.group}>
            <Field label={m.labels.location} required hint={m.locationHint} error={form.errors.location} htmlFor={form.fieldId('location')}>
              {(control) => (
                <div className={styles.placeRow}>
                  <input
                    {...control}
                    maxLength={191}
                    placeholder={m.locationPlaceholder}
                    value={draft.location}
                    onChange={(e) => {
                      form.clearError('location')
                      editDraft({ location: e.target.value })
                    }}
                  />
                  <Button type="button" variant="ghost" small onClick={locate} disabled={locating}>
                    {locating ? '…' : coords ? m.positionTaken : m.myPosition}
                  </Button>
                </div>
              )}
            </Field>
            {geoNote && <p className={text.note}>{geoNote}</p>}
          </div>

          <div className={styles.actions}>
            <Button type="submit" small>
              {m.next}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.group}>
            <Field label={m.category} group error={form.errors.category}>
              <div className={styles.chips}>
                {CATEGORIES.map((category, index) => (
                  <button
                    key={category}
                    id={index === 0 ? form.fieldId('category') : undefined}
                    type="button"
                    aria-pressed={category === draft.category}
                    onClick={() => editDraft({ category })}
                  >
                    {categoryLabel(category)}
                  </button>
                ))}
              </div>
            </Field>
            <div className={styles.pair}>
              <Field label={m.labels.districtId} required={Boolean(districts.data?.length)} error={form.errors.districtId} htmlFor={form.fieldId('districtId')}>
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
                    <option value="">{districts.isError ? m.districtsUnavailable : districts.data ? m.chooseDistrict : m.loading}</option>
                    {(districts.data ?? []).map((district) => (
                      <option key={district.id} value={district.id}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={m.urgency} hint={m.urgencyHint} htmlFor="report-urgency">
                <select id="report-urgency" value={draft.urgency} onChange={(e) => editDraft({ urgency: e.target.value as ReportValues['urgency'] })}>
                  {URGENCIES.map((urgency) => (
                    <option key={urgency} value={urgency}>
                      {urgencyLabel(urgency)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className={styles.group}>
            <Field label={m.labels.attachment} hint={m.photoHint} error={form.errors.attachment} htmlFor={form.fieldId('attachment')}>
              {(control) => (
                <div className={styles.photoRow}>
                  <input
                    {...control}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
                  />
                  {preview && <img className={styles.preview} src={preview} alt={m.photoPreview} />}
                </div>
              )}
            </Field>
          </div>

          <div className={styles.actions}>
            {!signedIn && (
              <p className={text.note}>{m.signInNote}</p>
            )}
            <div className={styles.nav}>
              <Button type="button" variant="ghost" small onClick={() => setStep(1)}>
                {m.back}
              </Button>
              <Button type="submit" small disabled={form.pending}>
                {form.pending ? m.sending : m.send}
              </Button>
            </div>
          </div>
        </>
      )}
    </form>
  )
}
