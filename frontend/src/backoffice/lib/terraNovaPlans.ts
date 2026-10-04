// D19: which plan covers each Terra Nova request, from the indexes of project-plan/README.md
// (PLAN-NN, end to end) and back-office-only-plan/README.md (BO-NN). To replace with the
// FeatureDelivery register (project-plan/10 § 3.3) once it exists.

export interface PlanCoverage {
  /** PLAN-NN and/or BO-NN */
  plans: string[]
  /** why there is no plan, or what the back-office does */
  note?: string
}

const PLAN: Record<string, string> = {
  D01: '01', D03: '01', D08: '01', D09: '01', F33: '01', F34: '01', F37: '01',
  D05: '02', D07: '02', D15: '02', F28: '02', F32: '02', F38: '02',
  D04: '03', D11: '03', D16: '03', D17: '03', F22: '03', F25: '03', F26: '03',
  D06: '04', D18: '04', F29: '04', F30: '04', F31: '04',
  F39: '05', F40: '05',
  F36: '06',
  F45: '07', F46: '07',
  D20: '08', F21: '08', F23: '08', F24: '08', F41: '08', F42: '08', F43: '08', F44: '08',
  D12: '09', D13: '09', F35: '09',
  D19: '10', F47: '10', F48: '10',
  F95: '11',
}

const BO: Record<string, string> = {
  D04: '01', D11: '01', D17: '01', F22: '01', F25: '01', F49: '01',
  D19: '02', F50: '02',
  F47: '03', F48: '03',
  D08: '04', D09: '04', F34: '04',
  D02: '05', F37: '05', F53: '05', F54: '05',
  D05: '06', D07: '06', F28: '06', F38: '06', F63: '06', F64: '06',
  D06: '07', D18: '07', F29: '07', F30: '07', F31: '07',
  F39: '08', F40: '08',
  D13: '09', F36: '09', F45: '09', F46: '09',
  F51: '10', F52: '10', F65: '10', F66: '10', F67: '10', F68: '10',
}

const NOTES: Record<string, string> = {
  D14: 'Exclu : multilingue',
  F27: 'Exclu : multilingue',
  F55: 'Côté habitant, sans écran back-office',
  F56: 'Côté habitant, sans écran back-office',
  F57: 'Règle transverse (BO-00)',
  F58: 'Règle transverse (BO-00)',
  F59: 'Règle transverse (BO-00)',
  F60: 'Règle transverse (BO-00)',
  F61: 'Règle transverse (BO-00)',
  F62: 'Règle transverse (BO-00)',
}

export function planFor(code: string): PlanCoverage {
  const plans = [PLAN[code] && `PLAN-${PLAN[code]}`, BO[code] && `BO-${BO[code]}`].filter((p): p is string => Boolean(p))
  return { plans, note: NOTES[code] ?? (plans.length ? undefined : 'Pas encore planifiée') }
}
