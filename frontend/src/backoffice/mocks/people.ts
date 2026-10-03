import type { District, User } from './types'
import { daysAgo, hoursAgo, minutesAgo } from './time'

export const DISTRICTS: District[] = [
  { id: 1, code: 'CENTRE', name: 'Centre-Ville' },
  { id: 2, code: 'NORD', name: 'Quartier Nord' },
  { id: 3, code: 'SUD', name: 'Quartier Sud' },
  { id: 4, code: 'EST', name: 'Quartier Est' },
  { id: 5, code: 'OUEST', name: 'Quartier Ouest' },
]

const user = (u: Partial<User> & Pick<User, 'id' | 'email' | 'name' | 'last_name' | 'role'>): User => ({
  phone: null,
  address: null,
  district_id: null,
  locale: 'fr',
  is_vulnerable: false,
  is_active: true,
  onboarding_completed: true,
  created_at: daysAgo(30),
  last_login_at: hoursAgo(5),
  ...u,
})

export const STAFF: User[] = [
  user({ id: 1, email: 'admin@novaterra.local', name: 'Ada', last_name: 'Ranaivo', role: 'ADMIN', last_login_at: minutesAgo(3) }),
  user({ id: 2, email: 'agent@novaterra.local', name: 'Alex', last_name: 'Rakoto', role: 'AGENT', last_login_at: minutesAgo(1) }),
  user({ id: 3, email: 'hanta.agent@novaterra.local', name: 'Hanta', last_name: 'Andria', role: 'AGENT', last_login_at: minutesAgo(26) }),
  user({ id: 4, email: 'tiana.agent@novaterra.local', name: 'Tiana', last_name: 'Rabe', role: 'AGENT', last_login_at: hoursAgo(3) }),
  user({ id: 5, email: 'noa.admin@novaterra.local', name: 'Noa', last_name: 'Fidy', role: 'ADMIN', last_login_at: daysAgo(1) }),
]

export const CITIZENS: User[] = [
  user({ id: 11, email: 'lucas.meyer@mail.nt', name: 'Lucas', last_name: 'Meyer', role: 'CITIZEN', phone: '+00 600 000', address: '12 rue du Réservoir', district_id: 3, created_at: daysAgo(9) }),
  user({ id: 12, email: 'jean.morel@mail.nt', name: 'Jean', last_name: 'Morel', role: 'CITIZEN', district_id: 2, is_vulnerable: true, address: '4 allée du Savoir', created_at: daysAgo(8) }),
  user({ id: 13, email: 'amina.rahal@mail.nt', name: 'Amina', last_name: 'Rahal', role: 'CITIZEN', district_id: 5, locale: 'en', phone: '+00 611 204', created_at: daysAgo(6) }),
  user({ id: 14, email: 'sophie.nguyen@mail.nt', name: 'Sophie', last_name: 'Nguyen', role: 'CITIZEN', district_id: 1, is_vulnerable: true, phone: '+00 622 781', created_at: daysAgo(6) }),
  user({ id: 15, email: 'marc.delcourt@mail.nt', name: 'Marc', last_name: 'Delcourt', role: 'CITIZEN', district_id: 4, created_at: daysAgo(5) }),
  user({ id: 16, email: 'pauline.r@mail.nt', name: 'Pauline', last_name: 'Ravelo', role: 'CITIZEN', district_id: 1, phone: '+00 633 019', address: '8 place du Conseil', created_at: daysAgo(5) }),
  user({ id: 17, email: 'miora.h@mail.nt', name: 'Miora', last_name: 'Haja', role: 'CITIZEN', district_id: 3, created_at: daysAgo(4), login_locked: true }),
  user({ id: 18, email: 'kevin.l@mail.nt', name: 'Kevin', last_name: 'Lalao', role: 'CITIZEN', district_id: 2, onboarding_completed: false, created_at: daysAgo(1), last_login_at: hoursAgo(20) }),
  user({ id: 19, email: 'fara.t@mail.nt', name: 'Fara', last_name: 'Tsiry', role: 'CITIZEN', district_id: 4, locale: 'mg', is_active: false, created_at: daysAgo(12), last_login_at: daysAgo(7) }),
  user({ id: 20, email: 'elio.v@mail.nt', name: 'Elio', last_name: 'Vony', role: 'CITIZEN', district_id: 5, created_at: hoursAgo(6), onboarding_completed: false, last_login_at: hoursAgo(6) }),
]

export const ALL_USERS: User[] = [...STAFF, ...CITIZENS]
