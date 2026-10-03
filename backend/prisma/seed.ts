// Demo data for Terra Nova, laid out around the moment the seed runs (same scenario as the
// back-office mockups). Idempotent: missing rows are created, existing ones are kept.
// Usage: npm run seed            (SEED_PASSWORD overrides the demo accounts' password)
//        SEED_RESET=1 npm run seed   deletes the demo scenario first and recreates it
require("dotenv").config();
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildDepartures } from "../src/lib/transit";
import { ACCOUNTS, requestReference, seedDemoScenario } from "./demoScenario";

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD || "NovaTerra2026!";
const RESET = process.env.SEED_RESET === "1";

const districts = [
  { code: "CENTRE", name: "Centre-Ville", description: "Cœur administratif et commercial de Terra Nova." },
  { code: "NORD", name: "Quartier Nord", description: "Zone résidentielle et pôle éducatif." },
  { code: "SUD", name: "Quartier Sud", description: "Quartier riverain, proche du réservoir principal." },
  { code: "EST", name: "Quartier Est", description: "Zone industrielle et centre énergétique." },
  { code: "OUEST", name: "Quartier Ouest", description: "Dômes agricoles et habitat récent." },
];

const categories = [
  { slug: "administration", name: "Administration & état civil", icon: "landmark", sort_order: 1 },
  { slug: "sante", name: "Santé", icon: "heart-pulse", sort_order: 2 },
  { slug: "mobilite", name: "Mobilité & transports", icon: "bus", sort_order: 3 },
  { slug: "environnement", name: "Environnement & propreté", icon: "leaf", sort_order: 4 },
  { slug: "urbanisme", name: "Urbanisme, voirie & éclairage", icon: "construction", sort_order: 5 },
  { slug: "securite", name: "Sécurité & prévention", icon: "shield", sort_order: 6 },
  { slug: "solidarite", name: "Solidarité & famille", icon: "users", sort_order: 7 },
];

type ServiceSeed = Omit<Prisma.CityServiceUncheckedCreateInput, "category_id"> & { category: string };

