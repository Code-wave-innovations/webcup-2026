import { defineMessages, messagesFor } from '../../../i18n'
import { districtIntro, type District } from '../../city/districts'
import type { Emotion } from '../face/faceState'
import { CITY_ENTRANCE_SECONDS } from '../stage/placement'
import { nova, novaNow, novaSignals } from './novaStore'

/** D14: Nova's lines, read in the language of the moment they are said. */
const lines = defineMessages(
  {
    greetAgain: 'Vous revoilà ! Je vous attendais. Identifiez-vous quand vous voulez.',
    greetFirst: 'Bonjour ! Je suis Nova. Identifiez-vous, je vous emmène à Terra Nova.',
    atmosphere: 'Accrochez-vous, on entre dans l’atmosphère !',
    farewell: (name: string) => `À bientôt, ${name} !`,
    welcomeToCity: (name: string) => `Bienvenue à Terra Nova, ${name}. Je suis Nova, votre guide. Faites défiler, je vous fais visiter.`,
    enterStreets: (site: string) => `Accrochez-vous, on décolle ! Destination : ${site}.`,
    leaveStreets: 'On remonte !',
    flyToPoi: (site: string) => `On décolle ! Destination : ${site}.`,
    nudge: 'On continue ? Faites défiler, je vous montre la suite.',
    reportSentAt: (code: string, place: string) => `Demande ${code} envoyée ! Le faisceau au-dessus de ${place}, c'est elle.`,
    reportSent: (code: string) => `Demande ${code} envoyée !`,
    reportProgress: (status: string) => `Votre demande avance : ${status.toLowerCase()}.`,
    alertOver: "Fin d'alerte. Tout est rentré dans l'ordre.",
    capsLock: 'Attention, les majuscules sont activées.',
    refused: (left: number) => (left > 1 ? `Ce code ne passe pas. Encore ${left} essais.` : 'Refusé… Attention, dernier essai.'),
    locked: (seconds: number) => `Sas verrouillé pendant ${seconds} secondes. On attend ensemble…`,
    unlocked: 'Le sas est rouvert. On réessaie ?',
    granted: (name: string) => `Accès autorisé ! En route, ${name}.`,
  },
  {
    greetAgain: 'There you are again! I was waiting for you. Sign in whenever you like.',
    greetFirst: 'Hello! I’m Nova. Sign in and I’ll take you to Terra Nova.',
    atmosphere: 'Hold on tight, we’re entering the atmosphere!',
    farewell: (name) => `See you soon, ${name}!`,
    welcomeToCity: (name) => `Welcome to Terra Nova, ${name}. I’m Nova, your guide. Scroll down and I’ll show you around.`,
    enterStreets: (site) => `Hold on tight, we’re taking off! Next stop: ${site}.`,
    leaveStreets: 'Back up we go!',
    flyToPoi: (site) => `Taking off! Next stop: ${site}.`,
    nudge: 'Shall we go on? Scroll down, I’ll show you what’s next.',
    reportSentAt: (code, place) => `Request ${code} sent! See the beam above ${place}? That’s it.`,
    reportSent: (code) => `Request ${code} sent!`,
    reportProgress: (status) => `Your request is moving: ${status.toLowerCase()}.`,
    alertOver: 'All clear. Everything is back to normal.',
    capsLock: 'Careful, caps lock is on.',
    refused: (left) => (left > 1 ? `That code doesn’t work. ${left} tries left.` : 'Refused… Careful, last try.'),
    locked: (seconds) => `Airlock locked for ${seconds} seconds. Let’s wait together…`,
    unlocked: 'The airlock is open again. Shall we try again?',
    granted: (name) => `Access granted! Off we go, ${name}.`,
  },
)

/** Nova's lines in the current language (always read when the line is said, never kept). */
const line = () => messagesFor(lines)

/** Runs `action` after `seconds`; returns the cancel (for an effect's cleanup). */
function after(seconds: number, action: () => void): () => void {
  const timer = setTimeout(action, seconds * 1000)
  return () => clearTimeout(timer)
}

