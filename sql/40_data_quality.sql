-- md_data_quality: dataset-level QA summary for the app's "About the data" panel.
CREATE OR REPLACE TABLE workspace.medical_desert.md_data_quality AS
SELECT
  (SELECT COUNT(*) FROM workspace.medical_desert.districts_enriched) AS districts_scored,
  (SELECT COUNT(*) FROM workspace.medical_desert.districts_enriched WHERE supply_matched) AS districts_supply_matched,
  (SELECT COUNT(*) FROM workspace.medical_desert.facilities_geo) AS facilities_total,
  (SELECT COUNT(*) FROM workspace.medical_desert.facilities_geo WHERE district IS NOT NULL) AS facilities_mapped_to_district,
  (SELECT COUNT(*) FROM workspace.medical_desert.facilities_geo WHERE coord_in_india) AS facilities_with_valid_coords,
  (SELECT ROUND(AVG(indicator_completeness),2) FROM workspace.medical_desert.districts_enriched) AS avg_indicator_completeness,
  CAST('NFHS-5 fieldwork ~2019-2021' AS STRING) AS nfhs_recency,
  current_timestamp() AS generated_at;
