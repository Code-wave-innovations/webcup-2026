export interface Announcement {
  source: string
  title: string
  detail?: string
}

/** Shown on top of the list while an alert is up. */
export const ALERT_ANNOUNCEMENT: Announcement = {
  source: "Sécurité, à l'instant",
  title: "Sas 2 : restez à l'intérieur du dôme 2",
  detail: 'Fermez les portes intérieures et gardez votre masque à portée.',
}

export const ANNOUNCEMENTS: readonly Announcement[] = [
  { source: 'Transports, il y a 12 min', title: 'Anneau nord : reprise de la navette à 20:00' },
  { source: 'Haut Conseil, il y a 1 h', title: "Exercice d'évacuation du dôme 2 demain à 14:00" },
]
