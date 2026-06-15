// Shared types mirroring the Lakebase synced tables / API responses.

export type SeverityTier = 'Critical' | 'High-risk' | 'Moderate' | 'Adequate';
export type Confidence = 'High' | 'Medium' | 'Low';
export type DominantGap = 'supply' | 'access' | 'vulnerability' | 'burden' | 'specialty';

export interface ComponentScores {
  supply_score: number;
  access_score: number;
  vulnerability_score: number;
  burden_score: number;
  specialty_gap_score: number;
}

export interface DistrictListItem {
  district_name: string;
  state_ut: string;
  district_lat: number | null;
  district_lon: number | null;
  medical_desert_score: number;
  severity_tier: SeverityTier;
  dominant_gap: DominantGap;
  recommended_intervention: string;
  supply_score: number;
  access_score: number;
  vulnerability_score: number;
  burden_score: number;
  specialty_gap_score: number;
  n_facilities: number;
  total_doctors: number;
  km_nearest_facility: number | null;
  confidence: Confidence;
}

export interface DistrictFull extends DistrictListItem {
  institutional_birth_pct: number | null;
  child_vax_pct: number | null;
  anc4_pct: number | null;
  child_stunted_pct: number | null;
  child_underweight_pct: number | null;
  women_anaemic_pct: number | null;
  insurance_pct: number | null;
  female_literacy_pct: number | null;
  water_pct: number | null;
  sanitation_pct: number | null;
  electricity_pct: number | null;
  women_high_bloodsugar_pct: number | null;
  n_hospitals: number;
  n_public: number;
  n_private: number;
  total_beds: number;
  n_maternal_facilities: number;
  km_nearest_maternal: number | null;
  supply_matched: boolean;
  indicator_completeness: number;
  confidence_notes: string;
}

export interface EvidenceDriver {
  category: DominantGap;
  driver_label: string;
  value: number | null;
  unit: string;
  source_field: string;
  severity: number;
}

export interface FacilityPoint {
  facility_id: string;
  name: string;
  facility_type: string;
  operator_type: string;
  city: string | null;
  doctors: number | null;
  beds: number | null;
  has_maternal: boolean;
  latitude: number;
  longitude: number;
}

export interface DistrictDetailResponse {
  district: DistrictFull;
  drivers: EvidenceDriver[];
  facilities: FacilityPoint[];
}

export interface StatsResponse {
  overview: {
    districts: number;
    underserved: number;
    facilities: number;
    avg_insurance: number;
    avg_institutional_birth: number;
    high_conf: number;
  };
  byTier: { severity_tier: SeverityTier; n: number }[];
  states: { state_ut: string; n: number; avg_score: number }[];
  dataQuality: {
    districts_scored: number;
    supply_matched: number;
    facilities_total: number;
    facilities_mapped: number;
    avg_completeness: number;
  };
}
