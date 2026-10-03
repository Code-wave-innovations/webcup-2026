import type { DashboardView } from '../lib/dashboardView'
import { FilterChips } from '../ui/Controls'

/** F50: « Vue simple / Vue détaillée », in the header of both dashboards. */
export function DashboardViewToggle({ value, onChange }: { value: DashboardView; onChange: (view: DashboardView) => void }) {
  return (
    <span data-print-hide>
      <FilterChips<DashboardView>
        label="Affichage du tableau de bord"
        value={value}
        onChange={onChange}
        options={[
          { value: 'simple', label: 'Vue simple' },
          { value: 'detailed', label: 'Vue détaillée' },
        ]}
      />
    </span>
  )
}
