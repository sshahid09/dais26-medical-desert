# Medical Desert Planner — Product Spec

> **Hackathon:** Databricks Apps & Agents for Good 2026 (DAIS 2026), in partnership with OpenAI · MLH judging.
> **Judging criteria (25% each):** Product judgement · Evidence & uncertainty · Technical execution · Ambition.
> **Catalog:** `databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset`

*Merged spec: the evidence/uncertainty + scoring rigor of the engineering draft, plus the confirmed columns, richer facility schema, pitch, and hour-boxed plan from the Genie draft. Every hard impact claim has been replaced with "estimated reach + confidence" language by design (see §10).*

---

## 0. Data grounding (confirmed schema)

Three confirmed tables in `databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset`. The data is **India**, at **district** grain.

| Table | What it is | Role in product |
| --- | --- | --- |
| `nfhs_5_district_health_indicators` | National Family Health Survey (NFHS-5) — **109 health metrics across 700+ districts**: maternal/child health, nutrition, chronic disease, healthcare access, social determinants, behavioral health | **Need, vulnerability, and health-burden** signals |
| `facilities` | Healthcare facility registry — name, type (hospital/clinic/CHC/PHC), **operator type (govt/private/NGO)**, **lat/long**, **doctors & bed capacity**, specialties, contact, affiliation networks, digital-presence indicators. Multi-source aggregated **with deduplication** | **Supply, capacity, specialty** signals; map points |
| `india_post_pincode_directory` | Pincode → district → state hierarchy with **coordinates** | **Spatial join + distance** between facilities and districts/pincodes |

**Grain:** India districts (~700+), rolling up to states/UTs; pincode coordinates enable distance calculations.

**Why this dataset is strong:** NFHS-5 carries demographic, social-determinant, and outcome indicators *directly*, so real need-based scoring needs **no external population join** for the core MVP. Supply, access, and need can all be computed in-catalog.

### Confirmed NFHS-5 indicator columns (from data dictionary — validate exact names in Phase 1)

| Column | Meaning | Use |
| --- | --- | --- |
| `institutional_birth_5y_pct` | % births in a facility | Maternal-care access (need) |
| `child_12_23m_fully_vaccinated_based_on_information_from_eit_pct` | Child full-vaccination coverage | Child-health need |
| `child_u5_who_are_stunted_height_for_age_18_pct` | Under-5 stunting | Child malnutrition (burden) |
| `non_pregnant_w15_49_who_are_anaemic_lt_12_0_g_dl_22_pct` | Women's anemia prevalence | Health burden |
| `hh_member_covered_health_insurance_pct` | Household health-insurance coverage | Affordability / vulnerability |

(109 indicators total; the above anchor the score components in §8. Full subset finalized in Phase 1.)

**Honesty flags carried into the UI:**
- NFHS-5 is **survey data (fieldwork ~2019–2021)** — district estimates carry **sampling error and recency limits**.
- The facility registry is **multi-source + deduplicated**, so two sources of error exist: (a) **incomplete coverage** (not every clinic listed) and (b) **residual duplicate/merge ambiguity** — possible over- *or* under-counting of supply.
- District ↔ facility linkage depends on **geographic join precision** (pincode/coordinate matching, not true catchment areas).

**Still to confirm in Phase 1:** exact column names for the rest of the 109 indicators and the facility fields; the district **join key** (name vs. code) and its consistency across all three tables.

---

## 1. Product Summary

**Product name:** Medical Desert Planner

**One-liner:** A Databricks App + agent that finds India's medical deserts — districts where healthcare **supply and access** fall short of the population's **need and health burden** — and tells a planner *where to act, what to do, and how much to trust the recommendation.*

**Positioning:** Health indicators, facility locations, and geography sit in silos. This product **joins need (NFHS-5) to supply (facilities) across geography (pincodes)** to rank underserved districts, explain *why* each is underserved, recommend a plausible intervention, surface the supporting evidence, and label the uncertainty. It moves from "here are the numbers" to "here is the highest-priority district, what to do, and how confident we are."

