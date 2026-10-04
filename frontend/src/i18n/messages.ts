import { currentLocale, useLocale, type Locale } from './locale'

/*
  Typed dictionaries, written next to the code that shows them:

    const messages = defineMessages(
      { title: 'Mes demandes', count: (n: number) => (n > 1 ? `${n} demandes` : `${n} demande`) },
      { title: 'My requests', count: (n) => (n === 1 ? '1 request' : `${n} requests`) },
    )
    const m = useMessages(messages)   // in a component: re-renders on a language switch
    const m = messagesFor(messages)   // outside React (stores, models, toasts)

  The English side must have exactly the French side's keys and signatures, so a missing
  translation is a type error. Plurals are written per language: French uses the singular
  for 0 and 1, English only for 1.
*/

type Message = string | readonly string[] | ((...args: never[]) => string)

export interface Messages {
  readonly [key: string]: Message | Messages
}

/** The shape a translation must follow: same keys, strings, string lists and function signatures. */
export type Translation<T> = T extends string
  ? string
  : T extends readonly string[]
    ? readonly string[]
    : T extends (...args: infer A) => string
      ? (...args: A) => string
      : { readonly [K in keyof T]: Translation<T[K]> }

export type Dictionary<T> = Readonly<Record<Locale, T>>

export function defineMessages<T extends Messages>(fr: T, en: Translation<T>): Dictionary<Translation<T>> {
  return { fr: fr as unknown as Translation<T>, en }
}

/** The dictionary in the visitor's language. */
export function useMessages<T>(dictionary: Dictionary<T>): T {
  return dictionary[useLocale()]
}

/** The dictionary in the current language, for code outside React components. */
export function messagesFor<T>(dictionary: Dictionary<T>, locale: Locale = currentLocale()): T {
  return dictionary[locale]
}
