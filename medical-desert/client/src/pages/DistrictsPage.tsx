import { useEffect, useMemo, useState } from 'react';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Skeleton, Alert, AlertTitle, AlertDescription, Button,
} from '@databricks/appkit-ui/react';
import { Plus, Check } from 'lucide-react';
import type { DistrictListItem, StatsResponse } from '../lib/types';
import { fetchStats, fetchDistricts } from '../lib/api';
import { EMPTY_FILTERS, FilterRail } from '../components/FilterRail';
import type { Filters } from '../components/FilterRail';
import { DistrictDetail } from '../components/DistrictDetail';
import { TierBadge, ConfidenceBadge } from '../components/Badges';
import { fmtNum, fmtKm, GAP_LABEL, GAP_COLOR } from '../lib/format';
import { useCompare } from '../lib/compareStore';

export function DistrictsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [districts, setDistricts] = useState<DistrictListItem[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DistrictListItem | null>(null);
  const { keys, toggle, has } = useCompare();

  useEffect(() => { fetchStats().then(setStats).catch(() => undefined); }, []);
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchDistricts({ ...filters, limit: 1000 })
      .then(setDistricts)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load districts'))
      .finally(() => setLoading(false));
  }, [filters]);

  const states = useMemo(() => stats?.states.map((s) => s.state_ut) ?? [], [stats]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-foreground">District rankings</h2>
        <p className="text-sm text-muted-foreground">All scored districts, ranked by Medical Desert Score. Add up to 4 to the compare tray.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <aside className="rounded-xl border bg-card p-4 h-fit">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Filters</h3>
          <FilterRail filters={filters} onChange={setFilters} states={states} />
          <p className="mt-4 text-xs text-muted-foreground">
            {keys.length > 0 ? <>Compare tray: <span className="font-semibold text-foreground">{keys.length}/4</span></> : 'Showing'} {' '}
            <span className="font-semibold text-foreground">{districts.length}</span> districts.
          </p>
        </aside>

        <div className="rounded-xl border bg-card overflow-hidden">
          {error && (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Couldn't load districts</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div>
          )}
          {loading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead className="hidden md:table-cell">State / UT</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="hidden sm:table-cell">Tier</TableHead>
                    <TableHead className="hidden lg:table-cell">Dominant gap</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Facilities</TableHead>
                    <TableHead className="hidden xl:table-cell text-right">Nearest</TableHead>
                    <TableHead className="hidden md:table-cell">Confidence</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {districts.map((d, i) => (
                    <TableRow
                      key={`${d.district_name}|${d.state_ut}`}
                      className="cursor-pointer"
                      onClick={() => setSelected(d)}
                    >
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium text-foreground">{d.district_name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{d.state_ut}</TableCell>
                      <TableCell className="font-semibold">{fmtNum(d.medical_desert_score, 1)}</TableCell>
                      <TableCell className="hidden sm:table-cell"><TierBadge tier={d.severity_tier} /></TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs font-medium" style={{ color: GAP_COLOR[d.dominant_gap] }}>{GAP_LABEL[d.dominant_gap]}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right">{fmtNum(d.n_facilities)}</TableCell>
                      <TableCell className="hidden xl:table-cell text-right text-muted-foreground">{fmtKm(d.km_nearest_facility)}</TableCell>
                      <TableCell className="hidden md:table-cell"><ConfidenceBadge confidence={d.confidence} /></TableCell>
                      <TableCell>
                        <Button
                          variant={has(d) ? 'default' : 'ghost'}
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); toggle(d); }}
                          aria-label={has(d) ? 'Remove from compare' : 'Add to compare'}
                          title={has(d) ? 'Remove from compare' : 'Add to compare'}
                        >
                          {has(d) ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {districts.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No districts match these filters.</p>}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>District detail</DialogTitle>
          </DialogHeader>
          {selected && <div className="mt-2"><DistrictDetail name={selected.district_name} state={selected.state_ut} /></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
