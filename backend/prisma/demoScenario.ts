// Demo scenario of the platform: staff, citizens, requests with their timeline, appointments,
// announcements, alerts, interruptions, login attempts and notifications. It mirrors the
// back-office mockups (frontend/src/backoffice/mocks) so the screens stay as telling once bound
// to the API. Dates are relative to the moment the seed runs.
import type { AppointmentStatus, PrismaClient, Prisma, RequestPriority, RequestStatus, RequestType, Role } from "@prisma/client";

type Ids = Record<string, number>;

export interface ScenarioRefs {
  passwordHash: string;
  districtIds: Ids;
  serviceIds: Ids;
  procedureIds: Ids;
  reset: boolean;
}

const NOW = Date.now();
const MINUTE = 60_000;
const minutesAgo = (minutes: number) => new Date(NOW - minutes * MINUTE);
const daysAgo = (days: number) => minutesAgo(days * 24 * 60);

// ─── Accounts ───────────────────────────────────────────────────────────────

interface AccountSeed {
  email: string;
  name: string;
  last_name: string;
  role: Role;
  district?: string;
  phone?: string;
  address?: string;
  locale?: string;
  is_vulnerable?: boolean;
  is_active?: boolean;
  onboarding_completed?: boolean;
  createdDaysAgo: number;
  lastLoginMinutesAgo?: number;
}

export const ACCOUNTS: AccountSeed[] = [
  { email: "admin@novaterra.local", name: "Ada", last_name: "Ranaivo", role: "ADMIN", createdDaysAgo: 30, lastLoginMinutesAgo: 3 },
  { email: "agent@novaterra.local", name: "Alex", last_name: "Rakoto", role: "AGENT", createdDaysAgo: 30, lastLoginMinutesAgo: 1 },
  { email: "hanta.agent@novaterra.local", name: "Hanta", last_name: "Andria", role: "AGENT", createdDaysAgo: 28, lastLoginMinutesAgo: 26 },
  { email: "tiana.agent@novaterra.local", name: "Tiana", last_name: "Rabe", role: "AGENT", createdDaysAgo: 28, lastLoginMinutesAgo: 180 },
  { email: "noa.admin@novaterra.local", name: "Noa", last_name: "Fidy", role: "ADMIN", createdDaysAgo: 30, lastLoginMinutesAgo: 1440 },
  {
    email: "citoyen@novaterra.local", name: "Lucas", last_name: "Meyer", role: "CITIZEN", district: "SUD",
    phone: "+00 600 000", address: "12 rue du Réservoir", createdDaysAgo: 9, lastLoginMinutesAgo: 300,
  },
  {
    email: "senior@novaterra.local", name: "Jean", last_name: "Morel", role: "CITIZEN", district: "NORD",
    address: "4 allée du Savoir", is_vulnerable: true, createdDaysAgo: 8, lastLoginMinutesAgo: 300,
  },
  { email: "amina.rahal@mail.nt", name: "Amina", last_name: "Rahal", role: "CITIZEN", district: "OUEST", locale: "en", phone: "+00 611 204", createdDaysAgo: 6, lastLoginMinutesAgo: 300 },
  { email: "sophie.nguyen@mail.nt", name: "Sophie", last_name: "Nguyen", role: "CITIZEN", district: "CENTRE", is_vulnerable: true, phone: "+00 622 781", createdDaysAgo: 6, lastLoginMinutesAgo: 300 },
  { email: "marc.delcourt@mail.nt", name: "Marc", last_name: "Delcourt", role: "CITIZEN", district: "EST", createdDaysAgo: 5, lastLoginMinutesAgo: 300 },
  {
    email: "pauline.ravelo@mail.nt", name: "Pauline", last_name: "Ravelo", role: "CITIZEN", district: "CENTRE",
    phone: "+00 633 019", address: "8 place du Conseil", createdDaysAgo: 5, lastLoginMinutesAgo: 300,
  },
  // F37: locked by repeated failed logins (see seedLoginAttempts)
  { email: "miora.haja@mail.nt", name: "Miora", last_name: "Haja", role: "CITIZEN", district: "SUD", createdDaysAgo: 4, lastLoginMinutesAgo: 2880 },
  { email: "kevin.lalao@mail.nt", name: "Kevin", last_name: "Lalao", role: "CITIZEN", district: "NORD", onboarding_completed: false, createdDaysAgo: 1, lastLoginMinutesAgo: 1200 },
  { email: "fara.tsiry@mail.nt", name: "Fara", last_name: "Tsiry", role: "CITIZEN", district: "EST", locale: "mg", is_active: false, createdDaysAgo: 12, lastLoginMinutesAgo: 10080 },
  { email: "elio.vony@mail.nt", name: "Elio", last_name: "Vony", role: "CITIZEN", district: "OUEST", onboarding_completed: false, createdDaysAgo: 0.25, lastLoginMinutesAgo: 360 },
];