**Competitive differentiation:** No existing tool combines health outcomes + facility locations + geographic optimization in one interface with **uncertainty made first-class**. Databricks provides the spatial-join and scale that Excel/GIS workflows can't.

---

## 2. Target Users

**Primary:** A **district/state health-planning team or foundation program officer** (Virtue Foundation, a state health department, an INGO) deciding where to deploy mobile clinics, recruit specialists, fund maternal/child care, or partner with local facilities.

**Secondary:**
- **NGO program managers / healthcare investors / mobile-clinic & telemedicine operators** choosing where to deploy.
- **Volunteer / specialist coordinators** matching clinician specialties to district gaps.
- **Grant writers / impact analysts** who must justify why a district was prioritized.
- **Hackathon judges** evaluating the four criteria.

---

## 3. Problem

India faces severe healthcare-access disparities: ~70% of the population is rural while a disproportionate share of facilities is urban, data lives in silos, and infrastructure decisions are often made reactively rather than from need. A district becomes a medical desert where **facility supply**, **specialty coverage**, **distance to care**, **population vulnerability**, and **health burden** compound. Most tools show one layer and rarely answer:

1. **Product judgement** — Where should a planner act *next*, and what should they do there?
2. **Evidence** — Which indicators support that action?
3. **Uncertainty** — How fragile is the conclusion given survey recency, registry completeness/dedup, and join precision?

This product makes all three visible.

---

## 4. Goals

1. Rank India's districts by a transparent **Medical Desert Score** (need vs. supply vs. access).
2. Explain each district's score with real NFHS-5 + facility drivers.
3. Recommend a **plausible intervention** and, where applicable, **candidate sites** (facility placement) with **estimated reach + confidence**.
4. Let planners **compare** districts and run **what-if** scenarios.
5. Make **evidence and uncertainty first-class** (recency, completeness, dedup ambiguity, join precision, indicator agreement).
6. Demonstrate strong Databricks execution: Unity Catalog, **spatial joins** across all three tables, Delta/SQL scoring views, a deployable **Databricks App**, and an **agent** (Agent Bricks / model serving) for grounded briefs.

## 5. Non-Goals

1. No clinical diagnosis or individual patient guidance.
2. Does not replace local stakeholder validation or health-system review.
3. Does not present scores as ground truth — directional, evidence-linked, uncertainty-labeled.
4. Does not optimize budgets precisely in the MVP; supports prioritization.
5. **Does not assert fabricated impact** (e.g., "X% mortality reduction"); reports only data-derived estimates with confidence.

---

## 6. Data Source

### 6.1 Profiling step (Phase 1 — confirm exact columns & keys)

```sql
-- Exact columns for all three tables
SELECT table_name, column_name, data_type
FROM databricks_virtue_foundation_dataset_dais_2026.information_schema.columns
WHERE table_schema = 'virtue_foundation_dataset'
ORDER BY table_name, ordinal_position;

-- Confirm district join key (name vs. code) + coverage across tables; profile null-rates
SELECT COUNT(*) AS districts
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.nfhs_5_district_health_indicators;
```

### 6.2 How the three tables combine

```text
nfhs_5_district_health_indicators   ──(district key)──┐
                                                       ├──►  district NEED + BURDEN
india_post_pincode_directory  ──(district key)─────────┘     + pincode coordinates per district
        │ (pincode / lat-long)
        ▼
facilities (lat/long, type, operator, doctors, beds, specialty)
        └──(nearest-distance + point-in-district)──►  district SUPPLY + ACCESS
```

- **Need / burden:** selected NFHS-5 indicators per district.
- **Supply:** facility count, **doctors**, **beds/capacity**, **specialty presence**, **operator mix (govt/private/NGO)** per district.
- **Access / distance:** Haversine distance from district/pincode centroid to nearest facility — overall and **per specialty** (e.g., nearest facility offering obstetric care).

