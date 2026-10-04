import { describe, expect, it } from 'vitest'
import { useLocaleStore } from './locale'
import { defineMessages, messagesFor } from './messages'

const messages = defineMessages(
  { title: 'Mes demandes', count: (n: number) => (n > 1 ? `${n} demandes` : `${n} demande`), list: ['un', 'deux'] },
  { title: 'My requests', count: (n) => (n === 1 ? '1 request' : `${n} requests`), list: ['one', 'two'] },
)

describe('defineMessages', () => {
  it('serves the dictionary of the requested language', () => {
    expect(messagesFor(messages, 'fr').count(0)).toBe('0 demande')
    expect(messagesFor(messages, 'en').count(0)).toBe('0 requests')
    expect(messagesFor(messages, 'en').list[1]).toBe('two')
  })

  it('follows the chosen language by default, French first', () => {
    expect(messagesFor(messages).title).toBe('Mes demandes')
    useLocaleStore.getState().setLocale('en')
    expect(messagesFor(messages).title).toBe('My requests')
    useLocaleStore.getState().setLocale('fr')
  })
})
