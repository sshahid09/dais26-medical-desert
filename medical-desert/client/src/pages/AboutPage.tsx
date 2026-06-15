import { useEffect, useState } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@databricks/appkit-ui/react';
import { Info } from 'lucide-react';
import type { StatsResponse } from '../lib/types';
import { fetchStats } from '../lib/api';
import { Kpi } from '../components/Kpi';
import { COMPONENT_WEIGHTS, GAP_COLOR, fmtNum } from '../lib/format';

export function AboutPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  useEffect(() => { fetchStats().then(setStats).catch(() => undefined); }, []);
  const dq = stats?.dataQuality;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Methodology &amp; data</h2>
        <p className="text-sm text-muted-foreground">How the Medical Desert Score is built — and what to trust about it.</p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">The score</h3>
        <p className="text-sm text-muted-foreground">
          Each district gets a 0–100 <strong className="text-foreground">Medical Desert Score</strong> (higher = more underserved), a weighted blend of five
          components, each normalized against the national distribution of all scored districts:
        </p>
        <div className="space-y-2">
          {COMPONENT_WEIGHTS.map((c) => (
            <div key={c.key} className="flex items-center gap-3 text-sm">
              <span className="w-10 font-semibold text-foreground">{Math.round(c.weight * 100)}%</span>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: GAP_COLOR[c.gap] }} />
              <span className="text-foreground">{c.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Data sources</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li><strong className="text-foreground">NFHS-5 district health indicators</strong> — need, burden &amp; vulnerability (maternal/child health, nutrition, social determinants).</li>
          <li><strong className="text-foreground">Facility registry</strong> — supply &amp; specialty signals (type, operator, doctors, beds, coordinates), multi-source and deduplicated.</li>
          <li><strong className="text-foreground">India Post pincode directory</strong> — spatial join between facilities and districts (Haversine distance from district centroids).</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Curated into Delta gold tables in Unity Catalog and snapshot-synced into Lakebase Postgres for sub-10ms reads.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Data coverage</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Districts scored" value={fmtNum(dq?.districts_scored)} />
          <Kpi label="With facility match" value={fmtNum(dq?.supply_matched)} sub={dq ? `of ${fmtNum(dq.districts_scored)}` : undefined} />
          <Kpi label="Facilities" value={fmtNum(dq?.facilities_total)} sub={dq ? `${fmtNum(dq.facilities_mapped)} geo-mapped` : undefined} />
          <Kpi label="Indicator completeness" value={dq ? `${Math.round(dq.avg_completeness * 100)}%` : '—'} />
        </div>
      </section>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Read the score as evidence, not ground truth</AlertTitle>
        <AlertDescription>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
            <li>NFHS-5 fieldwork was ~2019–2021; conditions may have shifted.</li>
            <li>The facility registry is incomplete and deduplicated — very low counts may mean <em>under-reporting</em>, not confirmed absence (these are flagged Low confidence).</li>
            <li>Supply is an absolute count — no population denominator exists in-catalog, so it is not per-capita.</li>
            <li>Districts are matched to facilities via pincode centroids, not true catchment areas.</li>
            <li>Relationships are correlation, not causation. Validate with local stakeholders before acting.</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