async function seedAccounts(prisma: PrismaClient, refs: ScenarioRefs): Promise<Ids> {
  const userIds: Ids = {};
  for (const account of ACCOUNTS) {
    const profile = {
      name: account.name,
      last_name: account.last_name,
      role: account.role,
      phone: account.phone ?? null,
      address: account.address ?? null,
      district_id: account.district ? refs.districtIds[account.district] : null,
      locale: account.locale ?? "fr",
      is_vulnerable: account.is_vulnerable ?? false,
      is_active: account.is_active ?? true,
      onboarding_completed: account.onboarding_completed ?? true,
      last_login_at: account.lastLoginMinutesAgo === undefined ? null : minutesAgo(account.lastLoginMinutesAgo),
    };
    const row = await prisma.user.upsert({
      where: { email: account.email },
      create: { email: account.email, password_hash: refs.passwordHash, created_at: daysAgo(account.createdDaysAgo), ...profile },
      // Without a reset, only the role is enforced so changes made while testing are kept
      update: refs.reset ? { ...profile, password_hash: refs.passwordHash } : { role: account.role },
    });
    userIds[account.email] = row.id;
  }
  return userIds;
}

// ─── Citizen requests (D04, D11, F22, F25, F26) ─────────────────────────────

interface RequestSeed {
  n: number;
  type: RequestType;
  status: RequestStatus;
  priority: RequestPriority;
  subject: string;
  message: string;
  citizen: string | null;
  ageMinutes: number;
  service?: string;
  procedure?: string;
  agent?: string;
  category?: string;
  district?: string;
  location?: string;
  coords?: [number, number];
  contact?: [string, string];
  data?: Record<string, string>;
  comment?: { atRatio: number; by: string; message: string; internal?: boolean };
}

const STATUS_NOTES: Partial<Record<RequestStatus, string>> = {
  IN_REVIEW: "Votre demande est en cours d'examen.",
  IN_PROGRESS: "Une équipe a été mandatée.",
  WAITING_CITIZEN: "Pouvez-vous nous transmettre une photo ou une précision ?",
  RESOLVED: "Intervention terminée, merci pour votre signalement.",
  REJECTED: "Cette demande ne relève pas des services municipaux.",
  CLOSED: "Demande clôturée.",
};

const FINAL: RequestStatus[] = ["RESOLVED", "REJECTED", "CLOSED"];

const ALEX = "agent@novaterra.local";
const HANTA = "hanta.agent@novaterra.local";
const TIANA = "tiana.agent@novaterra.local";

