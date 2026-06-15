import { AlertTriangle, Clock, Calendar, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { DistrictFull } from '../lib/types';
import { GAP_COLOR, GAP_LABEL } from '../lib/format';
import {
  buildRecommendationPlan,
  PHASE_LABEL,
  URGENCY_COLOR,
  URGENCY_LABEL,
  type ActionItem,
  type ActionPhase,
} from '../lib/recommendations';

const PHASE_ICON: Record<ActionPhase, React.ReactNode> = {
  immediate: <AlertTriangle className="h-3.5 w-3.5" />,
  short_term: <Clock className="h-3.5 w-3.5" />,
  long_term: <Calendar className="h-3.5 w-3.5" />,
};

const PHASE_COLOR: Record<ActionPhase, string> = {
  immediate: '#b42318',
  short_term: '#e8590c',
  long_term: '#c77700',
};

function ActionCard({ action }: { action: ActionItem }) {
  const [expanded, setExpanded] = useState(false);
  const gapColor = GAP_COLOR[action.gap];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        <div
          className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: gapColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-semibold text-foreground leading-snug">{action.title}</div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div
            className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: `${gapColor}1a`, color: gapColor }}
          >
            {GAP_LABEL[action.gap]}
          </div>

          {expanded && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">{action.description}</p>
              <div className="rounded border border-dashed px-2 py-1.5 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Trigger: </span>{action.metricTrigger}
              </div>
              {action.program && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <TrendingUp className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Programme: </span>
                  <span className="font-medium text-foreground">{action.program}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PhaseSection({ phase, actions }: { phase: ActionPhase; actions: ActionItem[] }) {
  if (actions.length === 0) return null;
  const color = PHASE_COLOR[phase];
  const icon = PHASE_ICON[phase];

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
        {icon}
        <span>{PHASE_LABEL[phase]}</span>
        <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {actions.length}
        </span>
      </div>
      <div className="space-y-2">
        {actions.map((a) => <ActionCard key={a.title} action={a} />)}
      </div>
    </div>
  );
}

export function RecommendedActions({ district }: { district: DistrictFull }) {
  const plan = buildRecommendationPlan(district);
  const urgencyColor = URGENCY_COLOR[plan.urgency];

  const immediate = plan.actions.filter((a) => a.phase === 'immediate');
  const shortTerm = plan.actions.filter((a) => a.phase === 'short_term');
  const longTerm = plan.actions.filter((a) => a.phase === 'long_term');

  if (plan.actions.length === 0) {
    return (
      <div className="rounded-lg border bg-secondary/30 p-4 text-sm text-muted-foreground">
        No specific interventions flagged — district is within acceptable thresholds across all dimensions.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="rounded-lg border-l-4 bg-card px-4 py-3"
        style={{ borderColor: urgencyColor }}
      >
        <div
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: urgencyColor }}
        >
          {URGENCY_LABEL[plan.urgency]}
        </div>
        <div className="mt-0.5 text-sm font-semibold text-foreground">{plan.headline}</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Interventions are ordered by phase. Expand each card for details, the triggering metric, and the relevant government programme.
        </p>
      </div>

      {/* Phase sections */}
      <div className="space-y-4">
        <PhaseSection phase="immediate" actions={immediate} />
        <PhaseSection phase="short_term" actions={shortTerm} />
        <PhaseSection phase="long_term" actions={longTerm} />
      </div>
    </div>
  );
}
