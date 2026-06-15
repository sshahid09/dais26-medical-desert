-- Medical Desert Planner — gold-layer setup
-- Target catalog/schema for derived (gold) tables.
-- Source: databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset (Delta Sharing)
CREATE SCHEMA IF NOT EXISTS workspace.medical_desert
  COMMENT 'Gold tables for the Medical Desert Planner app (DAIS 2026).';
