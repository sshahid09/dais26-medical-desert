import type {
  DistrictListItem,
  DistrictDetailResponse,
  StatsResponse,
  DistrictFull,
} from './types';

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${res.statusText}`);
  return (await res.json()) as T;
}

export interface DistrictFilters {
  state?: string;
  tier?: string;
  gap?: string;
  q?: string;
  minConfidence?: string;
  limit?: number;
}

export function fetchStats(): Promise<StatsResponse> {
  return getJSON<StatsResponse>('/api/stats');
}

export function fetchDistricts(f: DistrictFilters = {}): Promise<DistrictListItem[]> {
  const params = new URLSearchParams();
  if (f.state) params.set('state', f.state);
  if (f.tier) params.set('tier', f.tier);
  if (f.gap) params.set('gap', f.gap);
  if (f.q) params.set('q', f.q);
  if (f.minConfidence) params.set('minConfidence', f.minConfidence);
  if (f.limit) params.set('limit', String(f.limit));
  const qs = params.toString();
  return getJSON<DistrictListItem[]>(`/api/districts${qs ? `?${qs}` : ''}`);
}

export function fetchDistrict(name: string, state: string): Promise<DistrictDetailResponse> {
  const params = new URLSearchParams({ name, state });
  return getJSON<DistrictDetailResponse>(`/api/district?${params.toString()}`);
}

export function fetchCompare(keys: string[]): Promise<DistrictFull[]> {
  const params = new URLSearchParams({ keys: keys.join(';') });
  return getJSON<DistrictFull[]>(`/api/compare?${params.toString()}`);
}
