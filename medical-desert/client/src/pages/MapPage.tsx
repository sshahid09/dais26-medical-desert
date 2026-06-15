import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, Skeleton, Alert, AlertTitle, AlertDescription,
} from '@databricks/appkit-ui/react';
import type { DistrictListItem, StatsResponse } from '../lib/types';
import { fetchStats, fetchDistricts } from '../lib/api';
import { EMPTY_FILTERS, FilterRail } from '../components/FilterRail';
import type { Filters } from '../components/FilterRail';
import { DesertMap } from '../components/DesertMap';
import { DistrictDetail } from '../components/DistrictDetail';
import { Kpi } from '../components/Kpi';
import { TierBadge } from '../components/Badges';
import { fmtNum, TIER_COLOR } from '../lib/format';

export function MapPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [districts, setDistricts] = useState<DistrictListItem[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DistrictListItem | null>(null);

  useEffect(() => { fetchStats().then(setStats).catch(() => undefined); }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchDistricts(filters)
      .then(setDistricts)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load districts'))
      .finally(() => setLoading(false));
  }, [filters]);

  const states = useMemo(() => stats?.states.map((s) => s.state_ut) ?? [], [stats]);
  const top = useMemo(() => districts.slice(0, 10), [districts]);
  const ov = stats?.overview;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Prioritization map</h2>
        <p className="text-sm text-muted-foreground">
          India's districts ranked where healthcare <span className="font-medium text-foreground">supply &amp; access</span> fall short of
          {' '}<span className="font-medium text-foreground">need &amp; health burden</span>. Click any district for evidence and a recommendation.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Districts scored" value={fmtNum(ov?.districts)} sub="NFHS-5 across 36 states/UTs"
          tooltip="Total districts scored using NFHS-5 survey data — the largest nationally representative health survey in India, covering all 36 states and union territories." />
        <Kpi label="Underserved" value={fmtNum(ov?.underserved)} sub="Critical + High-risk tiers" accent={TIER_COLOR.Critical}
          tooltip="Districts in the Critical or High-risk tier where healthcare supply and access fall significantly short of population need. These are the priority intervention targets." />
        <Kpi label="Facilities mapped" value={fmtNum(ov?.facilities)} sub="from the facility registry"
          tooltip="Healthcare facilities geo-located from the Virtue Foundation registry and matched to districts via India Post pincode data. Includes hospitals, clinics, pharmacies, and more." />
        <Kpi label="High-confidence" value={fmtNum(ov?.high_conf)} sub="districts with strong evidence" accent={TIER_COLOR.Adequate}
          tooltip="Districts where NFHS-5 indicator completeness is high (≥80%), giving stronger statistical confidence in the Medical Desert Score. Scores for low-completeness districts carry more uncertainty." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* Filter rail */}
        <aside className="rounded-xl border bg-card p-4 h-fit">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Filters</h3>
          <FilterRail filters={filters} onChange={setFilters} states={states} />
          <p className="mt-4 text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{districts.length}</span> districts.
          </p>
        </aside>

        {/* Map + top list */}
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Couldn't load data</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="rounded-xl border bg-card p-4">
            {loading ? (
              <Skeleton className="h-[480px] w-full" />
            ) : (
              <DesertMap districts={districts} selected={selected} onSelect={setSelected} />
            )}
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Top 10 most underserved (current filters)</h3>
            <div className="space-y-1">
              {top.map((d, i) => (
                <button
                  key={`${d.district_name}|${d.state_ut}`}
                  type="button"
                  onClick={() => setSelected(d)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-muted/60 transition-colors"
                >
                  <span className="w-5 text-xs font-semibold text-muted-foreground">{i + 1}</span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: TIER_COLOR[d.severity_tier] }} />
                  <span className="flex-1 truncate text-sm font-medium text-foreground">{d.district_name}</span>
                  <span className="hidden sm:block truncate text-xs text-muted-foreground w-32">{d.state_ut}</span>
                  <span className="w-10 text-right text-sm font-semibold text-foreground">{fmtNum(d.medical_desert_score, 0)}</span>
                </button>
              ))}
              {!loading && top.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No districts match these filters.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              District detail{selected && <TierBadge tier={selected.severity_tier} />}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="mt-2">
              <DistrictDetail name={selected.district_name} state={selected.state_ut} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
