import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@databricks/appkit-ui/react';
import { COMPONENT_WEIGHTS, GAP_COLOR } from '../lib/format';
import type { ComponentScores, DominantGap } from '../lib/types';

export function ScoreBreakdown({ scores, dominant }: { scores: ComponentScores; dominant: DominantGap }) {
  return (
    <TooltipProvider>
      <div className="space-y-2.5">
        {COMPONENT_WEIGHTS.map(({ key, gap, weight, label, description }) => {
          const raw = Number(scores[key] ?? 0);
          const isDominant = gap === dominant;
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`flex items-center gap-1 ${isDominant ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {label} <span className="text-muted-foreground/70">· {Math.round(weight * 100)}%</span>
                  {isDominant && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: GAP_COLOR[gap] }}>dominant</span>}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help ml-0.5" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">{description}</TooltipContent>
                  </Tooltip>
                </span>
                <span className={isDominant ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{raw.toFixed(0)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(2, raw)}%`, backgroundColor: GAP_COLOR[gap], opacity: isDominant ? 1 : 0.5 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