/** The film's opening fade in the cockpit lasts 1.8 s: Nova turns to the visitor as it ends. */
const COCKPIT_GREETING_DELAY = 1.6
/** A step along the glare shield, towards the hologram, without walking under it (Nova heights). */
const STEP_TO_HOLOGRAM = 0.12

/** Nova has already met the visitor (a return to the airlock after logging out). */
let greeted = false
let pending: (() => void) | null = null
/** One follow-up at a time (a sad face after a refusal…): a new reaction replaces the previous one. */
function then(seconds: number, action: () => void) {
  pending?.()
  pending = after(seconds, action)
}

/**
 * Nova's moments of the visit, called by the pages. The pages say what happens; what Nova does and
 * says about it lives here.
 */
export const novaScenes = {
  /** the cockpit comes to light: Nova waves at the pilot (and stops talking when the entry begins) */
  greetPilot(): () => void {
    // back from the city: the goodbye ends with the fade to black
    nova.silence()
    const cancel = after(COCKPIT_GREETING_DELAY, () => {
      nova.gesture('wave')
      nova.say(greeted ? line().greetAgain : line().greetFirst, 'happy')
      greeted = true
    })
    return () => {
      cancel()
      nova.silence()
    }
  },

  /** the atmospheric entry: Nova turns to the canopy and braces on the glare shield until the cut */
  enterAtmosphere(reducedMotion: boolean): () => void {
    if (reducedMotion) return () => {}
    nova.hold('brace', true)
    nova.say(line().atmosphere, 'focused')
    return () => {
      nova.hold('brace', false)
      nova.silence()
    }
  },

  /** the visitor logs out: Nova waves goodbye before the fade */
  farewell(name: string): void {
    nova.gesture('wave')
    nova.say(line().farewell(name), 'happy')
  },

  /** the city interface has arrived: Nova walks into the frame, then welcomes the resident */
  welcomeToCity(name: string, reducedMotion: boolean): () => void {
    nova.silence()
    return after(reducedMotion ? 0.3 : CITY_ENTRANCE_SECONDS + 0.15, () => {
      nova.gesture('wave')
      nova.say(line().welcomeToCity(name), 'happy')
    })
  },

  /** the camera reached a district: Nova presents it, and introduces it the first time */
  presentDistrict(district: District, firstVisit: boolean): void {
    const intro = firstVisit ? districtIntro(district) : undefined
    if (intro) nova.say(intro, district.mood)
  },

  /** the visitor asks to explore: Nova takes off with them towards the first site */
  enterStreets(siteName: string): void {
    nova.say(line().enterStreets(siteName), 'focused')
  },

  /** back to the flyover: Nova shoots up into the sky */
  leaveStreets(): void {
    nova.say(line().leaveStreets, 'happy')
  },

  /** Nova takes off from a site towards another one */
  flyToPoi(name: string): void {
    nova.say(line().flyToPoi(name), 'focused')
  },

  /** Nova has landed on a site: it introduces it */
  landAtPoi(name: string, blurb: string): void {
    nova.say(`${name}. ${blurb}`, 'happy')
  },

  /** the visitor stopped scrolling halfway between two districts */
  nudge(): void {
    nova.gesture('wave')
    nova.say(line().nudge, 'happy')
  },

  /** a report was sent to the High Council. `place` is the district the beam rises over. */
  reportSent(code: string, place?: string): void {
    nova.gesture('celebrate')
    nova.say(place ? line().reportSentAt(code, place) : line().reportSent(code), 'happy')
  },

  /** the report's status moved on */
  reportProgress(status: string): void {
    nova.gesture('hop')
    nova.say(line().reportProgress(status), 'happy')
  },

  /** the High Council raised (or lifted) an alert */
  alert(on: boolean, instruction: string): void {
    nova.alert(on)
    if (on) nova.say(instruction, 'alarmed')
    else nova.say(line().alertOver, 'happy')
  },
  /** the visitor types their identifier: Nova steps closer and follows the caret letter by letter */
  watchTyping(caret: { x: number; y: number } | null): void {
    novaSignals.shift = STEP_TO_HOLOGRAM
    nova.hold('listen', true)
    if (caret) novaSignals.focus = caret
    nova.hear()
  },

  /** the identifier became a well-formed address */
  identifierLooksRight(): void {
    nova.emote('happy', 1.4)
  },

  /** the access code has the focus: hands over the eyes (or one eye peeking while it is shown) */
  hideEyes(on: boolean, peeking: boolean): void {
    novaSignals.shift = on ? STEP_TO_HOLOGRAM : novaSignals.shift
    novaSignals.focus = null
    nova.hold('listen', false)
    nova.hold('coverEyes', on && !peeking)
    nova.hold('peek', on && peeking)
  },

  /** a keystroke in the access code: a nervous little fidget */
  fidget(): void {
    nova.hear()
  },

  /** no field has the focus any more */
  stopWatching(): void {
    novaSignals.shift = 0
    novaSignals.focus = null
    nova.hold('listen', false)
    nova.hold('coverEyes', false)
    nova.hold('peek', false)
  },

  /** caps lock while typing the code: Nova points it out */
  capsLock(hint: { x: number; y: number } | null): void {
    if (hint) novaSignals.glance = { x: hint.x, y: hint.y, until: novaNow() + 1.4 }
    nova.emote('surprised', 1.2)
    nova.say(line().capsLock, 'surprised')
  },

  /** the code is being checked: Nova looks up, thinking (eyes uncovered) */
  checking(): void {
    nova.hold('coverEyes', false)
    nova.hold('peek', false)
    nova.hold('listen', false)
    nova.hold('think', true)
  },

  /** access refused: a shake of the head, then a sad face */
  refused(left: number): void {
    nova.hold('think', false)
    nova.gesture('refuse')
    nova.spotlight(1.6)
    nova.say(line().refused(left), 'denied')
    then(1.2, () => nova.emote('sad', 2.4))
  },

  /** five refusals: the airlock locks, Nova crosses its arms and taps its foot until it reopens */
  locked(seconds: number): void {
    nova.hold('think', false)
    nova.gesture('refuse')
    nova.spotlight(1.8)
    nova.say(line().locked(seconds), 'sad')
    then(1.1, () => nova.hold('sulk', true))
  },

  unlocked(): void {
    pending?.()
    nova.hold('sulk', false)
    nova.emote('happy', 1.5)
    nova.say(line().unlocked, 'happy')
  },

  /** access granted: Nova jumps for joy */
  granted(name: string): void {
    pending?.()
    novaScenes.stopWatching()
    nova.hold('think', false)
    nova.hold('sulk', false)
    nova.gesture('celebrate')
    nova.spotlight(1.5)
    nova.say(line().granted(name), 'happy')
  },

  /** leaving the airlock: nothing held any more */
  leaveAirlock(): void {
    pending?.()
    pending = null
    novaScenes.stopWatching()
    nova.hold('think', false)
    nova.hold('sulk', false)
  },
  /** Nova reaches the Observatory's balcony: a wave, the chat panel does the talking */
  arriveAtObservatory(): () => void {
    nova.silence()
    return after(1.2, () => nova.gesture('wave'))
  },

  /** the resident is typing to Nova: it leans in and listens, its visor following each keystroke */
  listen(on: boolean): void {
    nova.hold('listen', on)
  },

  /** Nova is working out its answer: hand on the chin, eyes up */
  ponder(on: boolean): void {
    if (on) nova.hold('listen', false)
    nova.hold('think', on)
  },

  /** Nova's reply streams in: it talks (the mouth moves, its hands go with the words) */
  answer(on: boolean): void {
    if (on) nova.hold('think', false)
    nova.talk(on)
  },

  /** the reply is complete: Nova shows how it feels about it, sometimes with a gesture */
  replied(emotion: Emotion, gesture?: 'wave' | 'celebrate' | 'hop'): void {
    nova.talk(false)
    // the gesture first: its own feeling must not cover the reply's
    if (gesture) nova.gesture(gesture)
    nova.emote(emotion, 3)
  },

  /** leaving the Observatory: nothing held any more */
  leaveObservatory(): void {
    nova.talk(false)
    nova.hold('think', false)
    nova.hold('listen', false)
  },
}
