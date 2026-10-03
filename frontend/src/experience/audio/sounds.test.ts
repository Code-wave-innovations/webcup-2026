import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/random'
import { INITIAL_BRAIN, reduceBrain, type BrainState, type NovaIntent } from '../nova/behavior/novaBrain'
import { EMOTIONS } from '../nova/face/faceState'
import { chirp, CUES, flightCue, flightMix, reactionSounds, syllable, syllableGap } from './sounds'

const after = (state: BrainState, intent: NovaIntent) => reduceBrain(state, intent, 1)

describe('sounds', () => {
  it('scores every cue with audible, bounded notes', () => {
    for (const [cue, notes] of Object.entries(CUES)) {
      expect(notes.length, cue).toBeGreaterThan(0)
      for (const note of notes) {
        expect(note.dur, cue).toBeGreaterThan(0)
        expect(note.gain, cue).toBeLessThanOrEqual(0.3)
        expect(note.freq, cue).toBeGreaterThan(20)
      }
    }
  })

  it('chirps higher and rising when happy, lower and falling when sad', () => {
    const happy = chirp('happy', createRandom(1))
    const sad = chirp('sad', createRandom(1))
    expect(happy.at(-1)!.freq).toBeGreaterThan(happy[0].freq)
    expect(sad.at(-1)!.freq).toBeLessThan(sad[0].freq)
    expect(Math.min(...happy.map((n) => n.freq))).toBeGreaterThan(Math.max(...sad.map((n) => n.freq)))
  })

  it('murmurs syllables in every mood, in a speaking rhythm', () => {
    const random = createRandom(7)
    for (const emotion of EMOTIONS) {
      const note = syllable(emotion, random)
      expect(note.freq).toBeGreaterThan(200)
      expect(note.dur).toBeLessThan(0.1)
    }
    const gaps = Array.from({ length: 200 }, () => syllableGap(random))
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(0.07)
    expect(Math.max(...gaps)).toBeLessThanOrEqual(0.24)
  })

  it('voices what Nova does: gestures, postures, new lines and the alert', () => {
    expect(reactionSounds(INITIAL_BRAIN, after(INITIAL_BRAIN, { type: 'gesture', gesture: 'refuse' }))).toEqual([{ cue: 'refused' }, { chirp: 'denied' }])
    expect(reactionSounds(INITIAL_BRAIN, after(INITIAL_BRAIN, { type: 'hold', hold: 'sulk', on: true }))).toEqual([{ cue: 'locked' }])
    expect(
      reactionSounds(
        INITIAL_BRAIN,
        after(INITIAL_BRAIN, {
          type: 'say',
          text: 'Bonjour',
          emotion: 'happy',
        }),
      ),
    ).toEqual([{ chirp: 'happy' }])
    expect(reactionSounds(INITIAL_BRAIN, after(INITIAL_BRAIN, { type: 'alert', on: true }))).toEqual([{ cue: 'alarm' }])
  })

  it('stays quiet when nothing new happens', () => {
    const waving = after(INITIAL_BRAIN, { type: 'gesture', gesture: 'wave' })
    expect(reactionSounds(waving, after(waving, { type: 'emote', emotion: 'sad' }))).toEqual([])
    expect(reactionSounds(waving, after(waving, { type: 'hold', hold: 'listen', on: true }))).toEqual([])
  })

  it('lets a gesture speak for the line that comes with it', () => {
    const both = after(after(INITIAL_BRAIN, { type: 'gesture', gesture: 'wave' }), { type: 'say', text: 'Salut' })
    expect(reactionSounds(INITIAL_BRAIN, both)).toEqual([{ chirp: 'happy' }])
  })

  it('roars at take-off and rushes faster with speed during the flight', () => {
    expect(flightMix('takeoff', 0.5).rumble).toBeGreaterThan(flightMix('crouch', 0).rumble)
    expect(flightMix('cruise', 1).wind).toBeGreaterThan(flightMix('cruise', 0.2).wind)
    for (const phase of ['crouch', 'takeoff', 'cruise', 'flare', 'landing'] as const) {
      for (const value of Object.values(flightMix(phase, 1))) expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('whooshes once when Nova leaves the ground and when it brakes', () => {
    expect(flightCue(null, 'crouch')).toBeNull()
    expect(flightCue('crouch', 'takeoff')).toBe('whoosh')
    expect(flightCue('takeoff', 'takeoff')).toBeNull()
    expect(flightCue('cruise', 'flare')).toBe('whoosh')
    expect(flightCue('landing', null)).toBeNull()
  })
})
