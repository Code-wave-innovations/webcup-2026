import { motion } from 'motion/react'
import type { TerraNovaRequest } from '../../api/types'
import { planFor } from '../lib/terraNovaPlans'
import { Tag } from '../ui/Badges'
import { rise } from '../ui/motion'
import styles from './shared.module.css'

const DIFFICULTY_TONE: Record<string, 'ok' | 'progress' | 'alert' | 'ember'> = {
  Facile: 'ok',
  Moyenne: 'progress',
  Difficile: 'alert',
  Expert: 'ember',
}
const TYPE_TONE: Record<string, 'ice' | 'taken' | 'alert' | 'ember'> = {
  Institution: 'ice',
  Citoyen: 'taken',
  Alerte: 'alert',
  'Alerte sécurité': 'alert',
}
const MAX_LEVEL = 4

/** D19: one request from the official Terra Nova API. `glow` lights it up briefly (new wave). */
export function TerraNovaCard({ request, glow, unseen }: { request: TerraNovaRequest; glow?: boolean; unseen?: boolean }) {
  const coverage = planFor(request.request_code)
  const level = Math.min(MAX_LEVEL, Math.max(1, request.difficulty_level || 1))
  return (
    <motion.article
      variants={rise}
      className={[styles.tnCard, glow && styles.tnGlow].filter(Boolean).join(' ')}
      aria-label={`${request.request_code} — ${request.requester_name}`}
    >
      <div className={styles.tnHead}>
        <span className={styles.tnCode}>{request.request_code}</span>
        <span className={styles.tnWave}>{request.wave_number === null ? 'Socle' : `Vague ${request.wave_number}`}</span>
        {unseen && <Tag tone="ember" pulse>Nouvelle</Tag>}
      </div>
      <p className={styles.tnFrom}>
        {request.requester_name} · {request.group_name}
      </p>
      <p className={styles.tnMessage}>{request.message_public}</p>
      <p className={styles.tnPlan}>
        {coverage.plans.length > 0 ? `Couverte par ${coverage.plans.join(' · ')}` : null}
        {coverage.plans.length > 0 && coverage.note ? ' — ' : null}
        {coverage.note}
      </p>
      <div className={styles.tnFoot}>
        <Tag tone={TYPE_TONE[request.requester_type] ?? 'neutral'}>{request.requester_type}</Tag>
        <Tag tone={DIFFICULTY_TONE[request.difficulty] ?? 'neutral'}>
          <span className={styles.tnLevel} aria-hidden="true">
            {'▮'.repeat(level)}
            {'▯'.repeat(MAX_LEVEL - level)}
          </span>
          {request.difficulty}
        </Tag>
        {request.is_ai_request && <Tag tone="taken">IA</Tag>}
        <span className={styles.xp}>{request.xp_total} XP</span>
      </div>
    </motion.article>
  )
}
