import { useEffect } from 'react'
import { novaScenes } from '../../experience/nova/behavior/scenes'
import { criticalAlertOf, useAlertFeed } from '../../features/announcements/alertFeedStore'
import { STATUSES } from '../../features/reports/reportModel'
import { useReportStore } from '../../features/reports/reportStore'

/**
 * What Nova does when something happens in the city's features. The features know nothing of Nova:
 * the page, which composes them, translates their state changes into Nova's scenes.
 */
export function useNovaCityReactions(): void {
  useEffect(
    () =>
      useReportStore.subscribe((state, previous) => {
        const report = state.report
        if (!report) return
        if (!previous.report) novaScenes.reportSent(report.code)
        else if (report.status !== previous.report.status) novaScenes.reportProgress(STATUSES[report.status].name)
      }),
    [],
  )

  // D18: a critical alert that concerns the resident: Nova reads out what to do
  useEffect(
    () =>
      useAlertFeed.subscribe((state, previous) => {
        const critical = criticalAlertOf(state.alerts)
        if (critical?.id === criticalAlertOf(previous.alerts)?.id) return
        novaScenes.alert(critical !== null, critical ? `${critical.title}. ${critical.instructions ?? critical.message}` : '')
      }),
    [],
  )
}
