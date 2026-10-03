import type { TerraNovaFeed, TerraNovaRequest } from '../../api/types'

/** D19: when the next wave lands. The server's minutes count from when it fetched the feed. */
export const nextWaveAt = (feed: TerraNovaFeed) =>
  Date.parse(feed.fetched_at) + feed.data.session.minutes_until_next_wave * 60_000

/** Latest wave first, then the most recent within a wave. */
export const byRecency = (a: TerraNovaRequest, b: TerraNovaRequest) =>
  (b.wave_number ?? 0) - (a.wave_number ?? 0) || b.sort_order - a.sort_order