### 6.3 Indicator selection (from NFHS-5's 109 metrics)

Anchored on the confirmed columns (§0) plus a curated subset finalized in Phase 1:
- **Maternal/child need:** `institutional_birth_5y_pct`, ANC coverage, `child_12_23m_fully_vaccinated...`.
- **Burden:** `child_u5_who_are_stunted...`, `non_pregnant_w15_49_who_are_anaemic...`, chronic-disease (hypertension/diabetes) metrics.
- **Vulnerability / social determinants:** `hh_member_covered_health_insurance_pct`, female literacy, water/sanitation/electricity access.

Document every chosen indicator in a data dictionary; unused indicators remain available to the agent / NL Q&A.

---

## 7. Core User Experience

### 7.1 First screen: Prioritization Map (the working product, not a landing page)

1. Full-width India map; districts shaded by **Medical Desert Score** (choropleth); facilities as points.
2. **Left filter rail:** geography level (state → district); state/UT filter; **care-type focus** (maternal/child, chronic disease, surgery, general primary care); facility/operator type; minimum data-confidence threshold.
3. **Right detail panel** for the selected district: score, **confidence**, top evidence drivers, recommended intervention, key caveats.

### 7.2 District detail — answers five questions

1. Why is this district flagged? (drivers)
2. Who is most affected? (NFHS vulnerability + burden indicators)
3. Which gap dominates — **few/distant facilities**, **missing specialty**, or **high need vs. supply**?
4. What intervention is most likely to help, and **why this and not the others**?
5. What evidence is **stale, sparse, deduped-ambiguous, or a proxy**?

### 7.3 Gap-analysis & correlation view

- Districts with worst outcomes vs. facility availability (e.g., **high maternal need but no maternity capability**, **high diabetes burden but no relevant specialty**).
- Correlation explorer: facility proximity vs. outcomes; social determinants vs. access need. Labeled **correlation, not causation**.

### 7.4 Compare mode

Select 2–4 districts and compare: need/burden, supply (incl. doctors/beds/operator mix), specialty coverage, distance burden, recommended intervention, and **confidence / missing data**.

### 7.5 Facility recommendation & scenario planner (Should-Have)

- **Candidate-site recommendations:** rank locations by *marginal benefit* = (population brought into range × need-urgency) ÷ existing-facility saturation, with min-distance-from-existing constraints. Output: ranked sites, **estimated population in range** (with confidence), coverage-radius overlay (5/10/25 km). **No fabricated outcome percentages.**
- **What-if levers:** add a mobile clinic / outreach; stand up a fixed clinic at a pincode; add specialist coverage; partner with an existing facility. Outputs: estimated reach, which drivers improve, which remain, **scenario confidence**.

### 7.6 Equity lens (Should-Have)

Filter/weight toward the most vulnerable: low female literacy, low institutional-delivery, low insurance coverage, high child malnutrition. Show an **equity contribution** for each candidate (how much it narrows access inequality), as an estimate with confidence.

---

## 8. Scoring Model

### 8.1 Medical Desert Score (explainable weighted score)

```text
Medical Desert Score =
  30%  care supply shortage     (facilities / doctors / beds per population, per district)
+ 25%  access / distance burden (Haversine distance to nearest facility / nearest specialty)
+ 20%  population vulnerability (NFHS social determinants + insurance coverage)
+ 15%  health burden           (NFHS maternal/child + chronic-disease outcomes)
+ 10%  specialty coverage gap   (critical specialties absent within reach)
```

Each component normalized 0–100 against the national (or state) distribution. **Weights are user-adjustable** (§10.4). Components degrade gracefully when a field is sparse, and the UI says so.

**Severity tiers** for the map legend: **Critical · High-risk · Moderate · Adequate** (cut on score percentiles).

### 8.2 Evidence drivers (per district)