const services: ServiceSeed[] = [
  {
    slug: "etat-civil",
    category: "administration",
    name: "État civil",
    summary: "Actes de naissance, mariage, décès et livret de famille.",
    description: "Le service d'état civil délivre et met à jour les actes officiels des habitants de Terra Nova.",
    keywords: "acte, naissance, mariage, décès, papiers, identité",
    icon: "file-text",
    contact_email: "etat-civil@novaterra.city",
    contact_phone: "+00 100 200",
    address: "Hôtel de ville, Centre-Ville",
    opening_hours: "Lun–Ven 8h–17h",
    is_featured: true,
    priority: 10,
  },
  {
    slug: "accueil-nouveaux-arrivants",
    category: "administration",
    name: "Accueil des nouveaux arrivants",
    summary: "Votre installation à Terra Nova : inscription, logement, premiers pas.",
    description: "Un guichet unique pour s'installer, compléter son profil et découvrir les services de la ville.",
    keywords: "arrivée, installation, inscription, nouveau, habitant, logement",
    icon: "door-open",
    contact_email: "accueil@novaterra.city",
    address: "Hôtel de ville, Centre-Ville",
    opening_hours: "Lun–Sam 8h–18h",
    is_featured: true,
    priority: 9,
  },
  {
    slug: "centre-de-sante",
    category: "sante",
    name: "Centre de santé de Terra Nova",
    summary: "Consultations, urgences et suivi médical pour tous les habitants.",
    description: "Médecine générale, urgences 24h/24, pédiatrie et téléconsultation.",
    keywords: "santé, médecin, soins, urgence, hôpital, consultation, docteur",
    icon: "stethoscope",
    contact_phone: "+00 100 115",
    address: "Avenue des Dômes, Quartier Nord",
    opening_hours: "Urgences 24h/24 — consultations 7h–20h",
    is_featured: true,
    priority: 10,
  },
  {
    slug: "prevention-sante",
    category: "sante",
    name: "Prévention santé & vaccination",
    summary: "Campagnes de vaccination, dépistage et conseils face aux risques climatiques.",
    keywords: "santé, vaccin, prévention, canicule, chaleur, dépistage",
    icon: "syringe",
    priority: 5,
  },
  {
    slug: "transports-urbains",
    category: "mobilite",
    name: "Réseau de transport urbain",
    summary: "Navettes, lignes du réseau et abonnements.",
    keywords: "bus, navette, transport, ligne, abonnement, horaires",
    icon: "bus",
    is_featured: true,
    priority: 7,
  },
  {
    slug: "proprete-dechets",
    category: "environnement",
    name: "Propreté urbaine & déchets",
    summary: "Collecte des déchets, recyclage et encombrants.",
    keywords: "déchets, poubelle, recyclage, encombrants, collecte, propreté",
    icon: "trash",
    priority: 6,
  },
  {
    slug: "eclairage-voirie",
    category: "urbanisme",
    name: "Éclairage public & voirie",
    summary: "Lampadaires, routes, trottoirs : signalez un problème sur l'espace public.",
    keywords: "lampadaire, éclairage, route, trottoir, nid de poule, voirie, signalement",
    icon: "lightbulb",
    priority: 6,
  },
  {
    slug: "eau-energie",
    category: "environnement",
    name: "Eau & énergie",
    summary: "Distribution d'eau, réseau énergétique et économies de ressources.",
    keywords: "eau, électricité, énergie, coupure, réseau",
    icon: "droplet",
    priority: 4,
  },
  {
    slug: "securite-civile",
    category: "securite",
    name: "Sécurité civile",
    summary: "Prévention des risques, alertes et consignes en cas d'urgence.",
    keywords: "sécurité, urgence, inondation, alerte, secours, risque",
    icon: "siren",
    priority: 8,
  },
  {
    slug: "urbanisme-permis",
    category: "urbanisme",
    name: "Urbanisme & permis",
    summary: "Permis de construire et autorisations de travaux.",
    keywords: "permis, construire, travaux, autorisation, urbanisme, extension",
    icon: "building",
    priority: 2,
    is_active: false,
  },
  {
    slug: "action-sociale",
    category: "solidarite",
    name: "Action sociale",
    summary: "Accompagnement des familles, seniors et personnes vulnérables.",
    keywords: "aide, social, famille, senior, vulnérable, accompagnement",
    icon: "hand-heart",
    priority: 5,
  },
];

const VIEW_COUNTS: Record<string, number> = {
  "etat-civil": 1284,
  "accueil-nouveaux-arrivants": 986,
  "centre-de-sante": 2140,
  "prevention-sante": 412,
  "transports-urbains": 1530,
  "proprete-dechets": 640,
  "eclairage-voirie": 702,
  "eau-energie": 388,
  "securite-civile": 455,
  "action-sociale": 301,
  "urbanisme-permis": 120,
};

