import { useState } from 'react';
import type { DistrictListItem } from '../lib/types';
import { TIER_COLOR, TIER_ORDER } from '../lib/format';

// India bounding box (approx) for an equirectangular projection.
const LON_MIN = 68, LON_MAX = 98, LAT_MIN = 6, LAT_MAX = 37;
const W = 800, H = 840, PAD = 24;

function project(lon: number, lat: number) {
  const x = PAD + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (W - 2 * PAD);
  const y = PAD + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (H - 2 * PAD);
  return { x, y };
}

interface Props {
  districts: DistrictListItem[];
  selected?: { district_name: string; state_ut: string } | null;
  onSelect: (d: DistrictListItem) => void;
}

export function DesertMap({ districts, selected, onSelect }: Props) {
  const [hover, setHover] = useState<{ d: DistrictListItem; x: number; y: number } | null>(null);
  const points = districts.filter((d) => d.district_lat != null && d.district_lon != null);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Map of India districts by Medical Desert Score">
        <rect x={0} y={0} width={W} height={H} fill="#f1efe9" rx={12} />
        {points
          .slice()
          .sort((a, b) => a.medical_desert_score - b.medical_desert_score)
          .map((d) => {
            const { x, y } = project(d.district_lon as number, d.district_lat as number);
            const r = 3 + (d.medical_desert_score / 100) * 6;
            const isSel = selected && selected.district_name === d.district_name && selected.state_ut === d.state_ut;
            return (
              <circle
                key={`${d.district_name}|${d.state_ut}`}
                cx={x}
                cy={y}
                r={isSel ? r + 3 : r}
                fill={TIER_COLOR[d.severity_tier]}
                fillOpacity={isSel ? 1 : 0.78}
                stroke={isSel ? '#0b2026' : '#ffffff'}
                strokeWidth={isSel ? 2 : 0.5}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelect(d)}
                onMouseEnter={() => setHover({ d, x, y })}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${d.district_name}, ${d.state_ut} — score ${d.medical_desert_score}`}</title>
              </circle>
            );
          })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border bg-popover px-3 py-2 text-xs shadow-md"
          style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%`, transform: 'translate(-50%, -120%)' }}
        >
          <div className="font-semibold text-foreground">{hover.d.district_name}</div>
          <div className="text-muted-foreground">{hover.d.state_ut}</div>
          <div className="mt-0.5 font-medium" style={{ color: TIER_COLOR[hover.d.severity_tier] }}>
            Score {hover.d.medical_desert_score} · {hover.d.severity_tier}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Medical Desert Score:</span>
        {TIER_ORDER.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TIER_COLOR[t] }} />
            {t}
          </span>
        ))}
        <span className="ml-auto italic">Each dot is a district (sized by score); position is the district centroid.</span>
      </div>
    </div>
  );
}
