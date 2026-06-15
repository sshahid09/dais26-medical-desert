import {
  Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@databricks/appkit-ui/react';
import { Search } from 'lucide-react';
import { TIER_ORDER, GAP_LABEL } from '../lib/format';
import type { DominantGap } from '../lib/types';

export interface Filters {
  q: string;
  state: string;
  tier: string;
  gap: string;
  minConfidence: string;
}

export const EMPTY_FILTERS: Filters = { q: '', state: 'all', tier: 'all', gap: 'all', minConfidence: 'Low' };

function LabeledSelect({
  label, value, onChange, children,
}: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </label>
  );
}

export function FilterRail({
  filters, onChange, states,
}: { filters: Filters; onChange: (f: Filters) => void; states: string[] }) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const gaps = Object.keys(GAP_LABEL) as DominantGap[];

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Search district</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="District name…"
            className="pl-8"
          />
        </div>
      </label>

      <LabeledSelect label="State / UT" value={filters.state} onChange={(v) => set({ state: v })}>
        <SelectItem value="all">All states</SelectItem>
        {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
      </LabeledSelect>

      <LabeledSelect label="Severity tier" value={filters.tier} onChange={(v) => set({ tier: v })}>
        <SelectItem value="all">All tiers</SelectItem>
        {TIER_ORDER.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
      </LabeledSelect>

      <LabeledSelect label="Dominant gap" value={filters.gap} onChange={(v) => set({ gap: v })}>
        <SelectItem value="all">Any gap</SelectItem>
        {gaps.map((g) => <SelectItem key={g} value={g}>{GAP_LABEL[g]}</SelectItem>)}
      </LabeledSelect>

      <LabeledSelect label="Minimum data confidence" value={filters.minConfidence} onChange={(v) => set({ minConfidence: v })}>
        <SelectItem value="Low">Any confidence</SelectItem>
        <SelectItem value="Medium">Medium &amp; High</SelectItem>
        <SelectItem value="High">High only</SelectItem>
      </LabeledSelect>
    </div>
  );
}