export const REQUESTS: RequestSeed[] = [
  {
    n: 1, type: "INCIDENT", status: "SUBMITTED", priority: "URGENT", subject: "Eau qui monte dans la rue des Berges",
    message: "L'eau atteint le bas des portes depuis une heure, plusieurs voisins sont inquiets.",
    citizen: "citoyen@novaterra.local", ageMinutes: 18, service: "securite-civile", category: "Inondation", district: "SUD",
    location: "Quai des Berges, Quartier Sud", coords: [-21.12, 55.53], data: { urgency_hint: "HIGH" },
  },
  {
    n: 2, type: "INCIDENT", status: "SUBMITTED", priority: "HIGH", subject: "Lampadaire cassé",
    message: "Le lampadaire devant le numéro 12 ne s'allume plus depuis deux jours, la rue est très sombre.",
    citizen: "citoyen@novaterra.local", ageMinutes: 64, service: "eclairage-voirie", category: "Éclairage public", district: "SUD",
    location: "12 rue du Réservoir, Quartier Sud", coords: [-21.118, 55.528],
  },
  {
    n: 3, type: "PROCEDURE", status: "IN_PROGRESS", priority: "NORMAL", subject: "Demande d'acte de naissance",
    message: "Je souhaite obtenir une copie intégrale de mon acte de naissance.", citizen: "pauline.ravelo@mail.nt",
    ageMinutes: 1460, service: "etat-civil", procedure: "demande-acte-de-naissance", agent: ALEX,
    data: { full_name: "Pauline Ravelo", birth_date: "1994-02-11", copy_type: "Copie intégrale" },
  },
  {
    n: 4, type: "CONTACT", status: "SUBMITTED", priority: "NORMAL", subject: "Question sur les horaires de la navette",
    message: "Bonjour, la navette N3 passe-t-elle le dimanche matin ?", citizen: null, ageMinutes: 95,
    contact: ["Tahina R.", "tahina@mail.nt"], service: "transports-urbains",
  },
  {
    n: 5, type: "INCIDENT", status: "IN_REVIEW", priority: "HIGH", subject: "Nid de poule dangereux",
    message: "Un trou profond s'est formé au carrefour, deux scooters ont déjà chuté.", citizen: "marc.delcourt@mail.nt",
    ageMinutes: 320, service: "eclairage-voirie", category: "Voirie", district: "EST",
    location: "Carrefour de l'Énergie, Quartier Est", coords: [-21.1, 55.56], agent: HANTA,
  },
  {
    n: 6, type: "PROCEDURE", status: "WAITING_CITIZEN", priority: "NORMAL", subject: "Inscription nouvel habitant",
    message: "Je viens d'arriver avec ma famille, nous sommes 4.", citizen: "amina.rahal@mail.nt", ageMinutes: 2900,
    service: "accueil-nouveaux-arrivants", procedure: "inscription-nouvel-habitant", agent: ALEX,
    data: { arrival_date: "2026-09-28", household_size: "4" },
  },
  {
    n: 7, type: "INCIDENT", status: "RESOLVED", priority: "NORMAL", subject: "Dépôt sauvage de déchets",
    message: "Des sacs ont été abandonnés près des serres.", citizen: "amina.rahal@mail.nt", ageMinutes: 4300,
    service: "proprete-dechets", category: "Propreté et déchets", district: "OUEST",
    location: "Chemin des Serres, Quartier Ouest", coords: [-21.13, 55.5], agent: TIANA,
  },
  {
    n: 8, type: "CONTACT", status: "IN_REVIEW", priority: "LOW", subject: "Accessibilité du site",
    message: "Avec mon lecteur d'écran, certains boutons ne sont pas annoncés.", citizen: "marc.delcourt@mail.nt",
    ageMinutes: 760, agent: ALEX,
  },
  {
    n: 9, type: "PROCEDURE", status: "SUBMITTED", priority: "NORMAL", subject: "Rendez-vous médical",
    message: "Consultation pour un suivi tension.", citizen: "senior@novaterra.local", ageMinutes: 140,
    service: "centre-de-sante", procedure: "rendez-vous-medical", data: { preferred_date: "2026-10-06", reason: "Suivi tension" },
  },
  {
    n: 10, type: "INCIDENT", status: "SUBMITTED", priority: "NORMAL", subject: "Fuite d'eau sur le trottoir",
    message: "Une canalisation fuit devant l'école.", citizen: "kevin.lalao@mail.nt", ageMinutes: 230,
    service: "eau-energie", category: "Eau et énergie", district: "NORD", location: "Allée du Savoir, Quartier Nord", coords: [-21.09, 55.52],
  },
  {
    n: 11, type: "CONTACT", status: "REJECTED", priority: "LOW", subject: "Permis de construire pour un dôme privé",
    message: "Comment déposer une demande d'extension de mon dôme privé ?", citizen: "pauline.ravelo@mail.nt",
    ageMinutes: 6200, service: "etat-civil", agent: HANTA,
  },
  {
    n: 12, type: "INCIDENT", status: "IN_PROGRESS", priority: "URGENT", subject: "Panne de climatisation au foyer seniors",
    message: "Il fait plus de 35°C dans la salle commune, des personnes âgées sont présentes.", citizen: "sophie.nguyen@mail.nt",
    ageMinutes: 210, service: "action-sociale", category: "Chaleur", district: "CENTRE",
    location: "Foyer des Aînés, Centre-Ville", coords: [-21.11, 55.54], agent: ALEX,
    comment: { atRatio: 0.3, by: ALEX, message: "Ventilateurs livrés en attendant le technicien." },
  },
  {
    n: 13, type: "CONTACT", status: "SUBMITTED", priority: "NORMAL", subject: "Changement d'adresse",
    message: "Comment mettre à jour mon adresse sur la plateforme ?", citizen: "elio.vony@mail.nt", ageMinutes: 35,
  },
  {
    n: 14, type: "INCIDENT", status: "WAITING_CITIZEN", priority: "NORMAL", subject: "Arbre penché sur la voie",
    message: "Un arbre menace de tomber sur la piste cyclable.", citizen: "kevin.lalao@mail.nt", ageMinutes: 1700,
    service: "proprete-dechets", category: "Espaces verts", district: "NORD", location: "Piste du Campus, Quartier Nord",
    coords: [-21.088, 55.515], agent: TIANA,
  },
  {
    n: 15, type: "PROCEDURE", status: "CLOSED", priority: "NORMAL", subject: "Collecte d'encombrants",
    message: "Un canapé et une armoire.", citizen: "senior@novaterra.local", ageMinutes: 8000, service: "proprete-dechets",
    procedure: "collecte-encombrants", agent: HANTA, data: { items: "Canapé, armoire" },
  },
  {
    n: 16, type: "INCIDENT", status: "SUBMITTED", priority: "HIGH", subject: "Feu de signalisation éteint",
    message: "Le feu du carrefour central ne fonctionne plus.", citizen: "pauline.ravelo@mail.nt", ageMinutes: 52,
    service: "eclairage-voirie", category: "Signalisation", district: "CENTRE", location: "Place du Conseil, Centre-Ville", coords: [-21.112, 55.538],
  },
  {
    n: 17, type: "PROCEDURE", status: "IN_REVIEW", priority: "NORMAL", subject: "Abonnement transport senior",
    message: "Je souhaite bénéficier du tarif senior.", citizen: "senior@novaterra.local", ageMinutes: 600,
    service: "transports-urbains", procedure: "abonnement-transport", agent: HANTA, data: { formula: "Mensuel", reduced_rate: "Senior" },
  },
  {
    n: 18, type: "CONTACT", status: "RESOLVED", priority: "LOW", subject: "Démarches en malgache",
    message: "Est-il possible d'avoir les démarches en malgache ?", citizen: "fara.tsiry@mail.nt", ageMinutes: 5100, agent: ALEX,
  },
];

export const requestReference = (n: number) => `NT-DEMO-${String(n).padStart(6, "0")}`;