Examples surfaced to the user, each linked to its source field:
- Facilities / doctors per 100k below the national 10th percentile.
- Nearest facility with **obstetric capability >X km** from the district centroid.
- `hh_member_covered_health_insurance_pct` in the bottom decile (vulnerability).
- `child_u5_who_are_stunted...` in the top decile (burden).

### 8.3 Confidence score (separate from risk)

1. **NFHS recency** — fieldwork ~2019–2021; older = lower confidence.
2. **Field completeness** — chosen NFHS indicators and facility specialty/doctor/bed fields populated vs. null.
3. **Registry completeness signal** — implausibly low facility counts flagged as **possible under-reporting**, not confirmed absence.
4. **Dedup ambiguity** — residual duplicate-merge uncertainty in the multi-source facility table (supply may be over/under-stated).
5. **Join precision** — facility-to-district linkage via pincode/coordinates vs. ambiguous matches.
6. **Indicator agreement** — do multiple NFHS indicators point the same way?

Labels: **High / Medium / Low**, each with the reason.

---

## 9. Intervention Recommendation Logic

Recommend based on the **dominant gap**:

| Dominant gap | Recommended intervention | Evidence needed |
| --- | --- | --- |
| Few / distant facilities | Mobile clinic or new satellite site | Facility count, distance, population |
| Specialty missing (e.g., OB) | Targeted volunteer mission / specialist recruitment | Specialty presence, distance |
| High maternal/child burden | Maternal & child program (ANC, institutional births, immunization) | NFHS maternal/child indicators |
| High vulnerability + low supply | Outreach + enrollment + capacity investment | NFHS social determinants, insurance, supply |
| Chronic-disease burden | Screening / NCD program | NFHS hypertension/diabetes/anemia metrics |
| Facilities exist but capacity-short | Capacity/staffing investment, local partnership | Doctors/beds vs. population |

Every recommendation includes **"why this, why not the others."**

---

## 10. Evidence & Uncertainty Design (a primary judging strength)

Every recommendation shows:
1. **Evidence used** — strongest 3–5 indicators, each linked to its source table/field.
2. **Data limitations** — NFHS recency; registry incompleteness; **dedup ambiguity**; join precision; proxy use.
3. **Confidence** — High / Medium / Low with reason.
4. **Sensitivity** — does changing weights change the ranking? (live recompute)
5. **Community validation prompt** — what local stakeholders should confirm before acting.

Example:

```text
Recommended action: Monthly mobile maternal-health clinic — <district>, <state>

Evidence:
- institutional_birth_5y_pct in the bottom 8% of districts (NFHS-5).
- Nearest facility reporting obstetric capability ~95 km from district centroid (facilities + pincode).
- child_u5_who_are_stunted... in the top decile (NFHS-5).

Estimated reach: ~120k residents in the district fall outside a 25 km facility radius
                 (district denominator; not a modeled outcome).

Uncertainty:
- NFHS-5 fieldwork ~2019–2021; conditions may have shifted.
- Registry lists only 2 facilities here — possible under-reporting, not confirmed absence.
- Facility table is multi-source/deduped; residual merge ambiguity may affect supply count.
- District matched to facilities via pincode centroid, not exact catchment.

Confidence: Medium
```

### 10.4 Weight controls + sensitivity

Sliders for §8.1 weights; ranking and a "rank changed vs. default" badge update live — demonstrating conclusions are evidence-driven, not arbitrary. Human-in-the-loop by design: decision support, not autopilot.

---

## 11. MVP Scope

### Must Have
1. Databricks App with interactive India district map (severity tiers).
2. Unity Catalog SQL across the three tables (post-profiling).
3. **Spatial join** facilities ↔ pincode ↔ district (Haversine distance).
4. Delta/SQL **scoring views** (supply + access + NFHS need/burden).
5. District detail panel with evidence drivers + "top 10 most underserved" view.
6. Confidence + uncertainty labels (recency, completeness, dedup, join precision).
7. Intervention recommendation with "why not the others."
8. Compare mode (2–4 districts).
9. Deployed app on a shareable URL; filters (state, care focus, facility/operator type).
10. Polished demo on 2–3 strong example districts.

