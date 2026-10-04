import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { useBookAppointment, useSlots } from '../../api/appointments'
import { messageFor, toApiError } from '../../api/errors'
import { useProcedures } from '../../api/procedures'
import { useCatalogue } from '../../api/services'
import type { Appointment, AppointmentSlot } from '../../api/types'
import { useNow } from '../../hooks/useNow'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { GlassPanel } from '../../ui/GlassPanel'
import { Icon } from '../../ui/Icon'
import { hexBurst } from '../../ui/hexBurst'
import text from '../../ui/text.module.css'
import { availabilityView } from '../services/availability'
import { ServiceGlyph } from '../services/ServiceGlyph'
import { closedReason, dayPart, documentsOf, formatCityMoment, groupByDay, nextDays, openSlots, REMINDER_OPTIONS, reminderLabel, reminderPlan, zoneNote, type DayPart } from './appointmentModel'
import { AppointmentTicket } from './AppointmentTicket'
import styles from './Booking.module.css'

type Step = 0 | 1 | 2 | 3
const STEPS = ['Service', 'Jour', 'Heure', 'Préparation'] as const
const PARTS: DayPart[] = ['Matin', 'Après-midi', 'Soir']
const DEFAULT_REMINDER = 1440

/**
 * F39 / F40: booking an appointment with an agent in four steps, with a summary that never leaves the
 * screen. Days and hours are the city's, written in full; a day that cannot be chosen says why; the
 * reminder says when it will go. The confirmation is a ticket with everything to prepare the visit.
 */
