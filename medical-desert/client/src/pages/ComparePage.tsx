import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Skeleton, Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@databricks/appkit-ui/react';
import { X, ArrowRight } from 'lucide-react';
import type { DistrictFull } from '../lib/types';
import { fetchCompare } from '../lib/api';
import { useCompare } from '../lib/compareStore';
import { TierBadge, ConfidenceBadge } from '../components/Badges';
import { fmtNum, fmtKm, GAP_LABEL, TIER_COLOR } from '../lib/format';

type Row = { label: string; render: (d: DistrictFull) => React.ReactNode; group?: boolean };

const ROWS: Row[] = [
  { label: 'Scoring', render: () => null, group: true },
  { label: 'Medical Desert Score', render: (d) => <span className="font-bold" style={{ color: TIER_COLOR[d.severity_tier] }}>{fmtNum(d.medical_desert_score, 1)}</span> },
  { label: 'Severity tier', render: (d) => <TierBadge tier={d.severity_tier} /> },
  { label: 'Dominant gap', render: (d) => GAP_LABEL[d.dominant_gap] },
  { label: 'Confidence', render: (d) => <ConfidenceBadge confidence={d.confidence} /> },
  { label: 'Recommended intervention', render: (d) => <span className="text-xs">{d.recommended_intervention}</span> },
  { label: 'Components', render: () => null, group: true },
  { label: 'Supply shortage', render: (d) => fmtNum(d.supply_score, 0) },
  { label: 'Access / distance', render: (d) => fmtNum(d.access_score, 0) },
  { label: 'Vulnerability', render: (d) => fmtNum(d.vulnerability_score, 0) },
  { label: 'Health burden', render: (d) => fmtNum(d.burden_score, 0) },
  { label: 'Specialty gap', render: (d) => fmtNum(d.specialty_gap_score, 0) },
  { label: 'Supply & access', render: () => null, group: true },
  { label: 'Facilities', render: (d) => fmtNum(d.n_facilities) },
  { label: 'Doctors', render: (d) => fmtNum(d.total_doctors) },
  { label: 'Nearest facility', render: (d) => fmtKm(d.km_nearest_facility) },
  { label: 'Maternal-capable facilities', render: (d) => fmtNum(d.n_maternal_facilities) },
  { label: 'Need & burden (NFHS-5)', render: () => null, group: true },
  { label: 'Institutional births', render: (d) => fmtNum(d.institutional_birth_pct, 1, '%') },
  { label: 'Child vaccination', render: (d) => fmtNum(d.child_vax_pct, 1, '%') },
  { label: 'Under-5 stunting', render: (d) => fmtNum(d.child_stunted_pct, 1, '%') },
  { label: 'Women anaemia', render: (d) => fmtNum(d.women_anaemic_pct, 1, '%') },
  { label: 'Health insurance', render: (d) => fmtNum(d.insurance_pct, 1, '%') },
  { label: 'Female literacy', render: (d) => fmtNum(d.female_literacy_pct, 1, '%') },
];

export function ComparePage() {
  const { keys, remove, clear } = useCompare();
  const [data, setData] = useState<DistrictFull[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (keys.length === 0) { setData([]); return; }
    setLoading(true);
    fetchCompare(keys).then(setData).catch(() => setData([])).finally(() => setLoading(false));
  }, [keys]);

  // keep column order aligned to keys
  const ordered = keys
    .map((k) => data.find((d) => `${d.district_name}|${d.state_ut}` === k))
    .filter((d): d is DistrictFull => !!d);

  if (keys.length === 0) {
    return (
      <Empty className="mt-16">
        <EmptyHeader>
          <EmptyTitle>No districts to compare yet</EmptyTitle>
          <EmptyDescription>Add 2–4 districts from the rankings to compare need, supply, access, and recommendations side by side.</EmptyDescription>
        </EmptyHeader>
        <Button onClick={() => navigate('/districts')}>Go to district rankings <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Compare districts</h2>
          <p className="text-sm text-muted-foreground">{keys.length} selected · need vs. supply vs. access, side by side.</p>
        </div>
        <Button variant="outline" size="sm" onClick={clear}>Clear all</Button>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 bg-card p-3 text-left font-medium text-muted-foreground w-48">Metric</th>
                {ordered.map((d) => (
                  <th key={`${d.district_name}|${d.state_ut}`} className="p-3 text-left align-top min-w-[180px]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-foreground">{d.district_name}</div>
                        <div className="text-xs font-normal text-muted-foreground">{d.state_ut}</div>
                      </div>
                      <button type="button" onClick={() => remove(`${d.district_name}|${d.state_ut}`)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) =>
                row.group ? (
                  <tr key={row.label} className="bg-secondary/40">
                    <td colSpan={ordered.length + 1} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</td>
                  </tr>
                ) : (
                  <tr key={row.label} className="border-b last:border-0">
                    <td className="sticky left-0 bg-card p-3 text-muted-foreground">{row.label}</td>
                    {ordered.map((d) => <td key={`${d.district_name}|${d.state_ut}`} className="p-3 text-foreground">{row.render(d)}</td>)}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
