import { motion } from 'motion/react'
import type { TerraNovaRequest } from '../mocks/types'
import { Tag } from '../ui/Badges'
import { rise } from '../ui/motion'
import styles from './shared.module.css'

const DIFFICULTY_TONE = { Facile: 'ok', Moyenne: 'progress', Difficile: 'alert' } as const
const TYPE_TONE: Record<string, 'ice' | 'taken' | 'alert' | 'ember'> = {
  Institution: 'ice',
  Citoyen: 'taken',
  Alerte: 'alert',
  'Alerte sécurité': 'alert',
}

/** D19: one request from the official Terra Nova API. */
export function TerraNovaCard({ request, fresh }: { request: TerraNovaRequest; fresh?: boolean }) {
  return (
    <motion.article variants={rise} className={styles.tnCard} aria-label={`${request.request_code} — ${request.requester_name}`}>
      <div className={styles.tnHead}>
        <span className={styles.tnCode}>{request.request_code}</span>
        {fresh && <Tag tone="ember" pulse>Nouvelle vague</Tag>}
      </div>
      <p className={styles.tnFrom}>{request.requester_name}</p>
      <p className={styles.tnMessage}>{request.message_public}</p>
      <div className={styles.tnFoot}>
        <Tag tone={TYPE_TONE[request.requester_type] ?? 'neutral'}>{request.requester_type}</Tag>
        <Tag tone={DIFFICULTY_TONE[request.difficulty]}>{request.difficulty}</Tag>
        {request.is_ai_request && <Tag tone="taken">IA</Tag>}
        <span className={styles.xp}>{request.xp_total} XP</span>
      </div>
    </motion.article>
  )
}
