import { describe, expect, it } from 'vitest'
import { INITIAL_BRAIN, reduceBrain, resolvePose, speechProgress, type BrainState, type NovaIntent } from './novaBrain'

const run = (intents: Array<[number, NovaIntent]>, from: BrainState = INITIAL_BRAIN) => intents.reduce((s, [t, i]) => reduceBrain(s, i, t), from)

describe('novaBrain', () => {
  it('idles, floating, looking at the visitor', () => {
    const pose = resolvePose(INITIAL_BRAIN, 0)
    expect(pose).toMatchObject({ clip: 'idle', once: false, emotion: 'neutral', lookAtTarget: true, floating: true })
  })

  it('plays a wave once with a happy face, then returns to idle when the clip ends', () => {
    const waving = run([[1, { type: 'gesture', gesture: 'wave' }]])
    expect(resolvePose(waving, 1.5)).toMatchObject({ clip: 'wave', once: true, emotion: 'happy' })
    const done = reduceBrain(waving, { type: 'gestureEnded', id: waving.gesture!.id }, 2.9)
    expect(resolvePose(done, 3).clip).toBe('idle')
  })

  it('ignores the end of a gesture that was replaced', () => {
    const first = run([[0, { type: 'gesture', gesture: 'wave' }]])
    const second = reduceBrain(first, { type: 'gesture', gesture: 'celebrate' }, 0.5)
    const stale = reduceBrain(second, { type: 'gestureEnded', id: first.gesture!.id }, 0.6)
    expect(resolvePose(stale, 0.7).clip).toBe('celebrate')
  })

  it('drops a gesture that never reports its end', () => {
    const stuck = run([[0, { type: 'gesture', gesture: 'point' }]])
    expect(resolvePose(stuck, 6).clip).toBe('idle')
  })

  it('keeps the hands over the eyes while the password field has focus, and lets a refusal play over it', () => {
    const hiding = run([[0, { type: 'hold', hold: 'coverEyes', on: true }]])
    expect(resolvePose(hiding, 1)).toMatchObject({ clip: 'coverEyes', eyesHidden: 'both', lookAtTarget: false })
    const refused = reduceBrain(hiding, { type: 'gesture', gesture: 'refuse' }, 2)
    expect(resolvePose(refused, 2.2)).toMatchObject({ clip: 'shakeHead', emotion: 'denied' })
    const done = reduceBrain(refused, { type: 'gestureEnded', id: refused.gesture!.id }, 3)
    expect(resolvePose(done, 3).clip).toBe('coverEyes')
    expect(resolvePose(reduceBrain(done, { type: 'hold', hold: 'coverEyes', on: false }, 4), 4).clip).toBe('idle')
  })

  it('holds the most important posture when several are active', () => {
    const state = run([
      [0, { type: 'hold', hold: 'listen', on: true }],
      [0, { type: 'hold', hold: 'brace', on: true }],
      [0, { type: 'hold', hold: 'think', on: true }],
    ])
    expect(resolvePose(state, 1)).toMatchObject({ clip: 'brace', emotion: 'focused', floating: false })
  })

  it('talks while the bubble types, then the text lingers without the mouth moving', () => {
    const text = 'Bienvenue à Terra Nova.'
    const state = run([[10, { type: 'say', text, emotion: 'happy' }]])
    expect(resolvePose(state, 10.2)).toMatchObject({ clip: 'talk', talking: true, emotion: 'happy' })
    const typed = 10 + text.length / state.speech!.rate + 0.1
    expect(speechProgress(state.speech, typed)).toMatchObject({ shown: text.length, talking: false, visible: true })
    expect(resolvePose(state, typed).clip).toBe('idle')
    expect(speechProgress(state.speech, typed + 10).visible).toBe(false)
  })

  it('looks alarmed during an alert, unless a stronger feeling is showing', () => {
    const alert = run([[0, { type: 'alert', on: true }]])
    expect(resolvePose(alert, 1).emotion).toBe('alarmed')
    const happy = reduceBrain(alert, { type: 'emote', emotion: 'happy', seconds: 1 }, 2)
    expect(resolvePose(happy, 2.5).emotion).toBe('happy')
    expect(resolvePose(happy, 3.5).emotion).toBe('alarmed')
  })

  it('walks with its feet on the ground', () => {
    expect(resolvePose(run([[0, { type: 'walk', on: true }]]), 1)).toMatchObject({ clip: 'walk', floating: false })
  })

  it('lowers the presenting arm to walk, and raises it again when it stops', () => {
    const presenting = run([[0, { type: 'hold', hold: 'present', on: true }]])
    expect(resolvePose(presenting, 1).clip).toBe('present')
    const walking = reduceBrain(presenting, { type: 'walk', on: true }, 1)
    expect(resolvePose(walking, 1).clip).toBe('walk')
    expect(resolvePose(reduceBrain(walking, { type: 'walk', on: false }, 2), 2).clip).toBe('present')
  })

  it('talks without a bubble while a chat reply streams in', () => {
    const talking = reduceBrain(INITIAL_BRAIN, { type: 'talk', on: true }, 0)
    expect(resolvePose(talking, 1)).toMatchObject({ clip: 'talk', talking: true })
    expect(talking.speech).toBeNull()
    expect(resolvePose(reduceBrain(talking, { type: 'talk', on: false }, 1), 2).clip).toBe('idle')
  })
})
