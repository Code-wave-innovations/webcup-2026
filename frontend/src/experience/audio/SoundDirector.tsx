import { useEffect } from 'react'
import { createRandom } from '../../lib/random'
import type { FlightPhase } from '../city/explore/flightPath'
import { director } from '../director/director'
import { useDirectorStore } from '../director/directorStore'
import { speechProgress } from '../nova/behavior/novaBrain'
import { isSpeaking, isVoiceBusy, speakMessage, stopSpeaking, subscribeSpeaking, unlockSpeech, warmSpeech } from '../../hooks/useSpeakMessage'
import { DISTRICTS } from '../city/districts'
import { POKE_QUIPS } from '../nova/behavior/quips'
import { nova, novaNow, useNovaStore } from '../nova/behavior/novaStore'
import { soundEngine } from './soundEngine'
import { useSoundStore } from './soundStore'
import { flightCue, flightMix, reactionSounds, syllable, syllableGap } from './sounds'

const INTERACTIVE = 'button:not([disabled]), a[href], [role="button"], summary, select'
const TYPING = 'input, textarea'
const HOVER_EVERY = 70
const KEY_EVERY = 25

/**
 * Plays the film with sound once the visitor allows it. Nothing here is called by the features: Nova's
 * state of mind gives its voice (each reaction is already a gesture, a posture or a line, read aloud), the director
 * gives the ambience, and the DOM gives the interface clicks.
 */
export function SoundDirector() {
  const enabled = useSoundStore((s) => s.enabled)

  useEffect(() => {
    soundEngine.setEnabled(enabled)
    if (!enabled) return

    // Nova's voice: a chirp per reaction, and each line of its bubble read aloud
    const unsubscribe = useNovaStore.subscribe((next, prev) => {
      for (const sound of reactionSounds(prev.brain, next.brain)) {
        if ('cue' in sound) soundEngine.cue(sound.cue)
        else soundEngine.chirp(sound.chirp)
      }
      const line = next.brain.speech
      if (line && line.id !== prev.brain.speech?.id) void speakMessage(line.text)
      else if (!line && prev.brain.speech) stopSpeaking()
    })
    // its mouth moves for as long as a recording plays
    let mouth = isSpeaking()
    const unsubscribeVoice = subscribeSpeaking(() => {
      if (mouth === isSpeaking()) return
      mouth = isSpeaking()
      nova.talk(mouth)
    })
    // the lines of the visit are generated ahead, so that they play as soon as they are said
    void warmSpeech([...DISTRICTS.flatMap((d) => (d.intro ? [d.intro] : [])), ...POKE_QUIPS])

    // the interface: a glass tick on hover and press, a soft click per keystroke
    let hovered: Element | null = null
    let lastHover = 0
    let lastKey = 0
    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const target = (event.target as Element | null)?.closest(INTERACTIVE) ?? null
      if (target === hovered) return
      hovered = target
      if (target && event.timeStamp - lastHover > HOVER_EVERY) {
        lastHover = event.timeStamp
        soundEngine.cue('hover')
      }
    }
    const onDown = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest(INTERACTIVE)) soundEngine.cue('tap')
    }
    const onKey = (event: KeyboardEvent) => {
      if (!(event.target as Element | null)?.matches?.(TYPING)) return
      if (event.key.length !== 1 && event.key !== 'Backspace') return
      if (event.timeStamp - lastKey < KEY_EVERY) return
      lastKey = event.timeStamp
      soundEngine.cue('key')
    }
    const onVisibility = () => soundEngine.pause(document.hidden)
    // sound starts on, so the first gesture (not only the Son switch) unlocks Nova's voice
    const onUnlock = () => unlockSpeech()
    document.addEventListener('pointerover', onOver, { passive: true })
    document.addEventListener('pointerdown', onDown, {
      passive: true,
      capture: true,
    })
    document.addEventListener('pointerdown', onUnlock, { once: true, capture: true })
    document.addEventListener('keydown', onKey, {
      passive: true,
      capture: true,
    })
    document.addEventListener('keydown', onUnlock, { once: true, capture: true })
    document.addEventListener('visibilitychange', onVisibility)

    // the film's ambience, and Nova murmuring while it speaks
    const random = createRandom(31)
    let nextSyllable = 0
    let flying: FlightPhase | null = null
    let frame = requestAnimationFrame(function loop() {
      frame = requestAnimationFrame(loop)
      const { phase } = useDirectorStore.getState()
      const cues = director.cues
      const night = director.observatory
      if (phase === 'approach') {
        soundEngine.setBed('drone', 1)
        soundEngine.setBed('rumble', 0)
        soundEngine.setBed('wind', 0)
      } else if (phase === 'entry') {
        soundEngine.setBed('drone', 1 - cues.veil)
        soundEngine.setBed('rumble', Math.max(cues.shake, cues.plasma, cues.rush * 0.4), cues.plasma)
        soundEngine.setBed('wind', cues.speedBlur, cues.speedBlur)
      } else if (director.flight) {
        // Nova's flight over the city: thrust and rushing air follow its speed
        const { phase: stage, speed } = director.flight
        const mix = flightMix(stage, speed)
        soundEngine.setBed('drone', 0)
        soundEngine.setBed('rumble', mix.rumble, mix.rumbleTone)
        soundEngine.setBed('wind', mix.wind, mix.windTone)
      } else {
        // the descent fades into the breeze of the city; the Observatory adds the hum of the night
        const descent = phase === 'descent' ? 1 - cues.arrival : 0
        soundEngine.setBed('drone', night * 0.35)
        soundEngine.setBed('rumble', (1 - cues.clouds) * 0.5, 0.3)
        soundEngine.setBed('wind', 0.22 + descent * 0.7, descent)
      }

      const stage = director.flight?.phase ?? null
      const cue = flightCue(flying, stage)
      if (cue) soundEngine.cue(cue)
      flying = stage

      const now = novaNow()
      const { brain } = useNovaStore.getState()
      const talking = speechProgress(brain.speech, now).talking || brain.talking
      // the murmurs keep quiet while Nova's voice is on its way or playing
      if (!talking || isVoiceBusy()) nextSyllable = now + 0.05
      else if (now >= nextSyllable) {
        soundEngine.play([syllable(brain.speech?.emotion ?? brain.emotion, random)])
        nextSyllable = now + syllableGap(random)
      }
    })

    return () => {
      unsubscribe()
      // silenced before unsubscribing, so that the mouth stops too
      stopSpeaking()
      unsubscribeVoice()
      cancelAnimationFrame(frame)
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerdown', onDown, { capture: true })
      document.removeEventListener('pointerdown', onUnlock, { capture: true })
      document.removeEventListener('keydown', onKey, { capture: true })
      document.removeEventListener('keydown', onUnlock, { capture: true })
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled])

  return null
}
