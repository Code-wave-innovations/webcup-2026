/** What Nova says when the visitor clicks it (picked at random, never twice in a row). */
export const POKE_QUIPS: readonly string[] = [
  'Hé, ça chatouille !',
  'Je suis Nova. Je connais chaque recoin de Terra Nova.',
  'Bip. Bip bip. Pardon, je réfléchissais à voix haute.',
  "Ma visière n'est pas un bouton… mais j'aime bien.",
  'Encore une fois et je fais une pirouette.',
]

let last = -1

export function pickQuip(random: () => number = Math.random): string {
  let index = Math.floor(random() * POKE_QUIPS.length)
  if (index === last) index = (index + 1) % POKE_QUIPS.length
  last = index
  return POKE_QUIPS[index]
}
