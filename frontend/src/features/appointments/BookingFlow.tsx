import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { useBookAppointment, useSlots } from '../../api/appointments'
import { messageFor, toApiError } from '../../api/errors'
import { useProcedures } from '../../api/procedures'
import { useCatalogue } from '../../api/services'
import type { Appointment, AppointmentSlot } from '../../api/types'
import { useNow } from '../../hooks/useNow'
import { defineMessages, useLocale, useMessages } from '../../i18n'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { GlassPanel } from '../../ui/GlassPanel'
import { Icon } from '../../ui/Icon'
import { hexBurst } from '../../ui/hexBurst'
import text from '../../ui/text.module.css'
import { availabilityView } from '../services/availability'
import { ServiceGlyph } from '../services/ServiceGlyph'
import {
  closedReason,
  dayPart,
  dayPartLabel,
  documentsOf,
  formatCityMoment,
  groupByDay,
  nextDays,
  openSlots,
  reminderLabel,
  reminderOptions,
  reminderPlan,
  zoneNote,
  type DayPart,
} from './appointmentModel'
import { AppointmentTicket } from './AppointmentTicket'
import styles from './Booking.module.css'

type Step = 0 | 1 | 2 | 3
const STEP_COUNT = 4
const PARTS: DayPart[] = ['Matin', 'Après-midi', 'Soir']
const DEFAULT_REMINDER = 1440

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one)
const pluralEn = (n: number, one: string, many: string) => (n === 1 ? one : many)

