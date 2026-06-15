-- md_evidence_drivers: long/unpivoted table of per-district evidence signals.
-- Each row links a driver to its source NFHS/facility field and a 0-100 severity
-- (higher = worse vs the national distribution). The app shows the top drivers per district.
CREATE OR REPLACE TABLE workspace.medical_desert.md_evidence_drivers AS
WITH base AS (
  SELECT district_name, state_ut,
         institutional_birth_pct, child_vax_pct, child_stunted_pct, women_anaemic_pct,
         insurance_pct, female_literacy_pct, sanitation_pct,
         n_facilities, km_nearest_facility, n_maternal_facilities
  FROM workspace.medical_desert.districts_enriched
),
r AS (
  SELECT *,
    PERCENT_RANK() OVER (ORDER BY institutional_birth_pct) ir_inst,
    PERCENT_RANK() OVER (ORDER BY child_vax_pct)           ir_vax,
    PERCENT_RANK() OVER (ORDER BY child_stunted_pct)       ir_stunt,
    PERCENT_RANK() OVER (ORDER BY women_anaemic_pct)       ir_anaem,
    PERCENT_RANK() OVER (ORDER BY insurance_pct)           ir_ins,
    PERCENT_RANK() OVER (ORDER BY female_literacy_pct)     ir_lit,
    PERCENT_RANK() OVER (ORDER BY sanitation_pct)          ir_san,
    PERCENT_RANK() OVER (ORDER BY n_facilities)            ir_fac,
    PERCENT_RANK() OVER (ORDER BY km_nearest_facility)     ir_dist
  FROM base
)
SELECT district_name, state_ut, 'burden' AS category, 'Low institutional birth rate' AS driver_label,
       ROUND(institutional_birth_pct,1) AS value, '% of births in a facility' AS unit,
       'institutional_birth_5y_pct' AS source_field, ROUND((1-ir_inst)*100,0) AS severity
FROM r WHERE institutional_birth_pct IS NOT NULL
UNION ALL SELECT district_name, state_ut, 'burden','Low child full-vaccination', ROUND(child_vax_pct,1), '% of children 12-23m','child_12_23m_fully_vaccinated_pct', ROUND((1-ir_vax)*100,0) FROM r WHERE child_vax_pct IS NOT NULL
UNION ALL SELECT district_name, state_ut, 'burden','High under-5 stunting', ROUND(child_stunted_pct,1), '% of children under 5','child_u5_who_are_stunted_pct', ROUND(ir_stunt*100,0) FROM r WHERE child_stunted_pct IS NOT NULL
UNION ALL SELECT district_name, state_ut, 'burden','High anaemia in women', ROUND(women_anaemic_pct,1), '% of women 15-49','all_w15_49_who_are_anaemic_pct', ROUND(ir_anaem*100,0) FROM r WHERE women_anaemic_pct IS NOT NULL
UNION ALL SELECT district_name, state_ut, 'vulnerability','Low health-insurance coverage', ROUND(insurance_pct,1), '% of households','hh_member_covered_health_insurance_pct', ROUND((1-ir_ins)*100,0) FROM r WHERE insurance_pct IS NOT NULL
UNION ALL SELECT district_name, state_ut, 'vulnerability','Low female literacy', ROUND(female_literacy_pct,1), '% of women 15-49','women_age_15_49_who_are_literate_pct', ROUND((1-ir_lit)*100,0) FROM r WHERE female_literacy_pct IS NOT NULL
UNION ALL SELECT district_name, state_ut, 'vulnerability','Low improved sanitation', ROUND(sanitation_pct,1), '% of households','hh_use_improved_sanitation_pct', ROUND((1-ir_san)*100,0) FROM r WHERE sanitation_pct IS NOT NULL
UNION ALL SELECT district_name, state_ut, 'supply','Few healthcare facilities', CAST(n_facilities AS DOUBLE), 'facilities mapped','facilities registry', ROUND((1-ir_fac)*100,0) FROM r
UNION ALL SELECT district_name, state_ut, 'access','Long distance to nearest facility', ROUND(km_nearest_facility,1), 'km from district centroid','facilities + pincode (Haversine)', ROUND(ir_dist*100,0) FROM r WHERE km_nearest_facility IS NOT NULL
UNION ALL SELECT district_name, state_ut, 'specialty','Few maternal-capable facilities', CAST(n_maternal_facilities AS DOUBLE), 'facilities mapped','facilities.specialties', CASE WHEN n_maternal_facilities=0 THEN 100 ELSE 50 END FROM r;