// Same timeline as the mockups: created, assigned (internal), then each status step.
function requestTimeline(seed: RequestSeed, citizenId: number | null, agentId: number | null, fallbackAgentId: number) {
  const events: (Omit<Prisma.RequestEventCreateManyInput, "request_id"> & { minutes: number })[] = [
    { type: "CREATED", to_status: "SUBMITTED", author_id: citizenId, minutes: seed.ageMinutes },
  ];
  let last = seed.ageMinutes;
  if (agentId) {
    last = Math.round(seed.ageMinutes * 0.8);
    events.push({ type: "ASSIGNED", author_id: agentId, is_internal: true, minutes: last });
  }
  const steps: RequestStatus[] =
    seed.status === "SUBMITTED"
      ? []
      : seed.status === "IN_REVIEW"
        ? ["IN_REVIEW"]
        : seed.status === "REJECTED"
          ? ["IN_REVIEW", "REJECTED"]
          : ["IN_REVIEW", "IN_PROGRESS", ...(seed.status === "IN_PROGRESS" ? [] : [seed.status])];
  let from: RequestStatus = "SUBMITTED";
  steps.forEach((to, index) => {
    last = Math.max(1, Math.round(last * (0.7 - index * 0.1)));
    events.push({
      type: "STATUS_CHANGED",
      author_id: agentId ?? fallbackAgentId,
      from_status: from,
      to_status: to,
      message: STATUS_NOTES[to] ?? null,
      minutes: last,
    });
    from = to;
  });
  return events;
}

async function seedRequests(prisma: PrismaClient, refs: ScenarioRefs, userIds: Ids) {
  for (const seed of REQUESTS) {
    const reference = requestReference(seed.n);
    if (await prisma.citizenRequest.findUnique({ where: { reference }, select: { id: true } })) continue;

    const citizenId = seed.citizen ? userIds[seed.citizen] : null;
    const agentId = seed.agent ? userIds[seed.agent] : null;
    const events = requestTimeline(seed, citizenId, agentId, userIds[ALEX]);
    if (seed.comment) {
      events.push({
        type: "COMMENT",
        author_id: userIds[seed.comment.by],
        message: seed.comment.message,
        is_internal: seed.comment.internal ?? false,
        minutes: Math.round(seed.ageMinutes * seed.comment.atRatio),
      });
    }
    const lastChange = minutesAgo(Math.min(...events.map((e) => e.minutes)));

    await prisma.citizenRequest.create({
      data: {
        reference,
        type: seed.type,
        status: seed.status,
        priority: seed.priority,
        subject: seed.subject,
        message: seed.message,
        citizen_id: citizenId,
        contact_name: seed.contact?.[0],
        contact_email: seed.contact?.[1],
        service_id: seed.service ? refs.serviceIds[seed.service] : null,
        procedure_id: seed.procedure ? refs.procedureIds[seed.procedure] : null,
        assigned_agent_id: agentId,
        category: seed.category,
        district_id: seed.district ? refs.districtIds[seed.district] : null,
        location_label: seed.location,
        latitude: seed.coords?.[0],
        longitude: seed.coords?.[1],
        data: seed.data,
        created_at: minutesAgo(seed.ageMinutes),
        updated_at: lastChange,
        resolved_at: FINAL.includes(seed.status) ? lastChange : null,
        events: {
          create: events.map(({ minutes, ...event }) => ({ ...event, created_at: minutesAgo(minutes) })),
        },
      },
    });
  }
}

// ─── Appointments (F39, F40) ────────────────────────────────────────────────

const SLOT_SERVICES = [
  { slug: "etat-civil", agent: ALEX, capacity: 1, location: "Hôtel de ville — bureau 4", notes: "Munissez-vous de votre livret de famille si vous en avez un." },
  { slug: "accueil-nouveaux-arrivants", agent: ALEX, capacity: 2, location: "Hôtel de ville — guichet 2", notes: "Apportez une pièce d'identité et un justificatif de logement." },
  { slug: "centre-de-sante", agent: HANTA, capacity: 1, location: "Centre de santé — accueil", notes: "Présentez-vous 10 minutes avant avec vos ordonnances en cours." },
];
// From two days ago to ten days ahead, so past appointments have a slot too
const SLOT_DAYS = { from: -2, to: 10 };