const messages = defineMessages(
  {
    steps: ['Service', 'Jour', 'Heure', 'Préparation'],
    stepsLabel: 'Étapes de la prise de rendez-vous',
    reasonTooShort: 'Dites en quelques mots l’objet du rendez-vous : l’agent le prépare.',
    interruptedSlot: (reason: string | null, back: string | null) =>
      `Le service est interrompu sur ce créneau${reason ? ` : ${reason}` : ''}${back ? ` Retour prévu ${back}.` : ''} Choisissez une autre heure.`,
    slotTaken: 'Ce créneau vient d’être réservé par quelqu’un d’autre. Choisissez une autre heure : la liste est à jour.',
    opening: 'Ouverture de l’agenda de la ville…',
    noService: 'Aucun service n’ouvre de créneau dans les deux prochaines semaines. Revenez bientôt, ou écrivez à la mairie.',
    whichService: 'Avec quel service ?',
    freeSlots: (n: number) => `${n} ${plural(n, 'créneau libre', 'créneaux libres')} sur 14 jours`,
    whichDay: 'Quel jour ?',
    nextTwoWeeks: (zone: string) => `Les deux prochaines semaines, en ${zone}.`,
    days: 'Jours',
    dayFree: (n: number) => `${n} ${plural(n, 'créneau libre', 'créneaux libres')}`,
    today: 'auj.',
    free: (n: number) => `${n} ${plural(n, 'libre', 'libres')}`,
    whatTime: (day: string) => `À quelle heure, ${day} ?`,
    hoursIn: (zone: string) => `Heures de début et de fin en ${zone}.`,
    blockedSlot: 'indisponible : service interrompu',
    withAgent: (name: string) => `, avec ${name}`,
    places: (n: number) => `${n} ${plural(n, 'place', 'places')}`,
    interrupted: 'Service interrompu',
    otherDay: 'Choisir un autre jour',
    prepare: 'Préparer votre venue',
    reasonLabel: 'Objet du rendez-vous',
    reasonHint: 'Quelques mots suffisent : l’agent prépare votre dossier.',
    reasonPlaceholder: 'Ex. : demande d’acte de naissance pour mon fils',
    procedureLabel: 'Démarche liée (facultatif)',
    procedureHint: 'Les pièces à apporter s’ajoutent à votre convocation.',
    none: 'Aucune',
    reminderLegend: 'Rappel avant le rendez-vous',
    reminderImmediate: 'Le rendez-vous est proche : votre confirmation vous servira de rappel.',
    reminderPlanned: (when: string) => `Rappel prévu ${when}, dans votre espace Nova.`,
    noReminder: 'Aucun rappel ne sera envoyé.',
    toPrepare: 'À préparer',
    booking: 'Réservation…',
    confirm: 'Confirmer le rendez-vous',
    changeTime: 'Changer d’heure',
    summary: 'Récapitulatif',
    yourAppointment: 'Votre rendez-vous',
    recapService: 'Service',
    recapWhen: 'Quand',
    fromTo: (start: string, end: string, zone: string) => `de ${start} à ${end} (${zone})`,
    recapWhere: 'Où',
    recapWith: 'Avec',
    anAgent: 'Un agent du service',
    recapReminder: 'Rappel',
    question: 'Une question avant de venir ?',
    interruptedPart: 'Service interrompu sur une partie de la journée.',
    backAt: (moment: string) => ` Retour prévu ${moment}.`,
    meanwhile: (alternative: string) => ` En attendant : ${alternative}`,
    toChoose: 'À choisir',
    confirmed: 'Rendez-vous confirmé',
    again: 'Prendre un autre rendez-vous',
  },
  {
    steps: ['Service', 'Day', 'Time', 'Preparation'],
    stepsLabel: 'Booking steps',
    reasonTooShort: 'Say in a few words what the appointment is about: the agent prepares it.',
    interruptedSlot: (reason, back) => `The service is interrupted during this slot${reason ? `: ${reason}` : '.'}${back ? ` Expected back ${back}.` : ''} Choose another time.`,
    slotTaken: 'Someone else has just booked this slot. Choose another time: the list is up to date.',
    opening: 'Opening the city’s calendar…',
    noService: 'No service is opening slots in the next two weeks. Come back soon, or write to the city hall.',
    whichService: 'With which service?',
    freeSlots: (n) => `${n} ${pluralEn(n, 'free slot', 'free slots')} over 14 days`,
    whichDay: 'Which day?',
    nextTwoWeeks: (zone) => `The next two weeks, in ${zone}.`,
    days: 'Days',
    dayFree: (n) => `${n} ${pluralEn(n, 'free slot', 'free slots')}`,
    today: 'today',
    free: (n) => `${n} free`,
    whatTime: (day) => `What time on ${day}?`,
    hoursIn: (zone) => `Start and end times in ${zone}.`,
    blockedSlot: 'unavailable: service interrupted',
    withAgent: (name) => `, with ${name}`,
    places: (n) => `${n} ${pluralEn(n, 'place', 'places')}`,
    interrupted: 'Service interrupted',
    otherDay: 'Choose another day',
    prepare: 'Prepare your visit',
    reasonLabel: 'Subject of the appointment',
    reasonHint: 'A few words are enough: the agent prepares your file.',
    reasonPlaceholder: 'E.g. birth certificate request for my son',
    procedureLabel: 'Related procedure (optional)',
    procedureHint: 'The documents to bring are added to your appointment notice.',
    none: 'None',
    reminderLegend: 'Reminder before the appointment',
    reminderImmediate: 'The appointment is close: your confirmation will serve as a reminder.',
    reminderPlanned: (when) => `Reminder planned ${when}, in your Nova space.`,
    noReminder: 'No reminder will be sent.',
    toPrepare: 'To prepare',
    booking: 'Booking…',
    confirm: 'Confirm the appointment',
    changeTime: 'Change the time',
    summary: 'Summary',
    yourAppointment: 'Your appointment',
    recapService: 'Service',
    recapWhen: 'When',
    fromTo: (start, end, zone) => `from ${start} to ${end} (${zone})`,
    recapWhere: 'Where',
    recapWith: 'With',
    anAgent: 'An agent of the service',
    recapReminder: 'Reminder',
    question: 'A question before you come?',
    interruptedPart: 'Service interrupted for part of the day.',
    backAt: (moment) => ` Expected back ${moment}.`,
    meanwhile: (alternative) => ` In the meantime: ${alternative}`,
    toChoose: 'To choose',
    confirmed: 'Appointment confirmed',
    again: 'Book another appointment',
  },
)

/**
 * F39 / F40: booking an appointment with an agent in four steps, with a summary that never leaves the
 * screen. Days and hours are the city's, written in full; a day that cannot be chosen says why; the
 * reminder says when it will go. The confirmation is a ticket with everything to prepare the visit.
 */
