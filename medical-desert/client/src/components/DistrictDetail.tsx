import { useEffect, useState } from 'react';
import { Skeleton, Separator } from '@databricks/appkit-ui/react';
import { AlertTriangle, Stethoscope, Hospital, Ruler, ShieldAlert } from 'lucide-react';
import type { DistrictDetailResponse, EvidenceDriver } from '../lib/types';
import { fetchDistrict } from '../lib/api';
import {
  TIER_COLOR, GAP_COLOR, fmtNum, fmtKm,
} from '../lib/format';
import { TierBadge, ConfidenceBadge } from './Badges';
import { ScoreBreakdown } from './ScoreBreakdown';
import { RecommendedActions } from './RecommendedActions';

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function DriverRow({ d }: { d: EvidenceDriver }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 text-xs">
        <div className="font-medium text-foreground leading-tight">{d.driver_label}</div>
        <div className="text-muted-foreground">{fmtNum(d.value, 1)} <span className="text-muted-foreground/70">{d.unit}</span></div>
      </div>
      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, d.severity)}%`, backgroundColor: GAP_COLOR[d.category] }} />
      </div>
      <code className="hidden md:block w-44 shrink-0 truncate text-[10px] text-muted-foreground" title={d.source_field}>{d.source_field}</code>
    </div>
  );
}

const KEY_INDICATORS: { key: keyof DistrictDetailResponse['district']; label: string; suffix?: string }[] = [
  { key: 'institutional_birth_pct', label: 'Institutional births', suffix: '%' },
  { key: 'child_vax_pct', label: 'Child full vaccination', suffix: '%' },
  { key: 'child_stunted_pct', label: 'Under-5 stunting', suffix: '%' },
  { key: 'women_anaemic_pct', label: 'Women anaemia', suffix: '%' },
  { key: 'insurance_pct', label: 'Health insurance', suffix: '%' },
  { key: 'female_literacy_pct', label: 'Female literacy', suffix: '%' },
  { key: 'sanitation_pct', label: 'Improved sanitation', suffix: '%' },
  { key: 'electricity_pct', label: 'Electricity', suffix: '%' },
];

export function DistrictDetail({ name, state }: { name: string; state: string }) {
  const [data, setData] = useState<DistrictDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchDistrict(name, state)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load district'))
      .finally(() => setLoading(false));
  }, [name, state]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (error) return <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>;
  if (!data) return null;

  const d = data.district;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-2xl font-bold text-foreground">{d.district_name}</h2>
          <TierBadge tier={d.severity_tier} />
        </div>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          <span>{d.state_ut}</span>
          <span>·</span>
          <ConfidenceBadge confidence={d.confidence} />
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold" style={{ color: TIER_COLOR[d.severity_tier] }}>{fmtNum(d.medical_desert_score, 1)}</span>
        <span className="text-sm text-muted-foreground">/ 100 Medical Desert Score</span>
      </div>

      {/* Recommended action plan */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Recommended action plan</h3>
        <RecommendedActions district={d} />
      </div>

      {/* Score breakdown */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Score breakdown</h3>
        <ScoreBreakdown scores={d} dominant={d.dominant_gap} />
      </div>

      <Separator />

      {/* Evidence drivers */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Top evidence drivers</h3>
        <div className="space-y-2.5">
          {data.drivers.map((dr) => <DriverRow key={dr.source_field} d={dr} />)}
        </div>
      </div>

      {/* Supply snapshot */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Supply &amp; access</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Stat icon={<Hospital className="h-3.5 w-3.5" />} label="Facilities" value={fmtNum(d.n_facilities)} />
          <Stat icon={<Stethoscope className="h-3.5 w-3.5" />} label="Doctors" value={fmtNum(d.total_doctors)} />
          <Stat label="Beds" value={fmtNum(d.total_beds)} />
          <Stat label="Public / Private" value={`${fmtNum(d.n_public)} / ${fmtNum(d.n_private)}`} />
          <Stat icon={<Ruler className="h-3.5 w-3.5" />} label="Nearest facility" value={fmtKm(d.km_nearest_facility)} />
          <Stat label="Nearest maternal" value={fmtKm(d.km_nearest_maternal)} />
        </div>
      </div>

      {/* Key indicators */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Key NFHS-5 indicators</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {KEY_INDICATORS.map((ind) => (
            <div key={String(ind.key)} className="rounded-lg border bg-card p-2.5">
              <div className="text-[11px] leading-tight text-muted-foreground">{ind.label}</div>
              <div className="mt-0.5 text-sm font-semibold text-foreground">{fmtNum(d[ind.key] as number, 1, ind.suffix)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Uncertainty */}
      <div className="rounded-lg border bg-secondary/40 p-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <AlertTriangle className="h-4 w-4" style={{ color: '#c77700' }} /> Evidence &amp; uncertainty
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{d.confidence_notes}</p>
        <p className="mt-1.5 text-xs italic text-muted-foreground">
          Indicator completeness {fmtNum(d.indicator_completeness * 100, 0, '%')} · correlation, not causation · validate locally before acting.
        </p>
      </div>

      {/* Nearby facilities */}
      {data.facilities.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Mapped facilities ({data.facilities.length})</h3>
          <div className="max-h-56 overflow-y-auto rounded-lg border divide-y">
            {data.facilities.map((f) => (
              <div key={f.facility_id} className="flex items-center gap-2 px-3 py-2 text-sm">
                {f.has_maternal && <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-success" />}
                <span className="flex-1 truncate text-foreground" title={f.name}>{f.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground capitalize">{f.facility_type} · {f.operator_type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
