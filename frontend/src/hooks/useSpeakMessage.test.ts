import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  localeToBcp47,
  pickVoice,
  resetSpeakMessageForTests,
  setSpeakMuted,
  speakMessage,
  stopSpeaking,
  unlockAudio,
} from './useSpeakMessage'

type FakeVoice = SpeechSynthesisVoice

function voice(partial: Pick<FakeVoice, 'lang' | 'name'> & Partial<FakeVoice>): FakeVoice {
  return {
    default: false,
    localService: true,
    voiceURI: partial.name,
    ...partial,
  } as FakeVoice
}

describe('localeToBcp47', () => {
  it('maps fr / en / mg', () => {
    expect(localeToBcp47('fr')).toBe('fr-FR')
    expect(localeToBcp47('en')).toBe('en-US')
    expect(localeToBcp47('mg')).toBe('mg-MG')
  })
})

describe('pickVoice', () => {
  const voices = [
    voice({ lang: 'en-GB', name: 'Google UK' }),
    voice({ lang: 'fr-FR', name: 'Thomas' }),
    voice({ lang: 'en-US', name: 'Samantha' }),
    voice({ lang: 'en-US', name: 'Zarvox' }),
    voice({ lang: 'en-US', name: 'Trinoids' }),
  ]

  it('prefers novelty robot voices over human locale voices', () => {
    expect(pickVoice(voices, 'fr')?.name).toBe('Trinoids')
    expect(pickVoice(voices, 'en')?.name).toBe('Trinoids')
  })

  it('falls back to locale voice when no robot is available', () => {
    const humans = [
      voice({ lang: 'fr-FR', name: 'Thomas' }),
      voice({ lang: 'en-US', name: 'Samantha' }),
    ]
    expect(pickVoice(humans, 'fr')?.name).toBe('Thomas')
  })

  it('returns null when nothing matches', () => {
    expect(pickVoice([], 'mg')).toBeNull()
  })
})

describe('speakMessage', () => {
  let speak: ReturnType<typeof vi.fn<(utterance: SpeechSynthesisUtterance) => void>>
  let cancel: ReturnType<typeof vi.fn<() => void>>
  let getVoices: ReturnType<typeof vi.fn<() => FakeVoice[]>>
  let playSpy: ReturnType<typeof vi.fn<() => Promise<void>>>
  let pauseSpy: ReturnType<typeof vi.fn<() => void>>
  let audioInstances: Array<{ src: string }>

  beforeEach(() => {
    resetSpeakMessageForTests()
    setSpeakMuted(false)

    speak = vi.fn<(utterance: SpeechSynthesisUtterance) => void>((utterance) => {
      queueMicrotask(() => utterance.onend?.(new Event('end') as SpeechSynthesisEvent))
    })
    cancel = vi.fn<() => void>()
    getVoices = vi.fn<() => FakeVoice[]>(() => [voice({ lang: 'fr-FR', name: 'Thomas' })])

    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class SpeechSynthesisUtteranceMock {
        text = ''
        lang = ''
        rate = 1
        pitch = 1
        voice: SpeechSynthesisVoice | null = null
        onend: ((ev: SpeechSynthesisEvent) => void) | null = null
        onerror: ((ev: SpeechSynthesisErrorEvent) => void) | null = null
        constructor(text?: string) {
          this.text = text ?? ''
        }
      },
    )

    Object.defineProperty(globalThis, 'speechSynthesis', {
      configurable: true,
      value: {
        speak,
        cancel,
        getVoices,
        paused: false,
        pending: false,
        speaking: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })

    playSpy = vi.fn<() => Promise<void>>(() => Promise.resolve())
    pauseSpy = vi.fn<() => void>()
    audioInstances = []

    vi.stubGlobal(
      'Audio',
      class AudioMock extends EventTarget {
        src: string
        currentTime = 0
        constructor(src?: string) {
          super()
          this.src = src ?? ''
          audioInstances.push(this)
        }
        play = (): Promise<void> => {
          const result = playSpy()
          queueMicrotask(() => this.dispatchEvent(new Event('ended')))
          return result
        }
        pause = (): void => {
          pauseSpy()
        }
      },
    )
  })

  afterEach(() => {
    stopSpeaking()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('speaks French via speechSynthesis', async () => {
    await speakMessage('Bonjour Terra Nova', 'fr')
    expect(cancel).toHaveBeenCalled()
    expect(speak).toHaveBeenCalledTimes(1)
    const utterance = speak.mock.calls[0]![0] as SpeechSynthesisUtterance
    expect(utterance.text).toBe('Bonjour Terra Nova')
    expect(utterance.lang).toBe('fr-FR')
    expect(utterance.rate).toBe(0.72)
    expect(utterance.pitch).toBe(0.68)
    expect(playSpy).not.toHaveBeenCalled()
  })

  it('does not play Malagasy audio without audioUrl', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await speakMessage('Salama', 'mg')
    expect(playSpy).not.toHaveBeenCalled()
    expect(speak).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('plays Malagasy audio when audioUrl is provided', async () => {
    await speakMessage('Salama', 'mg', { audioUrl: '/tts/arrivee.mg.wav' })
    expect(speak).not.toHaveBeenCalled()
    expect(audioInstances[0]?.src).toBe('/tts/arrivee.mg.wav')
    expect(playSpy).toHaveBeenCalledTimes(1)
  })

  it('stop cancels synthesis and pauses audio', async () => {
    const pending = speakMessage('Salama', 'mg', { audioUrl: '/tts/arrivee.mg.wav' })
    stopSpeaking()
    expect(cancel).toHaveBeenCalled()
    expect(pauseSpy).toHaveBeenCalled()
    await pending.catch(() => undefined)
  })

  it('skips speak when muted', async () => {
    setSpeakMuted(true)
    await speakMessage('Hello', 'en')
    expect(speak).not.toHaveBeenCalled()
  })

  it('unlock plays a silent audio element', async () => {
    await unlockAudio()
    expect(playSpy).toHaveBeenCalled()
  })
})