export function BookingFlow({ initialService }: { initialService?: string | null }) {
  const now = useNow()
  const m = useMessages(messages)
  const locale = useLocale()
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
  // the day names follow the visitor's language
  const days = useMemo(() => nextDays(now, timeZone), [now, timeZone, locale]) // eslint-disable-line react-hooks/exhaustive-deps
  const slot = ofService.find((s) => s.id === slotId) ?? null
  const day = days.find((d) => d.key === dayKey) ?? null
  const service = offered.find((o) => o.service.id === chosenService)?.service ?? null
  const details = catalogue.data?.data.find((s) => s.id === chosenService)
  const procedures = useProcedures(chosenService)
  const procedure = procedures.data?.find((p) => p.id === procedureId) ?? null
  const plan = slot ? reminderPlan(slot.starts_at, reminder, timeZone, now, locale) : null

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
      setReasonError(m.reasonTooShort)
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
            setNotice(m.interruptedSlot(details?.reason ?? null, details?.back_at ? formatCityMoment(details.back_at, timeZone, locale) : null))
            setSlotId(null)
            void slots.refetch()
            setStep(2)
            return
          }
          if (api.code === 'SLOT_FULL') {
            setSlotId(null)
            void slots.refetch()
            setNotice(m.slotTaken)
            setStep(2)
            return
          }
          setNotice(messageFor(api))
        },
      },
    )
  }

  if (booked) return <Confirmation appointment={booked} onAgain={() => window.location.reload()} />

  if (slots.isPending) return <GlassPanel className={styles.loading} aria-busy="true">{m.opening}</GlassPanel>
  if (slots.isError) return <GlassPanel><p className={text.error}>{messageFor(slots.error)}</p></GlassPanel>
  if (offered.length === 0) return <GlassPanel><p>{m.noService}</p></GlassPanel>

  return (
    <div className={styles.flow}>
      <ol className={styles.rail} aria-label={m.stepsLabel} style={{ '--progress': currentStep / (STEP_COUNT - 1) } as CSSProperties}>
        {m.steps.map((label, i) => {
          const reachable = i === 0 || (i === 1 && chosenService !== null) || (i === 2 && dayKey !== null) || (i === 3 && slot !== null)
          return (
            <li key={i} data-state={i < currentStep ? 'done' : i === currentStep ? 'current' : 'next'}>
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
              <h2 id="step-title">{m.whichService}</h2>
              <div className={styles.services}>
                {offered.map(({ service: s, count }, i) => {
                  const catalogueEntry = catalogue.data?.data.find((c) => c.id === s.id)
                  const view = catalogueEntry ? availabilityView(catalogueEntry.availability, locale) : null
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
                      <small>{m.freeSlots(count)}</small>
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
              <h2 id="step-title">{m.whichDay}</h2>
              <p className={text.note}>{m.nextTwoWeeks(zoneNote(timeZone, locale))}</p>
              <div className={styles.days} role="group" aria-label={m.days}>
                {days.map((d, i) => {
                  const list = openSlots(byDay.get(d.key))
                  const closed = closedReason(d, byDay.get(d.key), locale)
                  return (
                    <button
                      key={d.key}
                      type="button"
                      className={styles.day}
                      aria-pressed={dayKey === d.key}
                      disabled={closed !== null}
                      aria-label={`${d.label}${locale === 'en' ? ':' : ' :'} ${closed ?? m.dayFree(list.length)}`}
                      style={{ '--i': i } as CSSProperties}
                      onClick={() => chooseDay(d.key)}
                    >
                      <span className={styles.weekday}>{i === 0 ? m.today : d.weekday}</span>
                      <span className={styles.date}>{d.date}</span>
                      <span className={styles.month}>{d.month}</span>
                      {closed ? (
                        <small className={styles.closed}>{closed}</small>
                      ) : (
                        <small className={styles.open}>
                          <i style={{ '--fill': Math.min(1, list.length / 8) } as CSSProperties} aria-hidden="true" />
                          {m.free(list.length)}
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
              <h2 id="step-title">{m.whatTime(day.label)}</h2>
              <p className={text.note}>{m.hoursIn(zoneNote(timeZone, locale))}</p>
              {(byDay.get(day.key) ?? []).find((s) => s.blocked) && (
                <InterruptionNotice slot={(byDay.get(day.key) ?? []).find((s) => s.blocked)!} timeZone={timeZone} />
              )}
              {PARTS.map((part) => {
                const list = (byDay.get(day.key) ?? []).filter((s) => dayPart(s.start_time) === part)
                if (list.length === 0) return null
                return (
                  <div key={part} className={styles.part}>
                    <p className={styles.partLabel}>{dayPartLabel(part, locale)}</p>
                    <div className={styles.times} role="group" aria-label={dayPartLabel(part, locale)}>
                      {list.map((s, i) => (
                        <button
                          key={s.id}
                          type="button"
                          className={styles.time}
                          aria-pressed={slotId === s.id}
                          disabled={s.blocked !== null}
                          aria-label={`${s.label}, ${s.blocked ? m.blockedSlot : `${s.location}${s.agent ? m.withAgent(`${s.agent.name} ${s.agent.last_name}`) : ''}, ${m.places(s.remaining)}`}`}
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
                              m.interrupted
                            ) : (
                              <>
                                {m.places(s.remaining)}
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
                {m.otherDay}
              </Button>
            </section>
          )}

          {currentStep === 3 && slot && (
            <section className={styles.step} key="details" aria-labelledby="step-title">
              <h2 id="step-title">{m.prepare}</h2>
              <Field label={m.reasonLabel} htmlFor="booking-reason" required error={reasonError} hint={m.reasonHint}>
                <textarea id="booking-reason" className={styles.textarea} rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={m.reasonPlaceholder} />
              </Field>
              {(procedures.data?.length ?? 0) > 0 && (
                <Field label={m.procedureLabel} htmlFor="booking-procedure" hint={m.procedureHint}>
                  <select id="booking-procedure" className={styles.select} value={procedureId ?? ''} onChange={(e) => setProcedureId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">{m.none}</option>
                    {procedures.data!.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <fieldset className={styles.reminders}>
                <legend>{m.reminderLegend}</legend>
                <div className={styles.reminderGrid}>
                  {reminderOptions(locale).map((option) => (
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
                      ? m.reminderImmediate
                      : m.reminderPlanned(plan.when)
                    : m.noReminder}
                </p>
              </fieldset>

              {(slot.preparation_notes || procedure) && (
                <div className={styles.prepare}>
                  <p className={styles.partLabel}>{m.toPrepare}</p>
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
                  {book.isPending ? m.booking : m.confirm}
                </Button>
                <Button variant="ghost" onClick={() => go(2)}>
                  {m.changeTime}
                </Button>
              </div>
            </section>
          )}
        </GlassPanel>

        <GlassPanel className={styles.summary} aria-label={m.summary} data-ready={slot !== null || undefined}>
          <p className={styles.summaryKicker}>{m.yourAppointment}</p>
          <dl className={styles.recap}>
            <RecapLine icon="hex" label={m.recapService} value={service?.name} />
            <RecapLine
              icon="calendar"
              label={m.recapWhen}
              value={slot ? `${slot.day_label}` : day?.label}
              sub={slot ? m.fromTo(slot.start_time, slot.end_time, zoneNote(timeZone, locale)) : undefined}
            />
            <RecapLine icon="pin" label={m.recapWhere} value={slot?.location} sub={slot?.service.address ?? undefined} />
            <RecapLine icon="face" label={m.recapWith} value={slot ? (slot.agent ? `${slot.agent.name} ${slot.agent.last_name}` : m.anAgent) : undefined} />
            <RecapLine icon="bell" label={m.recapReminder} value={slot ? reminderLabel(reminder, locale) : undefined} sub={plan?.when && !plan.immediate ? plan.when : undefined} />
          </dl>
          {details?.contact_phone && (
            <p className={text.note}>
              {m.question} <a href={`tel:${details.contact_phone.replace(/[^\d+]/g, '')}`}>{details.contact_phone}</a>
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
  const m = useMessages(messages)
  const locale = useLocale()
  return (
    <p className={styles.interruption}>
      <Icon name="alert" size={16} />
      <span>
        <strong>{m.interruptedPart}</strong> {blocked.reason}
        {blocked.back_at && m.backAt(formatCityMoment(blocked.back_at, timeZone, locale))}
        {blocked.alternative && m.meanwhile(blocked.alternative)}
      </span>
    </p>
  )
}

function RecapLine({ icon, label, value, sub }: { icon: 'hex' | 'calendar' | 'pin' | 'face' | 'bell'; label: string; value?: string | null; sub?: string }) {
  const m = useMessages(messages)
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
          <span className={styles.pending}>{m.toChoose}</span>
        )}
      </dd>
    </div>
  )
}

function Confirmation({ appointment, onAgain }: { appointment: Appointment; onAgain: () => void }) {
  const m = useMessages(messages)
  return (
    <div className={styles.confirmed}>
      <p className={styles.confirmedTitle} role="status">
        <Icon name="check" size={20} /> {m.confirmed}
      </p>
      <AppointmentTicket appointment={appointment} printed />
      <div className={styles.submitRow}>
        <Button variant="ghost" onClick={onAgain}>
          {m.again}
        </Button>
      </div>
    </div>
  )
}
