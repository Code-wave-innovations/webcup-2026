import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isSpeaking, isVoiceBusy, resetSpeechForTests, speakMessage, speechText, splitSentences, stopSpeaking, subscribeSpeaking, warmSpeech } from './useSpeakMessage'

describe('speechText', () => {
  it('drops emoji, markup and links, and collapses spaces', () => {
    expect(speechText('**Bonjour** 👋  Terra Nova ! https://nova.example/x')).toBe('Bonjour Terra Nova !')
    expect(speechText('Dôme 3 · ouvert')).toBe('Dôme 3, ouvert')
  })
})

describe('splitSentences', () => {
  it('cuts after each sentence, keeping French spacing before punctuation', () => {
    expect(splitSentences('Bonjour ! Je suis Nova. Prêt ?')).toEqual(['Bonjour !', 'Je suis Nova.', 'Prêt ?'])
  })

  it('keeps a text without final punctuation', () => {
    expect(splitSentences('On continue')).toEqual(['On continue'])
  })

  it('cuts a sentence longer than the limit at a space', () => {
    const chunks = splitSentences('un deux trois quatre cinq', 12)
    expect(chunks).toEqual(['un deux', 'trois quatre', 'cinq'])
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(12)
  })
})

describe('speakMessage', () => {
  /** every source the player was given, in order */
  let played: string[]
  /** sentences asked to Swiftask */
  let generated: string[]
  /** the Swiftask conversation each request went to */
  let sessions: Array<number | undefined>
  let speechStatus: number

  beforeEach(() => {
    resetSpeechForTests()
    played = []
    generated = []
    speechStatus = 200
    vi.stubGlobal(
      'Audio',
      class extends EventTarget {
        private current = ''
        get src() {
          return this.current
        }
        set src(value: string) {
          this.current = value
          played.push(value)
        }
        play = () => {
          setTimeout(() => this.dispatchEvent(new Event('ended')), 0)
          return Promise.resolve()
        }
        pause = () => {}
      },
    )
    sessions = []
    vi.stubEnv('SWIFTASK_API_KEY', 'test-key')
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        expect(url).toBe('https://graphql.swiftask.ai/api/ai/elevenlabs')
        expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-key')
        const body = JSON.parse(String(init.body))
        expect(body.extraConfig.voice).toBe('George')
        sessions.push(body.sessionId)
        generated.push(body.input)
        if (speechStatus !== 200) return Response.json({ error: 'down' }, { status: speechStatus })
        return Response.json({ sessionId: 7, files: [{ url: `https://files.example/${generated.length - 1}.mp3` }] })
      }),
    )
  })

  afterEach(() => {
    stopSpeaking()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("asks Nova's voice for every sentence at once and plays them in order", async () => {
    const changes: Array<[boolean, boolean]> = []
    const unsubscribe = subscribeSpeaking(() => changes.push([isSpeaking(), isVoiceBusy()]))
    await speakMessage('Bonjour ! Je suis **Nova**.')
    expect(generated).toEqual(['Bonjour !', 'Je suis Nova.'])
    expect(played).toEqual(['https://files.example/0.mp3', 'https://files.example/1.mp3'])
    expect(isSpeaking()).toBe(false)
    expect(isVoiceBusy()).toBe(false)
    expect(changes.at(0)).toEqual([false, true])
    expect(changes).toContainEqual([true, true])
    unsubscribe()
  })

  it('remembers recordings in the browser and keeps lines in one Swiftask conversation', async () => {
    await speakMessage('Bonjour !')
    resetSpeechForTests()
    await speakMessage('Bonjour ! Encore vous.')
    expect(generated).toEqual(['Bonjour !', 'Encore vous.'])
    expect(sessions).toEqual([undefined, 7])
  })

  it('stays silent without an API key', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('SWIFTASK_API_KEY', '')
    await speakMessage('Bonjour.')
    expect(generated).toEqual([])
    expect(played).toEqual([])
  })

  it('reuses a sentence already recorded in this tab', async () => {
    await speakMessage('Bonjour !')
    await speakMessage('Bonjour ! Encore vous.')
    expect(generated).toEqual(['Bonjour !', 'Encore vous.'])
    expect(played).toEqual(['https://files.example/0.mp3', 'https://files.example/0.mp3', 'https://files.example/1.mp3'])
  })

  it('a new line interrupts the previous one', async () => {
    const first = speakMessage('Première ligne.')
    const second = speakMessage('Deuxième ligne.')
    await Promise.all([first, second])
    expect(played).toEqual(['https://files.example/1.mp3'])
  })

  it('stop silences at once', async () => {
    const reading = speakMessage('Une longue phrase.')
    stopSpeaking()
    expect(isVoiceBusy()).toBe(false)
    await reading
    expect(played).toEqual([])
  })

  it("says a line refused before the visitor's first click at that click", async () => {
    vi.stubGlobal('document', new EventTarget())
    let allowed = false
    vi.stubGlobal(
      'Audio',
      class extends EventTarget {
        set src(value: string) {
          played.push(value)
        }
        play = () => {
          if (!allowed) return Promise.reject(new DOMException('no gesture yet', 'NotAllowedError'))
          setTimeout(() => this.dispatchEvent(new Event('ended')), 0)
          return Promise.resolve()
        }
        pause = () => {}
      },
    )
    await speakMessage('Bonjour !')
    expect(isVoiceBusy()).toBe(false)
    allowed = true
    document.dispatchEvent(new Event('pointerdown'))
    await vi.waitFor(() => expect(played.filter((src) => src.startsWith('https:'))).toEqual(['https://files.example/0.mp3', 'https://files.example/0.mp3']))
  })

  it('stays silent when the voice cannot be had (no other voice), and tries again next time', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    speechStatus = 503
    await speakMessage('Bonjour.')
    expect(played).toEqual([])
    expect(isVoiceBusy()).toBe(false)
    speechStatus = 200
    await speakMessage('Bonjour.')
    expect(played).toEqual(['https://files.example/0.mp3'])
  })

  it('stays silent on an empty text', async () => {
    await speakMessage('  👋 ')
    expect(generated).toEqual([])
  })

  it('plays a recording when given one', async () => {
    await speakMessage('Salama', { audioUrl: '/tts/arrivee.mg.wav' })
    expect(played).toEqual(['/tts/arrivee.mg.wav'])
    expect(generated).toEqual([])
  })

  it('warms lines ahead: each sentence generated once, then played without waiting', async () => {
    await warmSpeech(['Hé, ça chatouille !', 'Bip. Bip bip.', 'Hé, ça chatouille !'])
    expect(generated).toEqual(['Hé, ça chatouille !', 'Bip.', 'Bip bip.'])
    expect(played).toEqual([])
    await speakMessage('Bip.')
    expect(generated).toHaveLength(3)
  })
})