export function BookingFlow({ initialService }: { initialService?: string | null }) {
  const now = useNow()
  const slots = useSlots(null)
  const catalogue = useCatalogue({ category: null, limit: 100 })
  const book = useBookAppointment()

  const [serviceId, setServiceId] = useState<number | null>(null)
  const [dayKey, setDayKey] = useState<string | null>(null)
  const [slotId, setSlotId] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [procedureId, setProcedureId] = useState<number | null>(null)
  const [reminder, setReminder] = useState<number | null>(DEFAULT_REMINDER)
  const [step, setStep] = useState<Step>(0)
  const [notice, setNotice] = useState<string | null>(null)
  // a service given in the URL is chosen at once, until the resident goes back to the list
  const [ignorePreset, setIgnorePreset] = useState(false)
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [booked, setBooked] = useState<Appointment | null>(null)
  const submitRef = useRef<HTMLButtonElement>(null)

  const all = useMemo(() => slots.data ?? [], [slots.data])
  // only the services that open slots are offered (F39)
  const offered = useMemo(() => {
    const byId = new Map<number, { service: AppointmentSlot['service']; count: number }>()
    for (const slot of all) byId.set(slot.service_id, { service: slot.service, count: (byId.get(slot.service_id)?.count ?? 0) + (slot.blocked ? 0 : 1) })
    return [...byId.values()]
  }, [all])
  const preset = initialService && !ignorePreset ? (offered.find((o) => o.service.slug === initialService)?.service.id ?? null) : null
  const chosenService = serviceId ?? preset
  const currentStep: Step = serviceId === null && preset !== null && step === 0 ? 1 : step

  const timeZone = all[0]?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const ofService = useMemo(() => all.filter((s) => s.service_id === chosenService), [all, chosenService])
  const byDay = useMemo(() => groupByDay(ofService), [ofService])
  const days = useMemo(() => nextDays(now, timeZone), [now, timeZone])
  const slot = ofService.find((s) => s.id === slotId) ?? null
  const day = days.find((d) => d.key === dayKey) ?? null
  const service = offered.find((o) => o.service.id === chosenService)?.service ?? null
  const details = catalogue.data?.data.find((s) => s.id === chosenService)
  const procedures = useProcedures(chosenService)
  const procedure = procedures.data?.find((p) => p.id === procedureId) ?? null
  const plan = slot ? reminderPlan(slot.starts_at, reminder, timeZone, now) : null

  const go = (next: Step) => {
    setNotice(null)
    if (next === 0) setIgnorePreset(true)
    setStep(next)
  }
  const chooseService = (id: number) => {
    setServiceId(id)
    setDayKey(null)
    setSlotId(null)
    setProcedureId(null)
    go(1)
  }
  const chooseDay = (key: string) => {
    setServiceId(chosenService)
    setDayKey(key)
    setSlotId(null)
    go(2)
  }
  const chooseSlot = (id: number) => {
    setSlotId(id)
    go(3)
  }

  const confirm = () => {
    if (!slot) return
    if (reason.trim().length < 3) {
      setReasonError('Dites en quelques mots l’objet du rendez-vous : l’agent le prépare.')
      document.getElementById('booking-reason')?.focus()
      return
    }
    setReasonError(null)
    book.mutate(
      { slot_id: slot.id, reason: reason.trim(), procedure_id: procedureId ?? undefined, reminder_offset_minutes: reminder },
      {
        onSuccess: ({ appointment }) => {
          const rect = submitRef.current?.getBoundingClientRect()
          if (rect) hexBurst({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
          setBooked(appointment)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        },
        onError: (error) => {
          const api = toApiError(error)
          // F39: somebody took the last place meanwhile: the day stays chosen, the hours are refreshed
          // F38: the service was interrupted meanwhile: why, and when it is back
          if (api.code === 'SERVICE_UNAVAILABLE') {
            const details = api.details as { reason?: string; back_at?: string | null } | undefined
            setNotice(
              `Le service est interrompu sur ce créneau${details?.reason ? ` : ${details.reason}` : ''}${details?.back_at ? ` Retour prévu ${formatCityMoment(details.back_at, timeZone)}.` : ''} Choisissez une autre heure.`,
            )
            setSlotId(null)
            void slots.refetch()
            setStep(2)
            return
          }
          if (api.code === 'SLOT_FULL') {
            setSlotId(null)
            void slots.refetch()
            setNotice('Ce créneau vient d’être réservé par quelqu’un d’autre. Choisissez une autre heure : la liste est à jour.')
            setStep(2)
            return
          }
          setNotice(messageFor(api))
        },
      },
    )
  }

  if (booked) return <Confirmation appointment={booked} onAgain={() => window.location.reload()} />

  if (slots.isPending) return <GlassPanel className={styles.loading} aria-busy="true">Ouverture de l’agenda de la ville…</GlassPanel>
  if (slots.isError) return <GlassPanel><p className={text.error}>{messageFor(slots.error)}</p></GlassPanel>
  if (offered.length === 0) return <GlassPanel><p>Aucun service n’ouvre de créneau dans les deux prochaines semaines. Revenez bientôt, ou écrivez à la mairie.</p></GlassPanel>

  return (
    <div className={styles.flow}>
      <ol className={styles.rail} aria-label="Étapes de la prise de rendez-vous" style={{ '--progress': currentStep / (STEPS.length - 1) } as CSSProperties}>
        {STEPS.map((label, i) => {
          const reachable = i === 0 || (i === 1 && chosenService !== null) || (i === 2 && dayKey !== null) || (i === 3 && slot !== null)
          return (
            <li key={label} data-state={i < currentStep ? 'done' : i === currentStep ? 'current' : 'next'}>
              <button type="button" disabled={!reachable || i === currentStep} onClick={() => go(i as Step)} aria-current={i === currentStep ? 'step' : undefined}>
                <span className={styles.node} aria-hidden="true">
                  {i < currentStep ? <Icon name="check" size={14} /> : i + 1}
                </span>
                <span className={styles.nodeLabel}>{label}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className={styles.layout}>
        <GlassPanel className={styles.stage}>
          {notice && (
            <p className={styles.notice} role="alert">
              <Icon name="alert" size={16} /> {notice}
            </p>
          )}

          {currentStep === 0 && (
            <section className={styles.step} key="service" aria-labelledby="step-title">
              <h2 id="step-title">Avec quel service ?</h2>
              <div className={styles.services}>
                {offered.map(({ service: s, count }, i) => {
                  const catalogueEntry = catalogue.data?.data.find((c) => c.id === s.id)
                  const view = catalogueEntry ? availabilityView(catalogueEntry.availability) : null
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={styles.serviceCard}
                      aria-pressed={chosenService === s.id}
                      style={{ '--i': i } as CSSProperties}
                      onClick={() => chooseService(s.id)}
                    >
                      <span className={styles.glyph}>
                        <ServiceGlyph name={catalogueEntry?.icon} size={24} />
                      </span>
                      <strong>{s.name}</strong>
                      <small>
                        {count} créneau{count > 1 ? 'x' : ''} libre{count > 1 ? 's' : ''} sur 14 jours
                      </small>
                      {view && view.status !== 'AVAILABLE' && (
                        <small className={styles.warn}>
                          <Icon name="alert" size={13} /> {view.label} {view.detail}
                        </small>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {currentStep === 1 && (
            <section className={styles.step} key="day" aria-labelledby="step-title">
              <h2 id="step-title">Quel jour ?</h2>
              <p className={text.note}>Les deux prochaines semaines, en {zoneNote(timeZone)}.</p>
              <div className={styles.days} role="group" aria-label="Jours">
                {days.map((d, i) => {
                  const list = openSlots(byDay.get(d.key))
                  const closed = closedReason(d, byDay.get(d.key))
                  return (
                    <button
                      key={d.key}
                      type="button"
                      className={styles.day}
                      aria-pressed={dayKey === d.key}
                      disabled={closed !== null}
                      aria-label={`${d.label}${closed ? ` : ${closed}` : ` : ${list.length} créneau${list.length > 1 ? 'x' : ''} libre${list.length > 1 ? 's' : ''}`}`}
                      style={{ '--i': i } as CSSProperties}
                      onClick={() => chooseDay(d.key)}
                    >
                      <span className={styles.weekday}>{i === 0 ? 'auj.' : d.weekday}</span>
                      <span className={styles.date}>{d.date}</span>
                      <span className={styles.month}>{d.month}</span>
                      {closed ? (
                        <small className={styles.closed}>{closed}</small>
                      ) : (
                        <small className={styles.open}>
                          <i style={{ '--fill': Math.min(1, list.length / 8) } as CSSProperties} aria-hidden="true" />
                          {list.length} libre{list.length > 1 ? 's' : ''}
                        </small>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {currentStep === 2 && day && (
            <section className={styles.step} key="time" aria-labelledby="step-title">
              <h2 id="step-title">À quelle heure, {day.label} ?</h2>
              <p className={text.note}>Heures de début et de fin en {zoneNote(timeZone)}.</p>
              {(byDay.get(day.key) ?? []).find((s) => s.blocked) && (
                <InterruptionNotice slot={(byDay.get(day.key) ?? []).find((s) => s.blocked)!} timeZone={timeZone} />
              )}
              {PARTS.map((part) => {
                const list = (byDay.get(day.key) ?? []).filter((s) => dayPart(s.start_time) === part)
                if (list.length === 0) return null
                return (
                  <div key={part} className={styles.part}>
                    <p className={styles.partLabel}>{part}</p>
                    <div className={styles.times} role="group" aria-label={part}>
                      {list.map((s, i) => (
                        <button
                          key={s.id}
                          type="button"
                          className={styles.time}
                          aria-pressed={slotId === s.id}
                          disabled={s.blocked !== null}
                          aria-label={`${s.label}, ${s.blocked ? 'indisponible : service interrompu' : `${s.location}${s.agent ? `, avec ${s.agent.name} ${s.agent.last_name}` : ''}, ${s.remaining} place${s.remaining > 1 ? 's' : ''}`}`}
                          style={{ '--i': i } as CSSProperties}
                          onClick={() => chooseSlot(s.id)}
                        >
                          <strong>
                            {s.start_time}
                            <Icon name="chevron" size={13} />
                            {s.end_time}
                          </strong>
                          <small>
                            {s.blocked ? (
                              'Service interrompu'
                            ) : (
                              <>
                                {s.remaining} place{s.remaining > 1 ? 's' : ''}
                                {s.agent && ` · ${s.agent.name} ${s.agent.last_name.charAt(0)}.`}
                              </>
                            )}
                          </small>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
              <Button variant="ghost" small onClick={() => go(1)}>
                Choisir un autre jour
              </Button>
            </section>
          )}

          {currentStep === 3 && slot && (
            <section className={styles.step} key="details" aria-labelledby="step-title">
              <h2 id="step-title">Préparer votre venue</h2>
              <Field label="Objet du rendez-vous" htmlFor="booking-reason" required error={reasonError} hint="Quelques mots suffisent : l’agent prépare votre dossier.">
                <textarea id="booking-reason" className={styles.textarea} rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : demande d’acte de naissance pour mon fils" />
              </Field>
              {(procedures.data?.length ?? 0) > 0 && (
                <Field label="Démarche liée (facultatif)" htmlFor="booking-procedure" hint="Les pièces à apporter s’ajoutent à votre convocation.">
                  <select id="booking-procedure" className={styles.select} value={procedureId ?? ''} onChange={(e) => setProcedureId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Aucune</option>
                    {procedures.data!.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <fieldset className={styles.reminders}>
                <legend>Rappel avant le rendez-vous</legend>
                <div className={styles.reminderGrid}>
                  {REMINDER_OPTIONS.map((option) => (
                    <label key={String(option.value)} className={styles.reminder} data-checked={reminder === option.value}>
                      <input type="radio" name="reminder" checked={reminder === option.value} onChange={() => setReminder(option.value)} />
                      <Icon name={option.value === null ? 'close' : 'bell'} size={18} />
                      <strong>{option.label}</strong>
                      <small>{option.detail}</small>
                    </label>
                  ))}
                </div>
                <p className={styles.reminderPlan} aria-live="polite">
                  <Icon name="bell" size={14} />
                  {plan?.when
                    ? plan.immediate
                      ? 'Le rendez-vous est proche : votre confirmation vous servira de rappel.'
                      : `Rappel prévu ${plan.when}, dans votre espace Nova.`
                    : 'Aucun rappel ne sera envoyé.'}
                </p>
              </fieldset>

              {(slot.preparation_notes || procedure) && (
                <div className={styles.prepare}>
                  <p className={styles.partLabel}>À préparer</p>
                  {slot.preparation_notes && <p>{slot.preparation_notes}</p>}
                  {documentsOf(procedure?.required_documents).length > 0 && (
                    <ul>
                      {documentsOf(procedure?.required_documents).map((d) => (
                        <li key={d}>
                          <Icon name="check" size={14} /> {d}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className={styles.submitRow}>
                <Button ref={submitRef} onClick={confirm} disabled={book.isPending} aria-busy={book.isPending} data-nova-look>
                  {book.isPending ? 'Réservation…' : 'Confirmer le rendez-vous'}
                </Button>
                <Button variant="ghost" onClick={() => go(2)}>
                  Changer d’heure
                </Button>
              </div>
            </section>
          )}
        </GlassPanel>

        <GlassPanel className={styles.summary} aria-label="Récapitulatif" data-ready={slot !== null || undefined}>
          <p className={styles.summaryKicker}>Votre rendez-vous</p>
          <dl className={styles.recap}>
            <RecapLine icon="hex" label="Service" value={service?.name} />
            <RecapLine icon="calendar" label="Quand" value={slot ? `${slot.day_label}` : day?.label} sub={slot ? `de ${slot.start_time} à ${slot.end_time} (${zoneNote(timeZone)})` : undefined} />
            <RecapLine icon="pin" label="Où" value={slot?.location} sub={slot?.service.address ?? undefined} />
            <RecapLine icon="face" label="Avec" value={slot ? (slot.agent ? `${slot.agent.name} ${slot.agent.last_name}` : 'Un agent du service') : undefined} />
            <RecapLine icon="bell" label="Rappel" value={slot ? reminderLabel(reminder) : undefined} sub={plan?.when && !plan.immediate ? plan.when : undefined} />
          </dl>
          {details?.contact_phone && (
            <p className={text.note}>
              Une question avant de venir ? <a href={`tel:${details.contact_phone.replace(/[^\d+]/g, '')}`}>{details.contact_phone}</a>
            </p>
          )}
        </GlassPanel>
      </div>
    </div>
  )
}

/** F38: why some hours of the day cannot be booked, and what to do instead */
function InterruptionNotice({ slot, timeZone }: { slot: AppointmentSlot; timeZone: string }) {
  const blocked = slot.blocked!
  return (
    <p className={styles.interruption}>
      <Icon name="alert" size={16} />
      <span>
        <strong>Service interrompu sur une partie de la journée.</strong> {blocked.reason}
        {blocked.back_at && ` Retour prévu ${formatCityMoment(blocked.back_at, timeZone)}.`}
        {blocked.alternative && ` En attendant : ${blocked.alternative}`}
      </span>
    </p>
  )
}

function RecapLine({ icon, label, value, sub }: { icon: 'hex' | 'calendar' | 'pin' | 'face' | 'bell'; label: string; value?: string | null; sub?: string }) {
  return (
    <div className={styles.recapLine} data-filled={value ? true : undefined}>
      <dt>
        <Icon name={icon} size={14} /> {label}
      </dt>
      <dd>
        {value ? (
          <>
            <span key={value} className={styles.recapValue}>
              {value}
            </span>
            {sub && <small>{sub}</small>}
          </>
        ) : (
          <span className={styles.pending}>À choisir</span>
        )}
      </dd>
    </div>
  )
}

function Confirmation({ appointment, onAgain }: { appointment: Appointment; onAgain: () => void }) {
  return (
    <div className={styles.confirmed}>
      <p className={styles.confirmedTitle} role="status">
        <Icon name="check" size={20} /> Rendez-vous confirmé
      </p>
      <AppointmentTicket appointment={appointment} printed />
      <div className={styles.submitRow}>
        <Button variant="ghost" onClick={onAgain}>
          Prendre un autre rendez-vous
        </Button>
      </div>
    </div>
  )
}
