// BO-04: a temporary password for a new staff account, generated in the browser and shown once
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
const SYMBOLS = '!#%+=?@'

export function temporaryPassword(length = 14): string {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length])
  // at least one digit and one symbol, at fixed random positions
  chars[bytes[0] % length] = String((bytes[1] % 8) + 2)
  chars[(bytes[2] % (length - 1)) + 1] = SYMBOLS[bytes[3] % SYMBOLS.length]
  return chars.join('')
}
