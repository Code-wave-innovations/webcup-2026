import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useActor } from '../../layout/persona'
import { ANNOUNCEMENT_CATEGORY_LABEL, PUBLICATION_LABEL } from '../../lib/labels'
import { formatDateTime } from '../../lib/format'
import type { Announcement, AnnouncementCategory, PublicationStatus } from '../../mocks/types'
import { saveAnnouncement, setAnnouncementStatus, useContentStore } from '../../stores/contentStore'
import { Flag, Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Field, Select, Tabs, TextArea, TextInput, Toggle } from '../../ui/Controls'
import { EmptyState } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './admin.module.css'

type Draft = Omit<Announcement, 'id' | 'created_at' | 'published_at' | 'author_id'> & { id?: number }

const EMPTY: Draft = { title: '', summary: '', content: '', category: 'NEWS', status: 'DRAFT', is_important: false, is_pinned: false }

/** D06 / D18: municipal announcements, with a live preview of what residents will see. */
export default function AnnouncementsPage() {
  const actor = useActor()
  const announcements = useContentStore((s) => s.announcements)
  const [tab, setTab] = useState<PublicationStatus>('PUBLISHED')
  const [draft, setDraft] = useState<Draft>(EMPTY)

  const list = announcements
    .filter((a) => a.status === tab)
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at))
  const count = (s: PublicationStatus) => announcements.filter((a) => a.status === s).length

  const save = (status: PublicationStatus) => {
    saveAnnouncement({ ...draft, summary: draft.summary || null, status, author_id: actor.id }, actor.id)
    setDraft(EMPTY)
    setTab(status)
  }

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader simulated
        title="Annonces municipales"
        codes={['D06', 'D18', 'F30']}
        lead="Publiez les informations utiles à tous. Une annonce marquée importante notifie immédiatement tous les habitants."
        actions={
          <Button icon="plus" onClick={() => setDraft(EMPTY)}>
            Nouvelle annonce
          </Button>
        }
      />

      <div className={[layout.grid, layout.split].join(' ')}>
        <div className={layout.stack}>
          <Tabs<PublicationStatus>
            idPrefix="news"
            label="Statut"
            value={tab}
            onChange={setTab}
            tabs={(['PUBLISHED', 'DRAFT', 'ARCHIVED'] as const).map((s) => ({ value: s, label: PUBLICATION_LABEL[s] + 's', count: count(s) }))}
          />
          <div id="news-panel" role="tabpanel" aria-labelledby={`news-tab-${tab}`} className={layout.stack}>
            {list.length === 0 && <EmptyState title="Aucune annonce" icon="megaphone" />}
            <AnimatePresence initial={false}>
              {list.map((a) => (
                  <Panel
                    key={a.id}
                    layout
                    initial="hidden"
                    animate="show"
                    exit={{ opacity: 0, x: 30 }}
                    kicker={ANNOUNCEMENT_CATEGORY_LABEL[a.category]}
                    title={a.title}
                    accent={a.is_important ? 'ember' : undefined}
                    actions={
                      <>
                        {a.status === 'DRAFT' && (
                          <Button size="sm" variant="primary" icon="send" onClick={() => setAnnouncementStatus(a.id, 'PUBLISHED', actor.id)}>
                            Publier
                          </Button>
                        )}
                        {a.status === 'PUBLISHED' && (
                          <Button size="sm" variant="subtle" onClick={() => setAnnouncementStatus(a.id, 'ARCHIVED', actor.id)}>
                            Archiver
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" icon="edit" iconOnly onClick={() => setDraft({ ...a, summary: a.summary ?? '' })}>
                          Modifier {a.title}
                        </Button>
                      </>
                    }
                  >
                    {a.summary && <p className={layout.muted}>{a.summary}</p>}
                    <div className={layout.row}>
                      {a.is_important && <Flag icon="zap" tone="ember">Importante · notifiée</Flag>}
                      {a.is_pinned && <Flag icon="star" tone="ice">Épinglée</Flag>}
                      <span className={[layout.muted, layout.small].join(' ')}>
                        {a.published_at ? `Publiée le ${formatDateTime(a.published_at)}` : `Créée le ${formatDateTime(a.created_at)}`}
                      </span>
                    </div>
                  </Panel>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <Panel kicker={draft.id ? 'Modification' : 'Rédaction'} title={draft.id ? 'Modifier l’annonce' : 'Nouvelle annonce'} accent="ice">
          <Field label="Titre">{(id) => <TextInput id={id} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />}</Field>
          <Field label="Résumé" hint="Affiché dans la liste et dans la notification.">
            {(id, d) => <TextInput id={id} aria-describedby={d} value={draft.summary ?? ''} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />}
          </Field>
          <Field label="Contenu">{(id) => <TextArea id={id} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} rows={5} />}</Field>
          <Field label="Catégorie">
            {(id) => (
              <Select id={id} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as AnnouncementCategory })}>
                {(Object.keys(ANNOUNCEMENT_CATEGORY_LABEL) as AnnouncementCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {ANNOUNCEMENT_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Toggle checked={draft.is_important} onChange={(v) => setDraft({ ...draft, is_important: v })} label="Importante : notifier tous les habitants (F30)" />
          <Toggle checked={draft.is_pinned} onChange={(v) => setDraft({ ...draft, is_pinned: v })} label="Épingler en tête de liste" />

          <div className={styles.preview}>
            <span className={styles.previewLabel}>Aperçu habitant</span>
            <div className={styles.newsCard}>
              <div className={layout.row}>
                <Tag tone="ice">{ANNOUNCEMENT_CATEGORY_LABEL[draft.category]}</Tag>
                {draft.is_important && <Tag tone="ember">Important</Tag>}
              </div>
              <h3>{draft.title || 'Titre de l’annonce'}</h3>
              <p className={layout.muted}>{draft.summary || 'Résumé en une phrase.'}</p>
            </div>
          </div>

          <div className={layout.row}>
            <Button variant="ghost" onClick={() => save('DRAFT')} disabled={!draft.title.trim()}>
              Enregistrer le brouillon
            </Button>
            <Button variant="primary" icon="send" onClick={() => save('PUBLISHED')} disabled={!draft.title.trim() || !draft.content.trim()}>
              Publier
            </Button>
          </div>
        </Panel>
      </div>
    </motion.div>
  )
}
