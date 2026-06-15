// Medical Desert Planner — read-only API over Lakebase synced tables.
// Source of truth is Unity Catalog (workspace.medical_desert.*); these tables are
// snapshot-synced into Lakebase Postgres (schema `public`) for sub-10ms reads.
// Synced tables are READ-ONLY — never INSERT/UPDATE/DELETE here.

import { Application, Request, Response } from 'express';

interface AppKitWithLakebase {
  lakebase: {
    query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  };
  server: { extend(fn: (app: Application) => void): void };
}

const CONFIDENCE_RANK: Record<string, number> = { Low: 1, Medium: 2, High: 3 };

// Columns returned for list / map (kept lean for payload size)
const DISTRICT_LIST_COLS = `
  district_name, state_ut, district_lat, district_lon,
  medical_desert_score, severity_tier, dominant_gap, recommended_intervention,
  supply_score, access_score, vulnerability_score, burden_score, specialty_gap_score,
  n_facilities, total_doctors, km_nearest_facility, confidence`;

function buildDistrictFilters(q: Request['query']) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replace('$$', `$${params.length}`));
  };
  if (q.state && q.state !== 'all') add('state_ut = $$', String(q.state));
  if (q.tier && q.tier !== 'all') add('severity_tier = $$', String(q.tier));
  if (q.gap && q.gap !== 'all') add('dominant_gap = $$', String(q.gap));
  if (q.q) add('LOWER(district_name) LIKE $$', `%${String(q.q).toLowerCase()}%`);
  if (q.minConfidence && q.minConfidence !== 'Low') {
    const floor = CONFIDENCE_RANK[String(q.minConfidence)] ?? 1;
    if (floor === 2) where.push(`confidence IN ('Medium','High')`);
    if (floor === 3) where.push(`confidence = 'High'`);
  }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export function setupPlannerRoutes(appkit: AppKitWithLakebase) {
  appkit.server.extend((app) => {
    // Overview KPIs + filter facets + data-quality summary
    app.get('/api/stats', async (_req: Request, res: Response) => {
      try {
        const [overview, byTier, states, dq] = await Promise.all([
          appkit.lakebase.query(`
            SELECT
              COUNT(*)::int AS districts,
              COUNT(*) FILTER (WHERE severity_tier IN ('Critical','High-risk'))::int AS underserved,
              SUM(n_facilities)::int AS facilities,
              ROUND(AVG(insurance_pct)::numeric, 1) AS avg_insurance,
              ROUND(AVG(institutional_birth_pct)::numeric, 1) AS avg_institutional_birth,
              COUNT(*) FILTER (WHERE confidence = 'High')::int AS high_conf
            FROM public.districts_enriched`),
          appkit.lakebase.query(`
            SELECT severity_tier, COUNT(*)::int AS n
            FROM public.districts_enriched GROUP BY severity_tier`),
          appkit.lakebase.query(`
            SELECT state_ut, COUNT(*)::int AS n,
                   ROUND(AVG(medical_desert_score)::numeric,1) AS avg_score
            FROM public.districts_enriched GROUP BY state_ut ORDER BY state_ut`),
          appkit.lakebase.query(`
            SELECT
              COUNT(*)::int AS districts_scored,
              COUNT(*) FILTER (WHERE supply_matched)::int AS supply_matched,
              (SELECT COUNT(*)::int FROM public.facilities_geo) AS facilities_total,
              (SELECT COUNT(*)::int FROM public.facilities_geo WHERE district IS NOT NULL) AS facilities_mapped,
              ROUND(AVG(indicator_completeness)::numeric,2) AS avg_completeness
            FROM public.districts_enriched`),
        ]);
        res.json({
          overview: overview.rows[0],
          byTier: byTier.rows,
          states: states.rows,
          dataQuality: dq.rows[0],
        });
      } catch (err) {
        console.error('GET /api/stats failed:', err);
        res.status(500).json({ error: 'Failed to load stats' });
      }
    });

    // Ranked districts (filterable). Also powers the map (returns centroids).
    app.get('/api/districts', async (req: Request, res: Response) => {
      try {
        const { where, params } = buildDistrictFilters(req.query);
        const limit = Math.min(parseInt(String(req.query.limit ?? '800'), 10) || 800, 1000);
        const { rows } = await appkit.lakebase.query(
          `SELECT ${DISTRICT_LIST_COLS}
           FROM public.districts_enriched
           ${where}
           ORDER BY medical_desert_score DESC
           LIMIT ${limit}`,
          params,
        );
        res.json(rows);
      } catch (err) {
        console.error('GET /api/districts failed:', err);
        res.status(500).json({ error: 'Failed to load districts' });
      }
    });

    // Full district detail: row + top evidence drivers + nearby facilities
    app.get('/api/district', async (req: Request, res: Response) => {
      try {
        const name = String(req.query.name ?? '');
        const state = String(req.query.state ?? '');
        if (!name || !state) {
          res.status(400).json({ error: 'name and state are required' });
          return;
        }
        const [district, drivers, facilities] = await Promise.all([
          appkit.lakebase.query(
            `SELECT * FROM public.districts_enriched WHERE district_name = $1 AND state_ut = $2`,
            [name, state],
          ),
          appkit.lakebase.query(
            `SELECT category, driver_label, value, unit, source_field, severity
             FROM public.md_evidence_drivers
             WHERE district_name = $1 AND state_ut = $2
             ORDER BY severity DESC LIMIT 6`,
            [name, state],
          ),
          appkit.lakebase.query(
            `SELECT facility_id, name, facility_type, operator_type, city, doctors, beds,
                    has_maternal, latitude, longitude
             FROM public.facilities_geo
             WHERE district = UPPER(TRIM($1)) AND coord_in_india
             ORDER BY (doctors IS NULL), doctors DESC NULLS LAST
             LIMIT 50`,
            [name],
          ),
        ]);
        if (district.rows.length === 0) {
          res.status(404).json({ error: 'District not found' });
          return;
        }
        res.json({
          district: district.rows[0],
          drivers: drivers.rows,
          facilities: facilities.rows,
        });
      } catch (err) {
        console.error('GET /api/district failed:', err);
        res.status(500).json({ error: 'Failed to load district detail' });
      }
    });

    // Compare 2-4 districts. keys = "Name|State" joined by ";"
    app.get('/api/compare', async (req: Request, res: Response) => {
      try {
        const raw = String(req.query.keys ?? '').split(';').map((s) => s.trim()).filter(Boolean);
        if (raw.length === 0) { res.json([]); return; }
        const pairs = raw.slice(0, 4).map((k) => k.split('|'));
        const conds = pairs.map((_p, i) => `(district_name = $${i * 2 + 1} AND state_ut = $${i * 2 + 2})`);
        const params = pairs.flatMap(([n, s]) => [n, s]);
        const { rows } = await appkit.lakebase.query(
          `SELECT * FROM public.districts_enriched WHERE ${conds.join(' OR ')}`,
          params,
        );
        res.json(rows);
      } catch (err) {
        console.error('GET /api/compare failed:', err);
        res.status(500).json({ error: 'Failed to compare districts' });
      }
    });
  });
}