### Should Have
1. Weight sliders + sensitivity badge.
2. Facility recommendation engine (ranked sites + coverage radius + estimated reach).
3. Scenario planner; equity lens.
4. Exportable planning brief (Markdown/PDF); saved shortlist.

### Could Have
1. **Agentic planning brief** via Agent Bricks / model serving, grounded *only* in retrieved evidence (OpenAI-partnership angle).
2. Natural-language Q&A over the catalog ("Which districts have the worst maternal-care gap in <state>?").
3. **Lakebase**-backed saved shortlists / planner state.
4. Specialist-to-district matching (loop back to VF Match); telemedicine/mobile-route optimization.

---

## 12. Technical Architecture

### 12.1 Stack (aligned to this hackathon)
1. **Databricks App** — Streamlit (or Gradio/Dash) for fast, judge-friendly interactivity.
2. **Data layer** — the three Unity Catalog tables; Delta gold tables for derived assets.
3. **Transformation** — SQL views / notebooks; spatial joins via Haversine (or H3); Python (pandas, geopandas/shapely) for scoring & coverage.
4. **Serving** — Databricks SQL Warehouse / serverless; precompute district scores, cache app reads.
5. **Geospatial** — district choropleth (needs district boundary GeoJSON — see §15) + facility points; pydeck/Plotly/Folium.
6. **Agent (ambition)** — Agent Bricks / model-serving endpoint for grounded briefs and NL Q&A, constrained to retrieved evidence.
7. **State (ambition)** — Lakebase for saved shortlists / scenarios.

### 12.2 Derived data assets
```text
districts_enriched      -- NFHS need/burden + facility supply + access, per district (gold)
md_score_components     -- normalized component scores
md_scores               -- total Medical Desert Score + severity tier
md_evidence_drivers     -- top drivers per district
md_intervention_recs    -- recommendation + rationale
md_site_recommendations -- ranked candidate sites + estimated reach (should-have)
md_data_quality         -- completeness, recency, dedup, join-precision flags
```

### 12.3 Scoring algorithm (pseudocode)
```python
def medical_desert_score(d):
    supply        = norm(facilities_per_100k, doctors_per_100k, beds_per_100k)      # 30%
    access        = norm(dist_nearest_facility, dist_nearest_specialty)             # 25%
    vulnerability = norm(insurance_pct, female_literacy, wash_access)               # 20%
    burden        = norm(maternal_child_indicators, chronic_disease_indicators)     # 15%
    specialty_gap = norm(critical_specialties_absent_within_reach)                  # 10%
    return 0.30*supply + 0.25*access + 0.20*vulnerability + 0.15*burden + 0.10*specialty_gap
```

### 12.4 App modules
```text
app.py
├── data/        (catalog.py, queries.py, scoring.py, spatial.py, quality.py)
├── components/  (map_view.py, detail_panel.py, compare_view.py, recommend.py, scenario_planner.py)
├── agent/       (brief_agent.py, nl_query.py)   # could-have
└── assets/      (india_districts.geojson)
```

---

## 13. Demo Narrative (~3 min) + pitch

**Opening hook:** "Every year in India, women die in childbirth not for lack of medical knowledge but because they can't reach care in time. Medical Desert Planner finds where healthcare is missing and shows where the next clinic does the most good — and how confident we are in that call."