const procedures = [
  {
    slug: "demande-acte-de-naissance",
    service: "etat-civil",
    title: "Demander un acte de naissance",
    description: "Recevez une copie intégrale ou un extrait de votre acte de naissance.",
    estimated_days: 3,
    required_documents: ["Pièce d'identité"],
    form_schema: [
      { name: "full_name", label: "Nom complet de la personne concernée", type: "text", required: true },
      { name: "birth_date", label: "Date de naissance", type: "date", required: true },
      { name: "copy_type", label: "Type de document", type: "select", required: true, options: ["Copie intégrale", "Extrait"] },
    ],
  },
  {
    slug: "inscription-nouvel-habitant",
    service: "accueil-nouveaux-arrivants",
    title: "S'inscrire comme nouvel habitant",
    description: "Déclarez votre arrivée pour accéder à l'ensemble des services municipaux.",
    estimated_days: 2,
    required_documents: ["Pièce d'identité", "Justificatif de logement"],
    form_schema: [
      { name: "arrival_date", label: "Date d'arrivée", type: "date", required: true },
      { name: "household_size", label: "Nombre de personnes dans le foyer", type: "number", required: true },
    ],
  },
  {
    slug: "rendez-vous-medical",
    service: "centre-de-sante",
    title: "Prendre rendez-vous au centre de santé",
    description: "Demandez une consultation ; le centre vous recontacte pour confirmer le créneau.",
    estimated_days: 1,
    form_schema: [
      { name: "preferred_date", label: "Date souhaitée", type: "date", required: true },
      { name: "reason", label: "Motif de consultation", type: "textarea", required: false },
    ],
  },
  {
    slug: "abonnement-transport",
    service: "transports-urbains",
    title: "Souscrire un abonnement au réseau urbain",
    description: "Abonnement mensuel ou annuel, avec tarif réduit pour les seniors, étudiants et demandeurs d'emploi.",
    estimated_days: 2,
    required_documents: ["Pièce d'identité", "Justificatif pour le tarif réduit"],
    form_schema: [
      { name: "formula", label: "Formule", type: "select", required: true, options: ["Mensuel", "Annuel"] },
      { name: "reduced_rate", label: "Tarif réduit demandé", type: "select", required: false, options: ["Aucun", "Senior", "Étudiant", "Demandeur d'emploi"] },
    ],
  },
  {
    slug: "collecte-encombrants",
    service: "proprete-dechets",
    title: "Demander une collecte d'encombrants",
    estimated_days: 5,
    form_schema: [{ name: "items", label: "Objets à collecter", type: "textarea", required: true }],
  },
];

