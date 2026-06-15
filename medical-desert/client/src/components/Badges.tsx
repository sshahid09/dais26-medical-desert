import type { SeverityTier, Confidence } from '../lib/types';
import { TIER_COLOR, CONFIDENCE_COLOR } from '../lib/format';

export function TierBadge({ tier, className = '' }: { tier: SeverityTier; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${className}`}
      style={{ backgroundColor: TIER_COLOR[tier] }}
    >
      {tier}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ borderColor: CONFIDENCE_COLOR[confidence], color: CONFIDENCE_COLOR[confidence] }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CONFIDENCE_COLOR[confidence] }} />
      {confidence} confidence
    </span>
  );
}
