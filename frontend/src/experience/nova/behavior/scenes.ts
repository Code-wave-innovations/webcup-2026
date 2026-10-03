import type { District } from '../../city/districts'
import type { Emotion } from '../face/faceState'
import { CITY_ENTRANCE_SECONDS } from '../stage/placement'
import { nova, novaNow, novaSignals } from './novaStore'

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
      nova.say(greeted ? 'Vous revoilà ! Je vous attendais. Identifiez-vous quand vous voulez.' : 'Bonjour ! Je suis Nova. Identifiez-vous, je vous emmène à Terra Nova.', 'happy')
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
    nova.say('Accrochez-vous, on entre dans l’atmosphère !', 'focused')
    return () => {
      nova.hold('brace', false)
      nova.silence()
    }
  },

  /** the visitor logs out: Nova waves goodbye before the fade */
  farewell(name: string): void {
    nova.gesture('wave')
    nova.say(`À bientôt, ${name} !`, 'happy')
  },

  /** the city interface has arrived: Nova walks into the frame, then welcomes the resident */
  welcomeToCity(name: string, reducedMotion: boolean): () => void {
    nova.silence()
    return after(reducedMotion ? 0.3 : CITY_ENTRANCE_SECONDS + 0.15, () => {
      nova.gesture('wave')
      nova.say(`Bienvenue à Terra Nova, ${name}. Je suis Nova, votre guide. Faites défiler, je vous fais visiter.`, 'happy')
    })
  },

  /** the camera reached a district: Nova presents it, and introduces it the first time */
  presentDistrict(district: District, firstVisit: boolean): void {
    if (firstVisit && district.intro) nova.say(district.intro, district.mood)
  },

  /** the visitor asks to explore: Nova takes off with them towards the first site */
  enterStreets(siteName: string): void {
    nova.say(`Accrochez-vous, on décolle ! Destination : ${siteName}.`, 'focused')
  },

  /** back to the flyover: Nova shoots up into the sky */
  leaveStreets(): void {
    nova.say('On remonte !', 'happy')
  },

  /** Nova takes off from a site towards another one */
  flyToPoi(name: string): void {
    nova.say(`On décolle ! Destination : ${name}.`, 'focused')
  },

  /** Nova has landed on a site: it introduces it */
  landAtPoi(name: string, blurb: string): void {
    nova.say(`${name}. ${blurb}`, 'happy')
  },

  /** the visitor stopped scrolling halfway between two districts */
  nudge(): void {
    nova.gesture('wave')
    nova.say('On continue ? Faites défiler, je vous montre la suite.', 'happy')
  },

  /** a report was sent to the High Council */
  reportSent(code: string): void {
    nova.gesture('celebrate')
    nova.say(`Demande ${code} envoyée ! Le faisceau au-dessus du Dôme 3, c'est elle.`, 'happy')
  },

  /** the report's status moved on */
  reportProgress(status: string): void {
    nova.gesture('hop')
    nova.say(`Votre demande avance : ${status.toLowerCase()}.`, 'happy')
  },

  /** the High Council raised (or lifted) an alert */
  alert(on: boolean, instruction: string): void {
    nova.alert(on)
    if (on) nova.say(instruction, 'alarmed')
    else nova.say("Fin d'alerte. Tout est rentré dans l'ordre.", 'happy')
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
    nova.say('Attention, les majuscules sont activées.', 'surprised')
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
    nova.say(left > 1 ? `Ce code ne passe pas. Encore ${left} essais.` : 'Refusé… Attention, dernier essai.', 'denied')
    then(1.2, () => nova.emote('sad', 2.4))
  },

  /** five refusals: the airlock locks, Nova crosses its arms and taps its foot until it reopens */
  locked(seconds: number): void {
    nova.hold('think', false)
    nova.gesture('refuse')
    nova.spotlight(1.8)
    nova.say(`Sas verrouillé pendant ${seconds} secondes. On attend ensemble…`, 'sad')
    then(1.1, () => nova.hold('sulk', true))
  },

  unlocked(): void {
    pending?.()
    nova.hold('sulk', false)
    nova.emote('happy', 1.5)
    nova.say('Le sas est rouvert. On réessaie ?', 'happy')
  },

  /** access granted: Nova jumps for joy */
  granted(name: string): void {
    pending?.()
    novaScenes.stopWatching()
    nova.hold('think', false)
    nova.hold('sulk', false)
    nova.gesture('celebrate')
    nova.spotlight(1.5)
    nova.say(`Accès autorisé ! En route, ${name}.`, 'happy')
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
