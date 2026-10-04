import { defineMessages, messagesFor, type Locale } from '../../../i18n'

/** What Nova says when the visitor clicks it (picked at random, never twice in a row). */
const quips = defineMessages(
  {
    poke: [
      'Hé, ça chatouille !',
      'Je suis Nova. Je connais chaque recoin de Terra Nova.',
      'Bip. Bip bip. Pardon, je réfléchissais à voix haute.',
      "Ma visière n'est pas un bouton… mais j'aime bien.",
      'Encore une fois et je fais une pirouette.',
    ],
  },
  {
    poke: [
      'Hey, that tickles!',
      'I’m Nova. I know every corner of Terra Nova.',
      'Beep. Beep beep. Sorry, I was thinking out loud.',
      'My visor isn’t a button… but I quite like it.',
      'Once more and I’ll do a pirouette.',
    ],
  },
)

/** Nova's lines when clicked, in `locale` (the current language by default). */
export const pokeQuips = (locale?: Locale): readonly string[] => messagesFor(quips, locale).poke

let last = -1

export function pickQuip(random: () => number = Math.random): string {
  const lines = pokeQuips()
  let index = Math.floor(random() * lines.length)
  if (index === last) index = (index + 1) % lines.length
  last = index
  return lines[index]
}
