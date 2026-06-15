import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@databricks/appkit-ui/react';

export function Kpi({
  label, value, sub, accent, tooltip,
}: { label: string; value: string; sub?: string; accent?: string; tooltip?: string }) {
  return (
    <TooltipProvider>
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="mt-1 text-2xl font-bold" style={accent ? { color: accent } : undefined}>{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </div>
    </TooltipProvider>
  );
}