const dayAt = (dayOffset: number, hours: number, minutes: number) => {
  const date = new Date(NOW);
  date.setDate(date.getDate() + dayOffset);
  // The city's offices are closed on Sundays: the slot moves to Monday
  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

async function seedSlots(prisma: PrismaClient, refs: ScenarioRefs, userIds: Ids) {
  const serviceIds = SLOT_SERVICES.map((s) => refs.serviceIds[s.slug]);
  const existing = await prisma.appointmentSlot.findMany({
    where: { service_id: { in: serviceIds }, starts_at: { gte: dayAt(SLOT_DAYS.from, 0, 0), lte: dayAt(SLOT_DAYS.to, 23, 59) } },
    select: { service_id: true, starts_at: true },
  });
  const taken = new Set(existing.map((slot) => `${slot.service_id}|${slot.starts_at.getTime()}`));

  const data: Prisma.AppointmentSlotCreateManyInput[] = [];
  for (let day = SLOT_DAYS.from; day <= SLOT_DAYS.to; day++) {
    const date = new Date(NOW);
    date.setDate(date.getDate() + day);
    if (date.getDay() === 0) continue;
    for (let minutes = 9 * 60; minutes < 12 * 60; minutes += 30) {
      for (const service of SLOT_SERVICES) {
        const startsAt = dayAt(day, Math.floor(minutes / 60), minutes % 60);
        const key = `${refs.serviceIds[service.slug]}|${startsAt.getTime()}`;
        if (taken.has(key)) continue;
        taken.add(key);
        data.push({
          service_id: refs.serviceIds[service.slug],
          agent_id: userIds[service.agent],
          starts_at: startsAt,
          ends_at: new Date(startsAt.getTime() + 30 * MINUTE),
          location: service.location,
          capacity: service.capacity,
          preparation_notes: service.notes,
        });
      }
    }
  }
  if (data.length) await prisma.appointmentSlot.createMany({ data });
}

interface AppointmentSeed {
  n: number;
  service: string;
  day: number;
  at: [number, number];
  citizen: string;
  reason: string;
  status: AppointmentStatus;
  notes?: string;
}

export const APPOINTMENTS: AppointmentSeed[] = [
  { n: 1, service: "etat-civil", day: -1, at: [9, 0], citizen: "pauline.ravelo@mail.nt", reason: "Acte de naissance — copie intégrale", status: "COMPLETED", notes: "Copie remise en main propre." },
  { n: 2, service: "accueil-nouveaux-arrivants", day: 1, at: [9, 30], citizen: "amina.rahal@mail.nt", reason: "Inscription famille de 4 personnes", status: "BOOKED" },
  { n: 3, service: "centre-de-sante", day: 1, at: [10, 0], citizen: "senior@novaterra.local", reason: "Suivi tension artérielle", status: "BOOKED" },
  { n: 4, service: "etat-civil", day: -1, at: [10, 30], citizen: "citoyen@novaterra.local", reason: "Livret de famille", status: "NO_SHOW" },
  { n: 5, service: "centre-de-sante", day: 2, at: [9, 0], citizen: "sophie.nguyen@mail.nt", reason: "Renouvellement d'ordonnance", status: "BOOKED" },
  { n: 6, service: "accueil-nouveaux-arrivants", day: 2, at: [11, 0], citizen: "elio.vony@mail.nt", reason: "Premier rendez-vous d'accueil", status: "BOOKED" },
  { n: 7, service: "etat-civil", day: 3, at: [9, 30], citizen: "marc.delcourt@mail.nt", reason: "Acte de mariage", status: "BOOKED" },
  { n: 8, service: "accueil-nouveaux-arrivants", day: 3, at: [10, 0], citizen: "kevin.lalao@mail.nt", reason: "Inscription nouvel habitant", status: "CANCELLED" },
  { n: 9, service: "centre-de-sante", day: 4, at: [11, 30], citizen: "senior@novaterra.local", reason: "Vaccination saisonnière", status: "BOOKED" },
  { n: 10, service: "etat-civil", day: 5, at: [9, 0], citizen: "pauline.ravelo@mail.nt", reason: "Changement de nom d'usage", status: "BOOKED" },
  { n: 11, service: "accueil-nouveaux-arrivants", day: 6, at: [10, 30], citizen: "amina.rahal@mail.nt", reason: "Justificatif de domicile", status: "BOOKED" },
  // Today: depending on the hour the seed runs, the agent has it ahead or still to mark as attended
  { n: 12, service: "accueil-nouveaux-arrivants", day: 0, at: [11, 0], citizen: "marc.delcourt@mail.nt", reason: "Dépôt de dossier logement", status: "BOOKED" },
];

export const appointmentReference = (n: number) => `RDV-DEMO-${String(n).padStart(4, "0")}`;

async function seedAppointments(prisma: PrismaClient, refs: ScenarioRefs, userIds: Ids) {
  for (const seed of APPOINTMENTS) {
    const reference = appointmentReference(seed.n);
    if (await prisma.appointment.findUnique({ where: { reference }, select: { id: true } })) continue;
    const serviceId = refs.serviceIds[seed.service];
    const startsAt = dayAt(seed.day, ...seed.at);
    const slot = await prisma.appointmentSlot.findFirst({ where: { service_id: serviceId, starts_at: startsAt } });
    if (!slot) continue;
    const past = startsAt.getTime() < NOW;
    await prisma.appointment.create({
      data: {
        reference,
        slot_id: slot.id,
        service_id: serviceId,
        citizen_id: userIds[seed.citizen],
        reason: seed.reason,
        status: seed.status,
        agent_notes: seed.notes,
        created_at: new Date(Math.min(NOW, startsAt.getTime()) - 3 * 24 * 60 * MINUTE),
        // Past appointments had their reminder; upcoming ones get it from the scheduler
        reminder_sent_at: past ? new Date(startsAt.getTime() - 24 * 60 * MINUTE) : null,
        cancelled_at: seed.status === "CANCELLED" ? minutesAgo(120) : null,
      },
    });
  }
}

// ─── Information (D06, D18, F29, F30, F31) ──────────────────────────────────

const ANNOUNCEMENTS = [
  {
    title: "La plateforme numérique de Terra Nova est ouverte",
    summary: "Créez votre compte pour accéder à vos démarches, signaler un problème et suivre vos demandes.",
    content:
      "Le Haut Conseil de Terra Nova inaugure la plateforme numérique centrale de la ville. Vous pouvez y créer votre compte, effectuer vos démarches en ligne, signaler un problème dans votre quartier et suivre chacune de vos demandes.",
    category: "NEWS" as const, status: "PUBLISHED" as const, is_important: true, is_pinned: true,
    author: "admin@novaterra.local", publishedMinutesAgo: 2 * 1440,
  },
  {
    title: "Nouveaux horaires du centre de santé",
    summary: "Les consultations sont désormais ouvertes de 7h à 20h.",
    content: "À partir de cette semaine, le centre de santé élargit ses horaires de consultation : du lundi au samedi, de 7h à 20h. Les urgences restent ouvertes 24h/24.",
    category: "SERVICE_CHANGE" as const, status: "PUBLISHED" as const, service: "centre-de-sante",
    author: ALEX, publishedMinutesAgo: 1440,
  },
  {
    title: "Collecte des encombrants : mode d'emploi",
    content: "Faites votre demande en ligne depuis le service Propreté urbaine & déchets. Un agent vous propose un passage dans les 5 jours ouvrés.",
    category: "PRACTICAL_INFO" as const, status: "PUBLISHED" as const, service: "proprete-dechets",
    author: HANTA, publishedMinutesAgo: 20 * 60,
  },
  {
    title: "Fête des Dômes : programme du week-end",
    summary: "Concerts, marché et observation des étoiles.",
    content: "La ville célèbre sa première année : concerts au Grand Dôme, marché des producteurs des serres et nuit d'observation des étoiles.",
    category: "EVENT" as const, status: "DRAFT" as const, author: ALEX,
  },
  {
    title: "Coupure d'eau programmée au Quartier Est",
    summary: "Mardi de 9h à 12h.",
    content: "Des travaux sur le réseau nécessitent une coupure d'eau mardi de 9h à 12h dans le Quartier Est. Pensez à faire des réserves.",
    category: "SERVICE_CHANGE" as const, status: "DRAFT" as const, is_important: true, service: "eau-energie", author: HANTA,
  },
  {
    title: "Bienvenue aux premiers habitants",
    content: "Archive de la semaine d'ouverture.",
    category: "NEWS" as const, status: "ARCHIVED" as const, author: "admin@novaterra.local", publishedMinutesAgo: 14 * 1440,
  },
];

const ALERTS = [
  // F29: targeted to the southern district
  {
    title: "Montée des eaux dans le Quartier Sud",
    message: "Une montée inhabituelle du niveau de l'eau est observée dans le Quartier Sud.",
    category: "FLOOD", severity: "CRITICAL" as const, audience: "DISTRICTS" as const, districts: ["SUD"],
    instructions: "Évitez les berges et les sous-sols, montez dans les étages et suivez les consignes des secours.",
    source: "Centre de surveillance environnementale", startedMinutesAgo: 120, author: ALEX,
  },
  // F31: vulnerable people, with tailored recommendations
  {
    title: "Vague de chaleur extrême",
    message: "Une vague de chaleur extrême touche plusieurs secteurs de la ville.",
    category: "HEATWAVE", severity: "WARNING" as const, audience: "VULNERABLE" as const, districts: [],
    instructions: "Restez au frais, hydratez-vous régulièrement et prenez des nouvelles de vos proches isolés.",
    recommendations: [
      { title: "Personnes âgées", text: "Buvez de l'eau toutes les heures, même sans soif." },
      { title: "Enfants", text: "Évitez les sorties entre 12h et 16h." },
      { title: "Malades chroniques", text: "Contactez le centre de santé au moindre malaise." },
    ],
    source: "Agence sanitaire de Terra Nova", startedMinutesAgo: 300, author: "admin@novaterra.local",
  },
  {
    title: "Réunion publique du Haut Conseil",
    message: "Réunion ouverte à tous ce soir à 19h, place du Conseil.",
    category: "GENERAL", severity: "INFO" as const, audience: "ALL" as const, districts: [],
    source: "Haut Conseil de la Ville", startedMinutesAgo: 1440, endedMinutesAgo: 600, author: "admin@novaterra.local",
  },
];

async function seedInformation(prisma: PrismaClient, refs: ScenarioRefs, userIds: Ids) {
  for (const { author, service, publishedMinutesAgo, ...announcement } of ANNOUNCEMENTS) {
    if (await prisma.announcement.findFirst({ where: { title: announcement.title }, select: { id: true } })) continue;
    await prisma.announcement.create({
      data: {
        ...announcement,
        author_id: userIds[author],
        service_id: service ? refs.serviceIds[service] : null,
        published_at: publishedMinutesAgo === undefined ? null : minutesAgo(publishedMinutesAgo),
        created_at: minutesAgo((publishedMinutesAgo ?? 40) + 60),
      },
    });
  }

  for (const { author, districts, startedMinutesAgo, endedMinutesAgo, ...alert } of ALERTS) {
    if (await prisma.alert.findFirst({ where: { title: alert.title }, select: { id: true } })) continue;
    await prisma.alert.create({
      data: {
        ...alert,
        created_by_id: userIds[author],
        starts_at: minutesAgo(startedMinutesAgo),
        ends_at: endedMinutesAgo === undefined ? null : minutesAgo(endedMinutesAgo),
        is_active: endedMinutesAgo === undefined,
        districts: { create: districts.map((code) => ({ district_id: refs.districtIds[code] })) },
      },
    });
  }
}

// ─── Service interruptions (F38) ────────────────────────────────────────────

const INTERRUPTIONS = [
  {
    service: "eau-energie", type: "INCIDENT" as const, impact: "DEGRADED" as const,
    reason: "Incident sur le réseau de suivi des consommations : les demandes sont traitées avec retard.",
    alternative: "Pour une coupure d'eau urgente, appelez le +00 100 300.",
    starts: () => minutesAgo(60), ends: () => minutesAgo(-23 * 60), author: ALEX,
  },
  {
    service: "etat-civil", type: "MAINTENANCE" as const, impact: "UNAVAILABLE" as const,
    reason: "Maintenance du registre numérique d'état civil.",
    alternative: "Le guichet de l'Hôtel de ville reste ouvert le jour suivant dès 8h.",
    starts: () => dayAt(2, 8, 0), ends: () => dayAt(2, 18, 0), author: "admin@novaterra.local",
  },
  {
    service: "proprete-dechets", type: "MAINTENANCE" as const, impact: "UNAVAILABLE" as const,
    reason: "Remplacement des capteurs des bennes connectées.",
    alternative: "Déposez vos encombrants à la déchetterie Est.",
    starts: () => dayAt(-3, 6, 0), ends: () => dayAt(-3, 12, 0), author: "admin@novaterra.local",
  },
];

async function seedInterruptions(prisma: PrismaClient, refs: ScenarioRefs, userIds: Ids) {
  for (const { service, starts, ends, author, ...interruption } of INTERRUPTIONS) {
    const service_id = refs.serviceIds[service];
    if (await prisma.serviceInterruption.findFirst({ where: { service_id, reason: interruption.reason }, select: { id: true } })) continue;
    await prisma.serviceInterruption.create({
      data: { ...interruption, service_id, starts_at: starts(), ends_at: ends(), created_by_id: userIds[author] },
    });
  }
}

// ─── Security (F37) and notifications (F30) ─────────────────────────────────

const LOCKED_EMAIL = "miora.haja@mail.nt";
const ATTACK_IP = "198.51.100.77";

async function seedLoginAttempts(prisma: PrismaClient, userIds: Ids) {
  // Staff logins, for the security overview
  if ((await prisma.loginAttempt.count({ where: { email: ALEX, reason: "OK" } })) === 0) {
    await prisma.loginAttempt.createMany({
      data: ACCOUNTS.filter((a) => a.role !== "CITIZEN" && a.lastLoginMinutesAgo !== undefined).map((a) => ({
        email: a.email,
        ip: "10.0.0.12",
        success: true,
        reason: "OK",
        user_id: userIds[a.email],
        created_at: minutesAgo(a.lastLoginMinutesAgo!),
      })),
    });
  }
  // Miora's account is locked: five wrong passwords in the last minutes. The lock lasts
  // 15 minutes; running the seed again locks it again.
  const windowStart = minutesAgo(15);
  if ((await prisma.loginAttempt.count({ where: { email: LOCKED_EMAIL, success: false, created_at: { gte: windowStart } } })) < 5) {
    await prisma.loginAttempt.createMany({
      data: [5, 4, 3, 2, 1].map((minutes) => ({
        email: LOCKED_EMAIL,
        ip: ATTACK_IP,
        user_agent: "python-requests/2.32",
        success: false,
        reason: "INVALID_CREDENTIALS",
        user_id: userIds[LOCKED_EMAIL],
        created_at: minutesAgo(minutes),
      })),
    });
    // The same address tried other accounts (some do not exist)
    await prisma.loginAttempt.createMany({
      data: ["lucas@mail.nt", "admin@novaterra.city", "pauline.ravelo@mail.nt", "test@test.nt"].map((email, i) => ({
        email,
        ip: ATTACK_IP,
        user_agent: "python-requests/2.32",
        success: false,
        reason: "INVALID_CREDENTIALS",
        user_id: userIds[email] ?? null,
        created_at: minutesAgo(8 + i),
      })),
    });
  }
}

async function seedNotifications(prisma: PrismaClient, userIds: Ids) {
  const lucas = userIds["citoyen@novaterra.local"];
  if ((await prisma.notification.count({ where: { user_id: lucas } })) > 0) return;
  const requests = await prisma.citizenRequest.findMany({
    where: { reference: { in: [requestReference(1), requestReference(2)] } },
    select: { id: true, reference: true, status: true },
  });
  const flood = await prisma.alert.findFirst({ where: { title: ALERTS[0].title }, select: { id: true } });
  const welcome = await prisma.announcement.findFirst({ where: { title: ANNOUNCEMENTS[0].title }, select: { id: true } });
  await prisma.notification.createMany({
    data: [
      ...requests.map((request, i) => ({
        user_id: lucas,
        type: "REQUEST_CREATED",
        title: `Demande ${request.reference} bien reçue`,
        link: `/requests/${request.id}`,
        data: { request_id: request.id, reference: request.reference, status: request.status },
        created_at: minutesAgo(i === 0 ? 18 : 64),
      })),
      ...(flood
        ? [{
            user_id: lucas,
            type: "ALERT",
            title: ALERTS[0].title,
            body: ALERTS[0].instructions,
            link: `/alerts/${flood.id}`,
            data: { alert_id: flood.id, severity: "CRITICAL" },
            created_at: minutesAgo(120),
          }]
        : []),
      ...(welcome
        ? [{
            user_id: lucas,
            type: "ANNOUNCEMENT",
            title: ANNOUNCEMENTS[0].title,
            body: ANNOUNCEMENTS[0].summary,
            link: `/announcements/${welcome.id}`,
            data: { announcement_id: welcome.id },
            created_at: minutesAgo(2 * 1440),
            read_at: minutesAgo(2 * 1440 - 30),
          }]
        : []),
    ],
  });
}

// ─── Reset ──────────────────────────────────────────────────────────────────

// Deletes the rows this scenario owns (accounts are kept and reset by the upsert).
async function resetScenario(prisma: PrismaClient, refs: ScenarioRefs) {
  const demoEmails = ACCOUNTS.map((a) => a.email);
  const slotServiceIds = SLOT_SERVICES.map((s) => refs.serviceIds[s.slug]);
  await prisma.$transaction([
    prisma.citizenRequest.deleteMany({ where: { reference: { startsWith: "NT-DEMO-" } } }),
    prisma.appointment.deleteMany({ where: { reference: { startsWith: "RDV-DEMO-" } } }),
    prisma.appointmentSlot.deleteMany({
      where: {
        service_id: { in: slotServiceIds },
        starts_at: { gte: dayAt(SLOT_DAYS.from, 0, 0), lte: dayAt(SLOT_DAYS.to, 23, 59) },
        appointments: { none: {} },
      },
    }),
    prisma.announcement.deleteMany({ where: { title: { in: ANNOUNCEMENTS.map((a) => a.title) } } }),
    prisma.alert.deleteMany({ where: { title: { in: ALERTS.map((a) => a.title) } } }),
    prisma.serviceInterruption.deleteMany({ where: { reason: { in: INTERRUPTIONS.map((i) => i.reason) } } }),
    prisma.loginAttempt.deleteMany({ where: { OR: [{ email: { in: demoEmails } }, { ip: ATTACK_IP }] } }),
    prisma.notification.deleteMany({ where: { user: { email: { in: demoEmails } } } }),
  ]);
}

// F47 / F48: a few past entries so the journal is not empty on the first launch. The journal is
// immutable: they carry metadata.demo, are written once, and SEED_RESET never deletes them.
async function seedAuditLog(prisma: PrismaClient, refs: ScenarioRefs, userIds: Ids) {
  if ((await prisma.auditLog.count({ where: { metadata: { path: "$.demo", equals: true } } })) > 0) return;
  const actors = {
    ada: { actor_id: userIds["admin@novaterra.local"], actor_role: "ADMIN" as const, actor_name: "Ada Ranaivo", ip: "10.0.0.12" },
    alex: { actor_id: userIds["agent@novaterra.local"], actor_role: "AGENT" as const, actor_name: "Alex Rakoto", ip: "10.0.0.31" },
  };
  const request = await prisma.citizenRequest.findUnique({ where: { reference: requestReference(12) }, select: { id: true } });
  const health = refs.serviceIds["prevention-sante"]
    ? await prisma.cityService.findUnique({ where: { id: refs.serviceIds["prevention-sante"] }, select: { id: true, name: true } })
    : null;
  const hanta = userIds["hanta.agent@novaterra.local"];
  const entries: Prisma.AuditLogCreateManyInput[] = [
      { ...actors.ada, created_at: daysAgo(6), action: "user.created", entity: "User", entity_id: hanta, entity_label: "Hanta Andria", changes: [{ field: "role", from: null, to: "AGENT" }] },
      { ...actors.ada, created_at: daysAgo(3), action: "settings.updated", entity: "PlatformSetting", entity_label: "Paramètres de la plateforme", changes: [{ field: "registration_open", from: false, to: true }] },
      ...(health
        ? [{ ...actors.ada, created_at: daysAgo(2), action: "service.updated", entity: "CityService", entity_id: health.id, entity_label: health.name, changes: [{ field: "priority", from: 2, to: 5 }] }]
        : []),
      ...(request
        ? [
            { ...actors.alex, created_at: minutesAgo(130), action: "request.assigned", entity: "CitizenRequest", entity_id: request.id, entity_label: requestReference(12), changes: [{ field: "assigned_agent", from: null, to: "Alex Rakoto" }] },
            { ...actors.alex, created_at: minutesAgo(90), action: "request.status_changed", entity: "CitizenRequest", entity_id: request.id, entity_label: requestReference(12), changes: [{ field: "status", from: "IN_REVIEW", to: "IN_PROGRESS" }] },
          ]
        : []),
      { ...actors.ada, created_at: minutesAgo(45), action: "user.login_unlocked", entity: "User", entity_id: userIds[LOCKED_EMAIL] ?? null, entity_label: LOCKED_EMAIL },
  ];
  await prisma.auditLog.createMany({ data: entries.map((entry) => ({ ...entry, metadata: { demo: true } })) });
}

export async function seedDemoScenario(prisma: PrismaClient, refs: ScenarioRefs) {
  if (refs.reset) await resetScenario(prisma, refs);
  const userIds = await seedAccounts(prisma, refs);
  await seedRequests(prisma, refs, userIds);
  await seedSlots(prisma, refs, userIds);
  await seedAppointments(prisma, refs, userIds);
  await seedInformation(prisma, refs, userIds);
  await seedInterruptions(prisma, refs, userIds);
  await seedLoginAttempts(prisma, userIds);
  await seedNotifications(prisma, userIds);
  await seedAuditLog(prisma, refs, userIds);
  return userIds;
}
