import { useEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import type { FeatureCollection, Feature } from 'geojson';
import { Skeleton } from '@databricks/appkit-ui/react';
import { Plus, Minus, Maximize2 } from 'lucide-react';
import type { DistrictListItem } from '../lib/types';
import { TIER_COLOR, TIER_ORDER } from '../lib/format';

const W = 800;
const H = 860;

interface Props {
  districts: DistrictListItem[];
  selected?: { district_name: string; state_ut: string } | null;
  onSelect: (d: DistrictListItem) => void;
}

interface XForm { k: number; x: number; y: number }

// d3-geo uses spherical winding: a polygon's interior is the side its ring winds
// around. GeoJSON wound the "wrong" way makes every state cover the whole globe,
// which collapses fitExtent so India shrinks to a dot. Normalize on load: exterior
// rings clockwise (negative shoelace area in lon/lat), holes counter-clockwise.
function ringArea(ring: number[][]): number {
  let a = 0;
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return a / 2;
}
function fixPoly(poly: number[][][]): number[][][] {
  return poly.map((ring, idx) => {
    const a = ringArea(ring);
    const wantNegative = idx === 0; // exterior ring should be clockwise (area < 0)
    return (wantNegative && a > 0) || (!wantNegative && a < 0) ? ring.slice().reverse() : ring;
  });
}
function rewind(fc: FeatureCollection): FeatureCollection {
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') g.coordinates = fixPoly(g.coordinates as number[][][]);
    else if (g.type === 'MultiPolygon') g.coordinates = (g.coordinates as number[][][][]).map(fixPoly);
  }
  return fc;
}

export function DesertMap({ districts, selected, onSelect }: Props) {
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [hover, setHover] = useState<{ d: DistrictListItem; sx: number; sy: number } | null>(null);
  const [t, setT] = useState<XForm>({ k: 1, x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Load India state boundaries once (bundled, same-origin — no external tiles).
  useEffect(() => {
    let alive = true;
    fetch('/india-states.geojson')
      .then((r) => r.json() as Promise<FeatureCollection>)
      .then((d) => { if (alive) setGeo(rewind(d)); })
      .catch(() => { if (alive) setGeo(null); });
    return () => { alive = false; };
  }, []);

  // Projection fitted to the country outline + path generator.
  const { pathFor, project } = useMemo(() => {
    if (!geo) return { pathFor: null as ((f: Feature) => string | null) | null, project: null as ((lon: number, lat: number) => [number, number] | null) | null };
    const projection = geoMercator().fitExtent([[16, 16], [W - 16, H - 16]], geo);
    const gp = geoPath(projection);
    return {
      pathFor: (f: Feature) => gp(f),
      project: (lon: number, lat: number) => projection([lon, lat]),
    };
  }, [geo]);

  // d3-zoom for pan + zoom.
  useEffect(() => {
    if (!svgRef.current) return;
    const sel = select(svgRef.current);
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 10])
      .translateExtent([[0, 0], [W, H]])
      .on('zoom', (e) => setT({ k: e.transform.k, x: e.transform.x, y: e.transform.y }));
    sel.call(z);
    zoomRef.current = z;
    return () => { sel.on('.zoom', null); };
  }, []);

  const zoomBy = (factor: number) => {
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.scaleBy, factor);
  };
  const resetZoom = () => {
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.transform, zoomIdentity);
  };

  const points = useMemo(() => {
    if (!project) return [] as { d: DistrictListItem; x: number; y: number }[];
    return districts
      .filter((d) => d.district_lat != null && d.district_lon != null)
      .map((d) => {
        const p = project(d.district_lon as number, d.district_lat as number);
        return p ? { d, x: p[0], y: p[1] } : null;
      })
      .filter((p): p is { d: DistrictListItem; x: number; y: number } => !!p)
      .sort((a, b) => a.d.medical_desert_score - b.d.medical_desert_score);
  }, [districts, project]);

  if (!geo || !pathFor) {
    return <Skeleton className="h-[480px] w-full" />;
  }

  const k = t.k;

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto touch-none select-none"
        style={{ cursor: 'grab', background: '#eef2f5', borderRadius: 12 }}
        role="img"
        aria-label="Map of India: districts by Medical Desert Score"
      >
        <g transform={`translate(${t.x},${t.y}) scale(${k})`}>
          {/* State polygons */}
          {geo.features.map((f, i) => (
            <path
              key={(f.id as string) ?? `state-${i}`}
              d={pathFor(f) ?? undefined}
              fill="#f7f5f1"
              stroke="#c2c8cc"
              strokeWidth={0.7 / k}
              strokeLinejoin="round"
            />
          ))}
          {/* District points */}
          {points.map(({ d, x, y }) => {
            const isSel = selected && selected.district_name === d.district_name && selected.state_ut === d.state_ut;
            const baseR = 2.5 + (d.medical_desert_score / 100) * 5;
            const r = (isSel ? baseR + 3 : baseR) / k;
            return (
              <circle
                key={`${d.district_name}|${d.state_ut}`}
                cx={x}
                cy={y}
                r={r}
                fill={TIER_COLOR[d.severity_tier]}
                fillOpacity={isSel ? 1 : 0.8}
                stroke={isSel ? '#0b2026' : '#ffffff'}
                strokeWidth={(isSel ? 1.8 : 0.4) / k}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); onSelect(d); }}
                onMouseEnter={() => setHover({ d, sx: x * k + t.x, sy: y * k + t.y })}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${d.district_name}, ${d.state_ut} — score ${d.medical_desert_score}`}</title>
              </circle>
            );
          })}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <button type="button" onClick={() => zoomBy(1.6)} className="flex h-8 w-8 items-center justify-center rounded-md border bg-card shadow-sm hover:bg-muted" aria-label="Zoom in"><Plus className="h-4 w-4" /></button>
        <button type="button" onClick={() => zoomBy(1 / 1.6)} className="flex h-8 w-8 items-center justify-center rounded-md border bg-card shadow-sm hover:bg-muted" aria-label="Zoom out"><Minus className="h-4 w-4" /></button>
        <button type="button" onClick={resetZoom} className="flex h-8 w-8 items-center justify-center rounded-md border bg-card shadow-sm hover:bg-muted" aria-label="Reset view"><Maximize2 className="h-4 w-4" /></button>
      </div>

      {/* Hover tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border bg-popover px-3 py-2 text-xs shadow-md"
          style={{ left: `${(hover.sx / W) * 100}%`, top: `${(hover.sy / H) * 100}%`, transform: 'translate(-50%, -120%)' }}
        >
          <div className="font-semibold text-foreground">{hover.d.district_name}</div>
          <div className="text-muted-foreground">{hover.d.state_ut}</div>
          <div className="mt-0.5 font-medium" style={{ color: TIER_COLOR[hover.d.severity_tier] }}>
            Score {hover.d.medical_desert_score} · {hover.d.severity_tier}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Medical Desert Score:</span>
        {TIER_ORDER.map((tier) => (
          <span key={tier} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TIER_COLOR[tier] }} />
            {tier}
          </span>
        ))}
        <span className="ml-auto italic">Scroll or use +/− to zoom · drag to pan · click a district for details.</span>
      </div>
    </div>
  );
}
