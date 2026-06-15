import type { SeverityTier, Confidence, DominantGap, ComponentScores } from './types';

// Severity tier → color (sequential red→green, IBCS-style honest ordering).
export const TIER_COLOR: Record<SeverityTier, string> = {
  Critical: '#b42318',
  'High-risk': '#e8590c',
  Moderate: '#c77700',
  Adequate: '#157a4a',
};

export const TIER_ORDER: SeverityTier[] = ['Critical', 'High-risk', 'Moderate', 'Adequate'];

export const CONFIDENCE_COLOR: Record<Confidence, string> = {
  High: '#157a4a',
  Medium: '#c77700',
  Low: '#5b6770',
};

export const GAP_LABEL: Record<DominantGap, string> = {
  supply: 'Supply shortage',
  access: 'Access / distance',
  vulnerability: 'Vulnerability',
  burden: 'Health burden',
  specialty: 'Specialty gap',
};

export const GAP_COLOR: Record<DominantGap, string> = {
  supply: '#b42318',
  access: '#e8590c',
  vulnerability: '#7c3aed',
  burden: '#c77700',
  specialty: '#0e7490',
};

// Score weighting (mirror of the SQL scoring model) for "why this gap" explanations.
export const COMPONENT_WEIGHTS: { key: keyof ComponentScores; gap: DominantGap; weight: number; label: string; description: string }[] = [
  { key: 'supply_score', gap: 'supply', weight: 0.3, label: 'Supply shortage',
    description: 'Facility density, doctor-to-population ratio, bed availability, and public vs private mix. Districts with few facilities per capita score higher here.' },
  { key: 'access_score', gap: 'access', weight: 0.25, label: 'Access / distance',
    description: 'Distance to the nearest facility and nearest maternal care. Penalises districts where residents must travel far to reach care.' },
  { key: 'vulnerability_score', gap: 'vulnerability', weight: 0.2, label: 'Vulnerability',
    description: 'Population vulnerability: female literacy, sanitation access, health insurance coverage, and poverty proxies — groups least able to overcome access gaps.' },
  { key: 'burden_score', gap: 'burden', weight: 0.15, label: 'Health burden',
    description: 'Current poor health outcomes: child stunting, anaemia prevalence, low vaccination rates, and low institutional birth rates.' },
  { key: 'specialty_gap_score', gap: 'specialty', weight: 0.1, label: 'Specialty gap',
    description: 'Whether the district lacks specialist services (maternal, paediatric, surgical) relative to its health profile.' },
];

export function fmtNum(v: number | null | undefined, digits = 0, suffix = ''): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return `${Number(v).toLocaleString(undefined, { maximumFractionDigits: digits })}${suffix}`;
}

export function fmtKm(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `${Number(v).toFixed(0)} km`;
}