// F27: example translations (English and Malagasy)
const translations: { entity: string; key: string; locale: string; fields: Record<string, string> }[] = [
  { entity: "ServiceCategory", key: "administration", locale: "en", fields: { name: "Administration & civil status" } },
  { entity: "ServiceCategory", key: "sante", locale: "en", fields: { name: "Health" } },
  { entity: "ServiceCategory", key: "mobilite", locale: "en", fields: { name: "Mobility & transport" } },
  { entity: "ServiceCategory", key: "sante", locale: "mg", fields: { name: "Fahasalamana" } },
  {
    entity: "CityService",
    key: "etat-civil",
    locale: "en",
    fields: { name: "Civil registry", summary: "Birth, marriage and death certificates, family records." },
  },
  {
    entity: "CityService",
    key: "accueil-nouveaux-arrivants",
    locale: "en",
    fields: { name: "Newcomers welcome desk", summary: "Settling in Terra Nova: registration, housing, first steps." },
  },
  {
    entity: "CityService",
    key: "centre-de-sante",
    locale: "en",
    fields: { name: "Terra Nova health centre", summary: "Consultations, emergencies and medical follow-up for all residents." },
  },
  {
    entity: "CityService",
    key: "centre-de-sante",
    locale: "mg",
    fields: { name: "Toeram-pahasalamana Terra Nova", summary: "Fitsaboana sy vonjy maika ho an'ny mponina rehetra." },
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const districtIds: Record<string, number> = {};
  for (const district of districts) {
    const row = await prisma.district.upsert({ where: { code: district.code }, create: district, update: district });
    districtIds[district.code] = row.id;
  }

  const categoryIds: Record<string, number> = {};
  for (const category of categories) {
    const row = await prisma.serviceCategory.upsert({ where: { slug: category.slug }, create: category, update: category });
    categoryIds[category.slug] = row.id;
  }

  const serviceIds: Record<string, number> = {};
  for (const { category, ...service } of services) {
    const data = { ...service, category_id: categoryIds[category] };
    const row = await prisma.cityService.upsert({
      where: { slug: service.slug },
      // F28: initial usage so "most used" means something on a fresh database
      create: { ...data, view_count: VIEW_COUNTS[service.slug] ?? 0 },
      update: data,
    });
    serviceIds[service.slug] = row.id;
  }

  const procedureIds: Record<string, number> = {};
  for (const { service, ...procedure } of procedures) {
    const data = { ...procedure, service_id: serviceIds[service] };
    const row = await prisma.procedure.upsert({ where: { slug: procedure.slug }, create: data, update: data });
    procedureIds[procedure.slug] = row.id;
  }

  for (const t of translations) {
    const entity_id = t.entity === "CityService" ? serviceIds[t.key] : categoryIds[t.key];
    for (const [field, value] of Object.entries(t.fields)) {
      const key = { entity: t.entity, entity_id, locale: t.locale, field };
      await prisma.contentTranslation.upsert({
        where: { entity_entity_id_locale_field: key },
        create: { ...key, value },
        update: { value },
      });
    }
  }

  // Transport first: the scenario below only references services and districts
  // F36: transport network
  const stops = [
    { code: "HDV", name: "Hôtel de Ville", district: "CENTRE", address: "Place du Conseil" },
    { code: "GDO", name: "Grand Dôme", district: "CENTRE", address: "Avenue des Dômes" },
    { code: "RES", name: "Réservoir", district: "SUD", address: "Rue du Réservoir" },
    { code: "BER", name: "Berges du Sud", district: "SUD", address: "Quai des Berges" },
    { code: "SAN", name: "Centre de santé", district: "NORD", address: "Avenue des Dômes, Nord" },
    { code: "ECO", name: "Campus Nord", district: "NORD", address: "Allée du Savoir" },
    { code: "ENE", name: "Centrale énergétique", district: "EST", address: "Boulevard de l'Énergie" },
    { code: "SER", name: "Serres agricoles", district: "OUEST", address: "Chemin des Serres" },
  ];
  const stopIds: Record<string, number> = {};
  for (const { district, ...stop } of stops) {
    const data = { ...stop, district_id: districtIds[district] };
    const row = await prisma.transitStop.upsert({ where: { code: stop.code }, create: data, update: data });
    stopIds[stop.code] = row.id;
  }
  const lines = [
    { code: "T1", name: "Tram Centre ↔ Sud", mode: "TRAM" as const, color: "#4a90ff", stops: ["HDV", "GDO", "RES", "BER"], every: 10 },
    { code: "B2", name: "Bus Nord ↔ Est", mode: "BUS" as const, color: "#f5a623", stops: ["ECO", "SAN", "HDV", "ENE"], every: 15 },
    {
      code: "N3",
      name: "Navette Serres ↔ Centre",
      mode: "SHUTTLE" as const,
      color: "#7ed321",
      stops: ["SER", "GDO", "HDV"],
      every: 30,
      status: "DISRUPTED" as const,
      status_message: "Travaux sur le chemin des Serres : retards d'environ 10 minutes. Le tram T1 reste une alternative depuis le Grand Dôme.",
    },
  ];
  for (const { stops: lineStops, every, ...line } of lines) {
    const row = await prisma.transitLine.upsert({ where: { code: line.code }, create: line, update: line });
    const ids = lineStops.map((code) => stopIds[code]);
    await prisma.transitLineStop.deleteMany({ where: { line_id: row.id } });
    await prisma.transitLineStop.createMany({ data: ids.map((stop_id, position) => ({ line_id: row.id, stop_id, position })) });
    await prisma.transitDeparture.deleteMany({ where: { line_id: row.id } });
    for (const [dayType, first, last, factor] of [
      ["WEEKDAY", "05:30", "23:00", 1],
      ["SATURDAY", "06:30", "23:00", 2],
      ["SUNDAY", "07:30", "21:00", 2],
    ] as const) {
      await prisma.transitDeparture.createMany({
        data: buildDepartures(row.id, ids, {
          dayType,
          first,
          last,
          everyMinutes: every * factor,
          minutesBetweenStops: 4,
          direction: stops.find((s) => s.code === lineStops[lineStops.length - 1])!.name,
        }),
      });
    }
  }

  // Staff, citizens, requests, appointments, information, interruptions, security, notifications
  await seedDemoScenario(prisma, { passwordHash, districtIds, serviceIds, procedureIds, reset: RESET });
  await seedAuditHistory(prisma);

  console.log("✅ Seed done%s. Demo accounts (password: %s):", RESET ? " (scenario reset)" : "", PASSWORD);
  for (const account of ACCOUNTS.filter((a) => a.email.endsWith("@novaterra.local"))) {
    console.log(`   ${account.role.padEnd(8)} ${account.email}`);
  }
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

/** A few immutable rows so the audit screens are not empty on a fresh database. Replaced on every seed. */
async function seedAuditHistory(prisma: PrismaClient) {
  await prisma.$executeRaw`DELETE FROM AuditLog WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.seed')) = 'demo'`;

  const [admin, agent, hanta] = await Promise.all([
    prisma.user.findUnique({ where: { email: "admin@novaterra.local" } }),
    prisma.user.findUnique({ where: { email: "agent@novaterra.local" } }),
    prisma.user.findUnique({ where: { email: "hanta.agent@novaterra.local" } }),
  ]);
  const service = await prisma.cityService.findUnique({ where: { slug: "prevention-sante" } });
  const request = await prisma.citizenRequest.findUnique({ where: { reference: requestReference(1) } });
  if (!admin || !agent || !service) return;

  const actor = (user: { id: number; name: string; last_name: string; role: "CITIZEN" | "AGENT" | "ADMIN" }) => ({
    actor_id: user.id,
    actor_role: user.role,
    actor_name: `${user.name} ${user.last_name}`,
  });
  const seed = { seed: "demo" };

  await prisma.auditLog.createMany({
    data: [
      {
        created_at: minutesAgo(2),
        ...actor(admin),
        action: "service.updated",
        entity: "CityService",
        entity_id: service.id,
        entity_label: service.name,
        changes: [{ field: "priority", from: "2", to: "5" }],
        metadata: seed,
        ip: "10.4.0.12",
      },
      {
        created_at: minutesAgo(18),
        ...actor(agent),
        action: "request.status_changed",
        entity: "CitizenRequest",
        entity_id: request?.id ?? null,
        entity_label: request?.reference ?? requestReference(1),
        changes: [{ field: "status", from: "IN_REVIEW", to: "IN_PROGRESS" }],
        metadata: seed,
        ip: "10.4.0.21",
      },
      {
        created_at: minutesAgo(46),
        ...actor(hanta ?? agent),
        action: "request.assigned",
        entity: "CitizenRequest",
        entity_id: request?.id ?? null,
        entity_label: request?.reference ?? requestReference(1),
        changes: [{ field: "assigned_agent_id", from: null, to: `${agent.name} ${agent.last_name}` }],
        metadata: seed,
        ip: "10.4.0.33",
      },
      {
        created_at: minutesAgo(90),
        ...actor(admin),
        action: "settings.updated",
        entity: "PlatformSetting",
        entity_label: "Paramètres de la plateforme",
        changes: [{ field: "registration_open", from: "false", to: "true" }],
        metadata: seed,
        ip: "10.4.0.12",
      },
      {
        created_at: minutesAgo(240),
        ...actor(admin),
        action: "security.2fa_enabled",
        entity: "User",
        entity_id: admin.id,
        entity_label: `${admin.name} ${admin.last_name}`,
        metadata: seed,
        ip: "10.4.0.12",
      },
      {
        created_at: minutesAgo(60 * 26),
        ...actor(agent),
        action: "auth.staff_login",
        entity: "User",
        entity_id: agent.id,
        entity_label: `${agent.name} ${agent.last_name}`,
        metadata: seed,
        ip: "10.4.0.21",
      },
    ],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
