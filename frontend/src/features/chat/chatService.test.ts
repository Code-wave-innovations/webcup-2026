import { describe, expect, it } from 'vitest'
import type { ChatChunk } from './chatModel'
import { scriptedReply } from './chatScript'
import { createScriptedChatService } from './chatService'

const context = { name: 'Miora' }
const instant = createScriptedChatService({ wait: async () => {}, random: () => 0.5 })

async function collect(stream: AsyncIterable<ChatChunk>) {
  const chunks: ChatChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

describe('chat script', () => {
  it('answers the suggestions, whatever the accents and case', () => {
    expect(scriptedReply('Où en est ma demande TN-0416 ?', context).text).toContain('TN-0416')
    expect(scriptedReply('QUELS SERVICES sont ouverts ?', context).text).toContain('clinique')
    expect(scriptedReply('Raconte-moi Terra Nova', context).text).toContain('Miora')
    expect(scriptedReply('Sécurité ?', context).text).toContain('Aucune alerte')
  })

  it('answers the English suggestions in English', () => {
    expect(scriptedReply('Where is my request TN-0416?', context, 'en').text).toContain('being handled')
    expect(scriptedReply('Which services are open tonight?', context, 'en').text).toContain('clinic')
    expect(scriptedReply('Tell me about Terra Nova', context, 'en').text).toContain('Miora')
    expect(scriptedReply('Is it safe? Any emergency?', context, 'en').text).toContain('No alerts')
    expect(scriptedReply('Thanks Nova', context, 'en')).toMatchObject({ gesture: 'celebrate' })
    expect(scriptedReply('What do they eat?', context, 'en')).toMatchObject({ emotion: 'sad' })
  })

  it('says honestly when it does not know yet', () => {
    expect(scriptedReply('Quelle est la recette du gâteau ?', context)).toMatchObject({ emotion: 'sad' })
  })
})

describe('scripted chat service', () => {
  it('thinks, streams the reply word by word, then says how Nova feels', async () => {
    const chunks = await collect(instant.reply([{ id: 1, role: 'resident', text: 'Bonjour Nova' }], context, new AbortController().signal))
    expect(chunks[0]).toEqual({ type: 'thinking' })
    const text = chunks.flatMap((c) => (c.type === 'text' ? [c.text] : [])).join('')
    expect(text).toBe(scriptedReply('Bonjour', context).text)
    expect(chunks.length).toBeGreaterThan(10)
    expect(chunks.at(-1)).toEqual({ type: 'done', emotion: 'happy', gesture: 'wave' })
  })

  it('stops when the resident interrupts', async () => {
    const controller = new AbortController()
    const service = createScriptedChatService({
      wait: async (_, signal) => {
        if (signal.aborted) throw new Error('aborted')
      },
    })
    const chunks: ChatChunk[] = []
    await expect(async () => {
      for await (const chunk of service.reply([{ id: 1, role: 'resident', text: 'merci' }], context, controller.signal)) {
        chunks.push(chunk)
        if (chunks.length === 3) controller.abort()
      }
    }).rejects.toThrow()
    expect(chunks.some((c) => c.type === 'done')).toBe(false)
  })
})
