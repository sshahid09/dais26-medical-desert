-- districts_enriched: one row per NFHS-5 district (need) joined to facility supply,
-- geographic access (Haversine to nearest facility), normalized component scores,
-- the weighted Medical Desert Score, severity tier, dominant gap + recommended
-- intervention, and a confidence label. This is the app's primary table.
--
-- Scoring (each component 0-100, higher = worse / more "desert"):
--   30% supply shortage   (few facilities / doctors / beds)
--   25% access burden     (distance to nearest facility)
--   20% vulnerability     (low insurance / literacy / water / sanitation / electricity)
--   15% health burden     (stunting / underweight / anaemia / low institutional birth / low vax)
--   10% specialty gap     (few maternal-capable facilities)
-- Components are normalized via PERCENT_RANK across all districts (national distribution).
-- NOTE: no population column exists in-catalog, so supply is an ABSOLUTE count, not per-capita.
--       This limitation is surfaced in the confidence label and the UI.
CREATE OR REPLACE TABLE workspace.medical_desert.districts_enriched AS
WITH centroid AS (   -- district centroid from pincode coordinates (India bbox only)
  SELECT UPPER(TRIM(district)) AS dkey,
         AVG(TRY_CAST(latitude AS DOUBLE))  AS lat,
         AVG(TRY_CAST(longitude AS DOUBLE)) AS lon,
         COUNT(*) AS n_pincodes
  FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.india_post_pincode_directory
  WHERE TRY_CAST(latitude AS DOUBLE) BETWEEN 6 AND 37
    AND TRY_CAST(longitude AS DOUBLE) BETWEEN 68 AND 98
  GROUP BY UPPER(TRIM(district))
),
supply AS (          -- facility supply per district
  SELECT district AS dkey,
         COUNT(*) AS n_facilities,
         SUM(CASE WHEN facility_type='hospital' THEN 1 ELSE 0 END) AS n_hospitals,
         SUM(CASE WHEN operator_type='public'  THEN 1 ELSE 0 END) AS n_public,
         SUM(CASE WHEN operator_type='private' THEN 1 ELSE 0 END) AS n_private,
         SUM(COALESCE(doctors,0)) AS total_doctors,
         SUM(COALESCE(beds,0))    AS total_beds,
         SUM(CASE WHEN has_maternal THEN 1 ELSE 0 END) AS n_maternal_facilities
  FROM workspace.medical_desert.facilities_geo
  WHERE district IS NOT NULL
  GROUP BY district
),
fac AS (
  SELECT latitude AS lat, longitude AS lon, has_maternal
  FROM workspace.medical_desert.facilities_geo
  WHERE coord_in_india
),
access AS (          -- Haversine (km) from district centroid to nearest facility
  SELECT c.dkey,
         MIN(6371*2*ASIN(SQRT(POWER(SIN(RADIANS(f.lat-c.lat)/2),2)
             + COS(RADIANS(c.lat))*COS(RADIANS(f.lat))*POWER(SIN(RADIANS(f.lon-c.lon)/2),2)))) AS km_nearest_facility
  FROM centroid c CROSS JOIN fac f
  GROUP BY c.dkey
),
access_mat AS (      -- distance to nearest maternal-capable facility
  SELECT c.dkey,
         MIN(6371*2*ASIN(SQRT(POWER(SIN(RADIANS(f.lat-c.lat)/2),2)
             + COS(RADIANS(c.lat))*COS(RADIANS(f.lat))*POWER(SIN(RADIANS(f.lon-c.lon)/2),2)))) AS km_nearest_maternal
  FROM centroid c CROSS JOIN fac f
  WHERE f.has_maternal
  GROUP BY c.dkey
),
nfhs AS (
  SELECT
    TRIM(district_name) AS district_name,
    TRIM(state_ut)      AS state_ut,
    UPPER(TRIM(district_name)) AS dkey,
    institutional_birth_5y_pct AS institutional_birth_pct,
    TRY_CAST(NULLIF(REGEXP_REPLACE(CAST(child_12_23m_fully_vaccinated_based_on_information_from_eit_pct AS STRING),'[^0-9.]',''),'') AS DOUBLE) AS child_vax_pct,
    TRY_CAST(NULLIF(REGEXP_REPLACE(CAST(mothers_who_had_at_least_4_anc_visits_lb5y_pct AS STRING),'[^0-9.]',''),'') AS DOUBLE) AS anc4_pct,
    TRY_CAST(NULLIF(REGEXP_REPLACE(CAST(child_u5_who_are_stunted_height_for_age_18_pct AS STRING),'[^0-9.]',''),'') AS DOUBLE) AS child_stunted_pct,
    TRY_CAST(NULLIF(REGEXP_REPLACE(CAST(child_u5_who_are_underweight_weight_for_age_18_pct AS STRING),'[^0-9.]',''),'') AS DOUBLE) AS child_underweight_pct,
    all_w15_49_who_are_anaemic_pct AS women_anaemic_pct,
    hh_member_covered_health_insurance_pct AS insurance_pct,
    women_age_15_49_who_are_literate_pct   AS female_literacy_pct,
    hh_improved_water_pct        AS water_pct,
    hh_use_improved_sanitation_pct AS sanitation_pct,
    hh_electricity_pct           AS electricity_pct,
    w15_plus_with_high_or_very_high_gt_140_mg_dl_blood_sugar_or_pct AS women_high_bloodsugar_pct
  FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.nfhs_5_district_health_indicators
),
joined AS (
  SELECT n.*,
    COALESCE(s.n_facilities,0)          AS n_facilities,
    COALESCE(s.n_hospitals,0)           AS n_hospitals,
    COALESCE(s.n_public,0)              AS n_public,
    COALESCE(s.n_private,0)             AS n_private,
    COALESCE(s.total_doctors,0)         AS total_doctors,
    COALESCE(s.total_beds,0)            AS total_beds,
    COALESCE(s.n_maternal_facilities,0) AS n_maternal_facilities,
    (s.dkey IS NOT NULL)                AS supply_matched,
    c.lat AS district_lat, c.lon AS district_lon,
    a.km_nearest_facility,
    am.km_nearest_maternal
  FROM nfhs n
  LEFT JOIN supply     s  ON n.dkey = s.dkey
  LEFT JOIN centroid   c  ON n.dkey = c.dkey
  LEFT JOIN access     a  ON n.dkey = a.dkey
  LEFT JOIN access_mat am ON n.dkey = am.dkey
),
pct AS (
  SELECT *,
    (1 - PERCENT_RANK() OVER (ORDER BY n_facilities))  * 100 AS p_fac_short,
    (1 - PERCENT_RANK() OVER (ORDER BY total_doctors)) * 100 AS p_doc_short,
    (1 - PERCENT_RANK() OVER (ORDER BY total_beds))    * 100 AS p_bed_short,
    PERCENT_RANK() OVER (ORDER BY COALESCE(km_nearest_facility, 99999)) * 100 AS p_access,
    (1 - PERCENT_RANK() OVER (ORDER BY insurance_pct))       * 100 AS p_insurance,
    (1 - PERCENT_RANK() OVER (ORDER BY female_literacy_pct)) * 100 AS p_literacy,
    (1 - PERCENT_RANK() OVER (ORDER BY water_pct))           * 100 AS p_water,
    (1 - PERCENT_RANK() OVER (ORDER BY sanitation_pct))      * 100 AS p_sanitation,
    (1 - PERCENT_RANK() OVER (ORDER BY electricity_pct))     * 100 AS p_electricity,
    PERCENT_RANK() OVER (ORDER BY child_stunted_pct)     * 100 AS p_stunted,
    PERCENT_RANK() OVER (ORDER BY child_underweight_pct) * 100 AS p_underweight,
    PERCENT_RANK() OVER (ORDER BY women_anaemic_pct)     * 100 AS p_anaemia,
    (1 - PERCENT_RANK() OVER (ORDER BY institutional_birth_pct)) * 100 AS p_inst_birth,
    (1 - PERCENT_RANK() OVER (ORDER BY child_vax_pct))          * 100 AS p_vax,
    (1 - PERCENT_RANK() OVER (ORDER BY n_maternal_facilities))  * 100 AS p_maternal_gap
  FROM joined
),
scored AS (
  SELECT *,
    ROUND(p_fac_short*0.5 + p_doc_short*0.3 + p_bed_short*0.2, 1) AS supply_score,
    ROUND(p_access, 1) AS access_score,
    ROUND((p_insurance + p_literacy + p_water + p_sanitation + p_electricity)/5, 1) AS vulnerability_score,
    ROUND((p_stunted + p_underweight + p_anaemia + p_inst_birth + p_vax)/5, 1) AS burden_score,
    ROUND(p_maternal_gap, 1) AS specialty_gap_score
  FROM pct
),
final AS (
  SELECT *,
    ROUND(0.30*supply_score + 0.25*access_score + 0.20*vulnerability_score
          + 0.15*burden_score + 0.10*specialty_gap_score, 1) AS medical_desert_score,
    -- completeness over the 12 key indicators (drives confidence)
    ( CAST(institutional_birth_pct IS NOT NULL AS INT) + CAST(child_vax_pct IS NOT NULL AS INT)
    + CAST(anc4_pct IS NOT NULL AS INT) + CAST(child_stunted_pct IS NOT NULL AS INT)
    + CAST(child_underweight_pct IS NOT NULL AS INT) + CAST(women_anaemic_pct IS NOT NULL AS INT)
    + CAST(insurance_pct IS NOT NULL AS INT) + CAST(female_literacy_pct IS NOT NULL AS INT)
    + CAST(water_pct IS NOT NULL AS INT) + CAST(sanitation_pct IS NOT NULL AS INT)
    + CAST(electricity_pct IS NOT NULL AS INT) + CAST(women_high_bloodsugar_pct IS NOT NULL AS INT)
    ) / 12.0 AS indicator_completeness
  FROM scored
)
SELECT
  district_name, state_ut,
  district_lat, district_lon,
  medical_desert_score,
  CASE
    WHEN PERCENT_RANK() OVER (ORDER BY medical_desert_score) >= 0.90 THEN 'Critical'
    WHEN PERCENT_RANK() OVER (ORDER BY medical_desert_score) >= 0.70 THEN 'High-risk'
    WHEN PERCENT_RANK() OVER (ORDER BY medical_desert_score) >= 0.40 THEN 'Moderate'
    ELSE 'Adequate' END AS severity_tier,
  supply_score, access_score, vulnerability_score, burden_score, specialty_gap_score,
  -- dominant gap = component with the largest weighted contribution
  CASE GREATEST(0.30*supply_score, 0.25*access_score, 0.20*vulnerability_score,
                0.15*burden_score, 0.10*specialty_gap_score)
    WHEN 0.30*supply_score        THEN 'supply'
    WHEN 0.25*access_score         THEN 'access'
    WHEN 0.20*vulnerability_score  THEN 'vulnerability'
    WHEN 0.15*burden_score         THEN 'burden'
    ELSE 'specialty' END AS dominant_gap,
  CASE CASE GREATEST(0.30*supply_score, 0.25*access_score, 0.20*vulnerability_score,
                     0.15*burden_score, 0.10*specialty_gap_score)
         WHEN 0.30*supply_score       THEN 'supply'
         WHEN 0.25*access_score        THEN 'access'
         WHEN 0.20*vulnerability_score THEN 'vulnerability'
         WHEN 0.15*burden_score        THEN 'burden'
         ELSE 'specialty' END
    WHEN 'supply'        THEN 'Stand up a new satellite clinic or recurring mobile clinic'
    WHEN 'access'         THEN 'Deploy a mobile clinic / outreach to shorten travel distance'
    WHEN 'vulnerability'  THEN 'Outreach + insurance enrollment + community health workers'
    WHEN 'burden'         THEN 'Maternal & child program (ANC, institutional births, immunization, nutrition)'
    ELSE 'Targeted specialist recruitment / volunteer mission (maternal & child care)'
  END AS recommended_intervention,
  -- raw signals (for evidence + display)
  institutional_birth_pct, child_vax_pct, anc4_pct, child_stunted_pct, child_underweight_pct,
  women_anaemic_pct, insurance_pct, female_literacy_pct, water_pct, sanitation_pct,
  electricity_pct, women_high_bloodsugar_pct,
  n_facilities, n_hospitals, n_public, n_private, total_doctors, total_beds, n_maternal_facilities,
  ROUND(km_nearest_facility,1) AS km_nearest_facility,
  ROUND(km_nearest_maternal,1) AS km_nearest_maternal,
  supply_matched,
  ROUND(indicator_completeness,2) AS indicator_completeness,
  -- confidence: blends indicator completeness, supply-registry plausibility, and join success
  CASE
    WHEN indicator_completeness >= 0.85 AND supply_matched AND n_facilities >= 3 THEN 'High'
    WHEN indicator_completeness >= 0.60 AND (supply_matched OR n_facilities >= 1)  THEN 'Medium'
    ELSE 'Low' END AS confidence,
  CONCAT_WS(' ',
    CASE WHEN indicator_completeness < 0.85 THEN 'Some NFHS indicators missing for this district.' END,
    CASE WHEN n_facilities = 0 THEN 'No facilities matched here — possible under-reporting, not confirmed absence.'
         WHEN n_facilities < 3 THEN 'Very few facilities matched — supply may be under-reported.' END,
    CASE WHEN NOT supply_matched THEN 'District name did not match the facility/pincode directory exactly.' END,
    'NFHS-5 fieldwork ~2019-2021; supply is an absolute count (no population denominator in-catalog).'
  ) AS confidence_notes
FROM final;
