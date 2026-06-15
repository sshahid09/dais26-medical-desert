-- facilities_geo: cleaned facility registry for map points + per-district supply.
-- - Normalizes messy facilityTypeId / operatorTypeId into clean buckets.
-- - Maps each facility to a district via its 6-digit pincode (modal district per pincode).
-- - Flags coordinates that fall inside India's bounding box (data-quality guard).
-- - has_maternal: specialty string mentions obstetric/maternal/neonatal/pediatric care.
CREATE OR REPLACE TABLE workspace.medical_desert.facilities_geo AS
WITH px AS (
  SELECT pincode, district, state FROM (
    SELECT pincode,
           UPPER(TRIM(district))  AS district,
           UPPER(TRIM(statename)) AS state,
           ROW_NUMBER() OVER (PARTITION BY pincode ORDER BY COUNT(*) DESC) AS rn
    FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.india_post_pincode_directory
    GROUP BY pincode, UPPER(TRIM(district)), UPPER(TRIM(statename))
  ) WHERE rn = 1
)
SELECT
  f.unique_id AS facility_id,
  REGEXP_REPLACE(f.name, '[\\x00-\\x1F]', ' ') AS name,
  CASE WHEN LOWER(f.facilityTypeId) IN ('hospital','clinic','dentist','doctor','nursing_home','pharmacy','farmacy')
       THEN LOWER(f.facilityTypeId) ELSE 'other' END AS facility_type,
  CASE WHEN LOWER(f.operatorTypeId) IN ('public','government') THEN 'public'
       WHEN LOWER(f.operatorTypeId) = 'private' THEN 'private'
       WHEN LOWER(f.operatorTypeId) = 'ngo'     THEN 'ngo'
       ELSE 'unknown' END AS operator_type,
  REGEXP_REPLACE(f.address_city, '[\\x00-\\x1F]', ' ') AS city,
  REGEXP_REPLACE(f.address_stateOrRegion, '[\\x00-\\x1F]', ' ') AS region_raw,
  TRY_CAST(f.address_zipOrPostcode AS BIGINT) AS pincode,
  f.latitude,
  f.longitude,
  (f.latitude BETWEEN 6 AND 37 AND f.longitude BETWEEN 68 AND 98) AS coord_in_india,
  TRY_CAST(f.numberDoctors AS INT) AS doctors,
  TRY_CAST(f.capacity AS INT)      AS beds,
  ( LOWER(COALESCE(f.specialties,'')) LIKE '%obstet%'
    OR LOWER(COALESCE(f.specialties,'')) LIKE '%gynecolog%'
    OR LOWER(COALESCE(f.specialties,'')) LIKE '%neonat%'
    OR LOWER(COALESCE(f.specialties,'')) LIKE '%maternal%'
    OR LOWER(COALESCE(f.specialties,'')) LIKE '%pediatric%' ) AS has_maternal,
  px.district AS district,
  px.state    AS state
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities f
LEFT JOIN px ON TRY_CAST(f.address_zipOrPostcode AS BIGINT) = px.pincode
WHERE (UPPER(f.address_country) = 'INDIA' OR f.address_countryCode = 'IN')
  AND f.unique_id IS NOT NULL
-- the source registry's dedup leaves some duplicate unique_id values; keep one row per id
QUALIFY ROW_NUMBER() OVER (PARTITION BY f.unique_id ORDER BY f.name NULLS LAST) = 1;
