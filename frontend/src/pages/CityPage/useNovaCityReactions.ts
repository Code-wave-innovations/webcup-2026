import { useEffect } from 'react'
import { useDirectorStore } from '../../experience/director/directorStore'
import { novaScenes } from '../../experience/nova/behavior/scenes'
import { STATUSES } from '../../features/reports/reportModel'
import { useReportStore } from '../../features/reports/reportStore'

const ALERT_INSTRUCTION = "Alerte au dôme 2 ! Restez à l'intérieur et attendez les consignes."

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

  useEffect(
    () =>
      useDirectorStore.subscribe((state, previous) => {
        if (state.alert !== previous.alert) novaScenes.alert(state.alert, ALERT_INSTRUCTION)
      }),
    [],
  )
}
