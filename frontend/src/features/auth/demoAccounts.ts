export type Role = 'resident' | 'council'

export interface Account {
  /** short identifier, still accepted at the airlock */
  id: string
  email: string
  code: string
  name: string
  roleLabel: string
  role: Role
}

/** Demo accounts of the prototype: a resident and a member of the High Council. */
export const DEMO_ACCOUNTS = {
  miora: { id: 'miora', email: 'miora@terra-nova.city', code: 'TN-2140', name: 'Miora', roleLabel: 'Habitante', role: 'resident' },
  conseil: { id: 'conseil', email: 'koto@terra-nova.city', code: 'HC-0001', name: 'Koto', roleLabel: 'Haut Conseil', role: 'council' },
} as const satisfies Record<string, Account>

export type DemoAccountId = keyof typeof DEMO_ACCOUNTS