**Flow:**
1. Open on the India map; zoom to a Critical-tier district.
2. Click it — explain drivers (e.g., low `institutional_birth_5y_pct` + long distance to OB care).
3. Show the **uncertainty panel** — NFHS recency + a "possible under-reporting / dedup" facility flag. *(The differentiator: we show what we don't know.)*
4. Compare with another high-score district where the recommended intervention **differs** (maternal vs. chronic-disease).
5. Move a weight slider → show ranking stability (sensitivity).
6. Run a site recommendation → show **estimated population in range + confidence** (not a fabricated outcome %).
7. (Ambition) Generate the **agent brief** grounded in the shown evidence; export it.

**Close:** "We built this on Databricks so health departments can actually use it — decision support with its uncertainty on the table, not a black box."

---

## 14. Mapping to Judging Criteria

- **Product judgement** — clear personas; map-first workflow; intervention + ranked-site recs with "why not the others"; compare; equity lens; exportable brief.
- **Evidence & uncertainty** — risk separated from confidence; drivers linked to named NFHS/facility fields; **recency, completeness, dedup ambiguity, join precision surfaced**; weight sensitivity; correlation-not-causation; **no fabricated impact numbers**.
- **Technical execution** — schema profiling; **spatial joins across all three tables**; Delta/SQL gold tables; clean modular app; cached/precomputed reads.
- **Ambition** — agentic grounded briefs, NL Q&A, Lakebase state, site optimization, equity scoring, roadmap to specialist matching & telemedicine; production-minded but credible.

---

## 15. Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Exact columns / join keys differ | Rework | Phase 1 profiling first; keep scoring schema-adaptive |
| District join key mismatch (name vs. code) | Bad joins | Confirm key + crosswalk; validate district counts across tables |
| No district boundary geometry in-catalog | Choropleth limited | Open India district GeoJSON (GADM/DataMeet) keyed to district code; else centroid/point map |
| NFHS-5 dated (~2019–2021) | Stale conclusions | Recency badge; "estimated" language |
| Facility registry incomplete / dedup residue | Mis-stated supply | Flag "possible under-reporting" + dedup ambiguity; confidence penalty; never assert true absence |
| **Overclaiming impact in the pitch** | Loses evidence credibility | Replace all outcome % with data-derived reach + confidence |
| Slow queries in demo | Demo failure | Precompute scoring views; cache reads |

---

## 16. Implementation Plan (hour-boxed for an 8–12h build)

**Phase 1 — Profiling (2–3h):** exact columns/null-rates for all three tables; confirm district join key; finalize NFHS indicator subset; obtain district boundary GeoJSON; data dictionary; decide supported claims.

**Phase 2 — Scoring & recs (2–3h):** spatial joins (facilities ↔ pincode ↔ district, Haversine); normalize indicators; build `districts_enriched`, component/total/confidence scores, evidence-driver, data-quality, and (should-have) `md_site_recommendations` tables; sanity-check against intuition.

**Phase 3 — App MVP (4–5h):** project scaffold; map + filters; district detail + top-10; compare mode; intervention logic; uncertainty display; connect UI to cached queries; style.

**Phase 4 — Polish & ambition (1–2h):** 2–3 example districts; weight sliders; recommendation/scenario + equity lens; agent brief; load-time tuning.

**Phase 5 — Docs & pitch (1–2h):** README + data dictionary; 2–3 min demo video; rehearse the 5-min pitch and Q&A against the four criteria.

---

## 17. Open Questions (resolve in Phase 1)

1. Exact column names for the rest of the 109 NFHS indicators and the facility fields (doctors, beds, specialties, operator, affiliation).
2. District join key: name vs. code? Consistent across all three tables?
3. How complete are facility specialty/doctor/bed fields?
4. Does `facilities` cover all districts, or are some empty (true gap vs. registry gap)?
5. Is district boundary geometry available, or is an external GeoJSON join needed for the choropleth?
6. Are Lakebase, Agent Bricks, and model-serving endpoints available in the hackathon workspace?
7. Is joining external open data (district boundaries) permitted under hackathon rules?

---

## 18. MVP Success Criteria

A judge can: pick a state → see the highest-priority underserved districts → understand *why* (need vs. supply vs. access) → see a recommended intervention (and, optionally, candidate sites with estimated reach) → see the evidence → see the remaining uncertainty (recency, completeness, dedup, join precision) → and believe the team could extend this into a serious planning tool.
