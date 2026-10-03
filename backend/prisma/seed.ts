// Demo data for Terra Nova. Idempotent: safe to run several times.
// Usage: npm run seed   (SEED_PASSWORD overrides the demo accounts' password)
require("dotenv").config();
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD || "NovaTerra2026!";

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
    slug: "action-sociale",
    category: "solidarite",
    name: "Action sociale",
    summary: "Accompagnement des familles, seniors et personnes vulnérables.",
    keywords: "aide, social, famille, senior, vulnérable, accompagnement",
    icon: "hand-heart",
    priority: 5,
  },
];

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
    const row = await prisma.cityService.upsert({ where: { slug: service.slug }, create: data, update: data });
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

  const accounts = [
    { email: "admin@novaterra.local", name: "Ada", last_name: "Admin", role: "ADMIN" as const },
    { email: "agent@novaterra.local", name: "Alex", last_name: "Agent", role: "AGENT" as const },
    {
      email: "citoyen@novaterra.local",
      name: "Lucas",
      last_name: "Meyer",
      role: "CITIZEN" as const,
      district_id: districtIds.SUD,
      address: "12 rue du Réservoir",
      phone: "+00 600 000",
      onboarding_completed: true,
    },
    {
      email: "senior@novaterra.local",
      name: "Jean",
      last_name: "Morel",
      role: "CITIZEN" as const,
      district_id: districtIds.NORD,
      is_vulnerable: true,
    },
  ];
  const userIds: Record<string, number> = {};
  for (const account of accounts) {
    const row = await prisma.user.upsert({
      where: { email: account.email },
      create: { ...account, password_hash: passwordHash },
      update: { role: account.role },
    });
    userIds[account.email] = row.id;
  }

  if ((await prisma.announcement.count()) === 0) {
    const author_id = userIds["agent@novaterra.local"];
    await prisma.announcement.createMany({
      data: [
        {
          title: "La plateforme numérique de Terra Nova est ouverte",
          summary: "Créez votre compte pour accéder à vos démarches, signaler un problème et suivre vos demandes.",
          content: "Le Haut Conseil de Terra Nova inaugure la plateforme numérique centrale de la ville...",
          category: "NEWS",
          status: "PUBLISHED",
          is_pinned: true,
          published_at: new Date(),
          author_id,
        },
        {
          title: "Nouveaux horaires du centre de santé",
          summary: "Les consultations sont désormais ouvertes de 7h à 20h.",
          content: "À partir de cette semaine, le centre de santé élargit ses horaires de consultation...",
          category: "SERVICE_CHANGE",
          status: "PUBLISHED",
          published_at: new Date(),
          service_id: serviceIds["centre-de-sante"],
          author_id,
        },
        {
          title: "Collecte des encombrants : mode d'emploi",
          content: "Faites votre demande en ligne depuis le service Propreté urbaine & déchets...",
          category: "PRACTICAL_INFO",
          status: "PUBLISHED",
          published_at: new Date(),
          service_id: serviceIds["proprete-dechets"],
          author_id,
        },
      ],
    });
  }

  if ((await prisma.alert.count()) === 0) {
    const created_by_id = userIds["agent@novaterra.local"];
    // F29
    await prisma.alert.create({
      data: {
        title: "Montée des eaux dans le Quartier Sud",
        message: "Une montée inhabituelle du niveau de l'eau est observée dans le Quartier Sud.",
        category: "FLOOD",
        severity: "CRITICAL",
        audience: "DISTRICTS",
        instructions: "Évitez les berges et les sous-sols, montez dans les étages et suivez les consignes des secours.",
        source: "Centre de surveillance environnementale",
        created_by_id,
        districts: { create: [{ district_id: districtIds.SUD }] },
      },
    });
    // F31
    await prisma.alert.create({
      data: {
        title: "Vague de chaleur extrême",
        message: "Une vague de chaleur extrême touche plusieurs secteurs de la ville.",
        category: "HEATWAVE",
        severity: "WARNING",
        audience: "VULNERABLE",
        instructions: "Restez au frais, hydratez-vous régulièrement et prenez des nouvelles de vos proches isolés.",
        recommendations: [
          { title: "Personnes âgées", text: "Buvez de l'eau toutes les heures, même sans soif." },
          { title: "Enfants", text: "Évitez les sorties entre 12h et 16h." },
          { title: "Malades chroniques", text: "Contactez le centre de santé au moindre malaise." },
        ],
        source: "Agence sanitaire de Terra Nova",
        created_by_id,
      },
    });
  }

  const citizenId = userIds["citoyen@novaterra.local"];
  if ((await prisma.citizenRequest.count({ where: { citizen_id: citizenId } })) === 0) {
    await prisma.citizenRequest.create({
      data: {
        reference: "NT-DEMO-000001",
        type: "INCIDENT",
        subject: "Lampadaire cassé",
        message: "Le lampadaire devant le numéro 12 ne s'allume plus depuis deux jours.",
        category: "eclairage",
        citizen_id: citizenId,
        service_id: serviceIds["eclairage-voirie"],
        district_id: districtIds.SUD,
        location_label: "12 rue du Réservoir, Quartier Sud",
        events: { create: { type: "CREATED", to_status: "SUBMITTED", author_id: citizenId } },
      },
    });
    await prisma.citizenRequest.create({
      data: {
        reference: "NT-DEMO-000002",
        type: "PROCEDURE",
        subject: "Demande d'acte de naissance",
        message: "Je souhaite obtenir une copie intégrale de mon acte de naissance.",
        citizen_id: citizenId,
        service_id: serviceIds["etat-civil"],
        procedure_id: procedureIds["demande-acte-de-naissance"],
        status: "IN_PROGRESS",
        assigned_agent_id: userIds["agent@novaterra.local"],
        data: { full_name: "Lucas Meyer", birth_date: "1998-04-12", copy_type: "Copie intégrale" },
        events: {
          create: [
            { type: "CREATED", to_status: "SUBMITTED", author_id: citizenId },
            {
              type: "STATUS_CHANGED",
              from_status: "SUBMITTED",
              to_status: "IN_PROGRESS",
              message: "Votre demande est en cours de traitement.",
              author_id: userIds["agent@novaterra.local"],
            },
          ],
        },
      },
    });
  }

  console.log("✅ Seed done. Demo accounts (password: %s):", PASSWORD);
  for (const account of accounts) console.log(`   ${account.role.padEnd(8)} ${account.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
