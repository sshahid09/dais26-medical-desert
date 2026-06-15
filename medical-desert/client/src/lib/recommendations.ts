import type { DistrictFull, DominantGap, SeverityTier } from './types';

export type ActionPhase = 'immediate' | 'short_term' | 'long_term';

export interface ActionItem {
  phase: ActionPhase;
  title: string;
  description: string;
  gap: DominantGap;
  metricTrigger: string;
  program?: string; // Indian govt program name if applicable
}

export type Urgency = 'critical' | 'high' | 'moderate' | 'watch';

export interface RecommendationPlan {
  urgency: Urgency;
  headline: string;
  actions: ActionItem[];
}

// ── Thresholds ───────────────────────────────────────────────────────────────

const T = {
  supply: {
    criticalFacilities: 2,
    lowFacilities: 5,
    criticalDoctors: 3,
    lowDoctors: 10,
    criticalBeds: 10,
    scoreHigh: 75,
    scoreMid: 50,
  },
  access: {
    criticalDistKm: 30,
    highDistKm: 15,
    criticalMaternalKm: 50,
    highMaternalKm: 30,
    scoreHigh: 75,
    scoreMid: 50,
  },
  vulnerability: {
    criticalInsurance: 20,
    lowInsurance: 40,
    criticalLiteracy: 40,
    lowLiteracy: 60,
    criticalSanitation: 30,
    lowSanitation: 50,
    criticalWater: 50,
    scoreHigh: 70,
    scoreMid: 45,
  },
  burden: {
    criticalBirth: 50,
    lowBirth: 70,
    criticalVax: 50,
    lowVax: 70,
    criticalStunting: 40,
    highStunting: 25,
    criticalAnaemia: 55,
    highAnaemia: 40,
    scoreHigh: 70,
    scoreMid: 45,
  },
  specialty: {
    noMaternalFacilities: 1,
    criticalMaternalKm: 40,
    scoreHigh: 70,
    scoreMid: 45,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function tierToUrgency(tier: SeverityTier): Urgency {
  return ({ Critical: 'critical', 'High-risk': 'high', Moderate: 'moderate', Adequate: 'watch' } as const)[tier];
}


// ── Rubric engine ─────────────────────────────────────────────────────────────

export function buildRecommendationPlan(d: DistrictFull): RecommendationPlan {
  const actions: ActionItem[] = [];

  // ── 1. SUPPLY GAP ──────────────────────────────────────────────────────────
  const supplyHigh = d.supply_score >= T.supply.scoreHigh;
  const supplyMid = d.supply_score >= T.supply.scoreMid;

  if (supplyMid) {
    const _supplyStart = actions.length;

    if ((d.n_facilities ?? 0) < T.supply.criticalFacilities) {
      actions.push({
        phase: 'immediate',
        title: 'Emergency satellite health facility',
        description: `Only ${d.n_facilities ?? 0} facility/ies serve this district. Establish a government-run Sub-Health Centre or Community Health Centre (CHC) with at least one resident medical officer.`,
        gap: 'supply',
        metricTrigger: `${d.n_facilities ?? 0} facilities (critical threshold: <${T.supply.criticalFacilities})`,
        program: 'NHM – CHC/PHC facility expansion',
      });
    } else if ((d.n_facilities ?? 0) < T.supply.lowFacilities && supplyHigh) {
      actions.push({
        phase: 'short_term',
        title: 'Additional primary health sub-centre',
        description: `Facility count (${d.n_facilities ?? 0}) is below recommended norms. Add sub-health centres at the village level to improve coverage ratios.`,
        gap: 'supply',
        metricTrigger: `${d.n_facilities ?? 0} facilities (recommended: ≥${T.supply.lowFacilities})`,
        program: 'NHM – Sub-Health Centre expansion',
      });
    }

    if ((d.total_doctors ?? 0) < T.supply.criticalDoctors) {
      actions.push({
        phase: 'immediate',
        title: 'Emergency physician placement + teleconsultation kiosks',
        description: `Critically low doctor count (${d.total_doctors ?? 0}). Deploy physicians under rural service obligation and install eSanjeevani teleconsultation kiosks at PHC/SHC level.`,
        gap: 'supply',
        metricTrigger: `${d.total_doctors ?? 0} doctors (critical threshold: <${T.supply.criticalDoctors})`,
        program: 'eSanjeevani OPD + NHM Rural Service Obligation',
      });
    } else if ((d.total_doctors ?? 0) < T.supply.lowDoctors && supplyHigh) {
      actions.push({
        phase: 'short_term',
        title: 'Rural physician incentive scheme',
        description: `Doctor-to-population ratio is low (${d.total_doctors ?? 0} doctors). Apply state-level rural hardship allowances and MBBS-to-rural posting quotas to attract and retain practitioners.`,
        gap: 'supply',
        metricTrigger: `${d.total_doctors ?? 0} doctors (recommended: ≥${T.supply.lowDoctors})`,
        program: 'State rural posting incentives',
      });
    }

    if ((d.n_public ?? 0) === 0) {
      actions.push({
        phase: 'short_term',
        title: 'Public sector facility establishment',
        description: 'No public facility detected — residents depend entirely on private or absent care. Engage state health dept to establish or adopt one facility as a government-run PHC.',
        gap: 'supply',
        metricTrigger: '0 public facilities',
        program: 'NHM – Public facility mapping & gap-fill',
      });
    }

    if ((d.total_beds ?? 0) < T.supply.criticalBeds && supplyHigh) {
      actions.push({
        phase: 'short_term',
        title: 'Inpatient bed capacity expansion',
        description: `Total bed count (${d.total_beds ?? 0}) is critically low. Upgrade nearest CHC to 30-bed FRU standard and add maternity observation beds.`,
        gap: 'supply',
        metricTrigger: `${d.total_beds ?? 0} beds (critical threshold: <${T.supply.criticalBeds})`,
        program: 'FRU/CHC bed-strength upgrade',
      });
    }

    // Fallback: percentile score is high but no specific absolute threshold fired
    if (actions.length === _supplyStart) {
      actions.push({
        phase: supplyHigh ? 'short_term' : 'long_term',
        title: 'District Health Action Plan — supply audit',
        description: `This district ranks at the ${d.supply_score.toFixed(0)}th percentile nationally for healthcare supply shortage. Commission a DHAP facility audit covering density per 1,000 population, staffing norms, bed ratios, and public-private service mix to identify the highest-impact investment.`,
        gap: 'supply',
        metricTrigger: `supply_score = ${d.supply_score.toFixed(0)}/100 (${d.supply_score >= 90 ? 'top 10%' : d.supply_score >= 75 ? 'top 25%' : 'top 50%'} nationally for supply shortage)`,
        program: 'NHM – District Health Action Plan (DHAP)',
      });
    }
  }

  // ── 2. ACCESS GAP ─────────────────────────────────────────────────────────
  const accessHigh = d.access_score >= T.access.scoreHigh;
  const accessMid = d.access_score >= T.access.scoreMid;

  if (accessMid) {
    const _accessStart = actions.length;
    const distKm = d.km_nearest_facility ?? 0;
    if (distKm >= T.access.criticalDistKm) {
      actions.push({
        phase: 'immediate',
        title: 'Scheduled mobile health unit (weekly rounds)',
        description: `Nearest facility is ${distKm.toFixed(0)} km away — far beyond acceptable travel. Deploy a mobile unit making weekly village visits covering primary care, maternal screening, and immunisation.`,
        gap: 'access',
        metricTrigger: `${distKm.toFixed(0)} km to nearest facility (critical threshold: >${T.access.criticalDistKm} km)`,
        program: 'NHM Mobile Health Unit scheme',
      });
    } else if (distKm >= T.access.highDistKm && accessHigh) {
      actions.push({
        phase: 'short_term',
        title: 'Bi-weekly mobile outreach clinic',
        description: `Travel distance of ${distKm.toFixed(0)} km creates a significant barrier. Establish bi-weekly mobile outreach clinics covering ANC, child health, and basic OPD.`,
        gap: 'access',
        metricTrigger: `${distKm.toFixed(0)} km to nearest facility (high threshold: >${T.access.highDistKm} km)`,
        program: 'NHM Mobile Health Unit scheme',
      });
    }

    const maternalKm = d.km_nearest_maternal ?? 0;
    if (maternalKm >= T.access.criticalMaternalKm) {
      actions.push({
        phase: 'immediate',
        title: '24/7 maternal emergency transport (Janani Express)',
        description: `Nearest maternal care is ${maternalKm.toFixed(0)} km away — a life-threatening gap for obstetric emergencies. Establish a dedicated ambulance/Janani Express with 24/7 call dispatch and a trained birth attendant.`,
        gap: 'access',
        metricTrigger: `${maternalKm.toFixed(0)} km to maternal facility (critical threshold: >${T.access.criticalMaternalKm} km)`,
        program: 'Janani Express / JSSK free transport',
      });
    } else if (maternalKm >= T.access.highMaternalKm && accessHigh) {
      actions.push({
        phase: 'short_term',
        title: 'Referral transport network for maternal care',
        description: `${maternalKm.toFixed(0)} km to nearest maternal facility creates delays for obstetric emergencies. Formalise a community-based referral transport protocol with pre-identified drivers and 108/102 ambulance tie-up.`,
        gap: 'access',
        metricTrigger: `${maternalKm.toFixed(0)} km to maternal care (high threshold: >${T.access.highMaternalKm} km)`,
        program: 'JSSK / 108 ambulance network',
      });
    }

    // Fallback: high access score but distances don't meet specific thresholds
    if (actions.length === _accessStart) {
      actions.push({
        phase: accessHigh ? 'immediate' : 'short_term',
        title: 'Mobile outreach clinic + referral transport',
        description: `This district ranks at the ${d.access_score.toFixed(0)}th percentile nationally for geographic access barriers. Deploy scheduled mobile clinic visits and establish a formal 108/102 ambulance referral protocol to reduce effective travel time to care.`,
        gap: 'access',
        metricTrigger: `access_score = ${d.access_score.toFixed(0)}/100 (${d.access_score >= 90 ? 'top 10%' : d.access_score >= 75 ? 'top 25%' : 'top 50%'} nationally for access barriers)`,
        program: 'NHM Mobile Health Unit + 108 ambulance network',
      });
    }
  }

  // ── 3. VULNERABILITY GAP ──────────────────────────────────────────────────
  const vulnHigh = d.vulnerability_score >= T.vulnerability.scoreHigh;
  const vulnMid = d.vulnerability_score >= T.vulnerability.scoreMid;

  if (vulnMid) {
    const _vulnStart = actions.length;
    const ins = d.insurance_pct ?? 100;
    if (ins < T.vulnerability.criticalInsurance) {
      actions.push({
        phase: 'immediate',
        title: 'Emergency Ayushman Bharat (PM-JAY) enrollment drive',
        description: `Only ${ins.toFixed(0)}% have health insurance — catastrophic out-of-pocket costs lock the poor out of care. Deploy ASHA workers with e-KYC equipment to enroll all eligible BPL households within 3 months.`,
        gap: 'vulnerability',
        metricTrigger: `${ins.toFixed(0)}% insured (critical threshold: <${T.vulnerability.criticalInsurance}%)`,
        program: 'Ayushman Bharat – PM-JAY enrollment',
      });
    } else if (ins < T.vulnerability.lowInsurance && vulnHigh) {
      actions.push({
        phase: 'short_term',
        title: 'Health insurance enrollment camps',
        description: `Insurance coverage (${ins.toFixed(0)}%) leaves a large population financially exposed. Organise monthly enrollment camps at gram sabha level with district health officer support.`,
        gap: 'vulnerability',
        metricTrigger: `${ins.toFixed(0)}% insured (recommended: ≥${T.vulnerability.lowInsurance}%)`,
        program: 'Ayushman Bharat – PM-JAY',
      });
    }

    const lit = d.female_literacy_pct ?? 100;
    if (lit < T.vulnerability.criticalLiteracy) {
      actions.push({
        phase: 'short_term',
        title: 'Women\'s health literacy programme (ASHA-led)',
        description: `Female literacy is only ${lit.toFixed(0)}%, severely limiting health-seeking behaviour. Scale up ASHA home visits with pictorial counselling on maternal nutrition, antenatal care, and immunisation.`,
        gap: 'vulnerability',
        metricTrigger: `${lit.toFixed(0)}% female literacy (critical threshold: <${T.vulnerability.criticalLiteracy}%)`,
        program: 'NHM ASHA / ANM community outreach',
      });
    } else if (lit < T.vulnerability.lowLiteracy && vulnHigh) {
      actions.push({
        phase: 'short_term',
        title: 'Community health education sessions',
        description: `Female literacy (${lit.toFixed(0)}%) is below state average. Organise village-level VHSNCs with health education sessions co-facilitated by ANMs and self-help groups.`,
        gap: 'vulnerability',
        metricTrigger: `${lit.toFixed(0)}% female literacy (recommended: ≥${T.vulnerability.lowLiteracy}%)`,
        program: 'VHSNC community health sessions',
      });
    }

    const san = d.sanitation_pct ?? 100;
    if (san < T.vulnerability.criticalSanitation) {
      actions.push({
        phase: 'long_term',
        title: 'ODF-Plus WASH infrastructure (Swachh Bharat)',
        description: `Sanitation coverage is only ${san.toFixed(0)}%, driving diarrhoeal and waterborne disease. Engage SBM-G Phase II for household toilet construction, piped water, and solid-waste management in priority villages.`,
        gap: 'vulnerability',
        metricTrigger: `${san.toFixed(0)}% sanitation coverage (critical threshold: <${T.vulnerability.criticalSanitation}%)`,
        program: 'Swachh Bharat Mission – Grameen Phase II',
      });
    } else if (san < T.vulnerability.lowSanitation && vulnHigh) {
      actions.push({
        phase: 'long_term',
        title: 'Sanitation gap-fill through SBM-G',
        description: `Sanitation access (${san.toFixed(0)}%) is below recommended levels. Identify un-covered households and coordinate with panchayat for SBM-G toilet and handwashing facility completion.`,
        gap: 'vulnerability',
        metricTrigger: `${san.toFixed(0)}% sanitation coverage (recommended: ≥${T.vulnerability.lowSanitation}%)`,
        program: 'Swachh Bharat Mission – Grameen',
      });
    }

    const water = d.water_pct ?? 100;
    if (water < T.vulnerability.criticalWater) {
      actions.push({
        phase: 'long_term',
        title: 'Jal Jeevan Mission safe water access',
        description: `Only ${water.toFixed(0)}% have safe drinking water access, compounding disease burden. Escalate to district JJM unit for piped water connections to remaining households.`,
        gap: 'vulnerability',
        metricTrigger: `${water.toFixed(0)}% safe water access (critical threshold: <${T.vulnerability.criticalWater}%)`,
        program: 'Jal Jeevan Mission – household connections',
      });
    }

    // Fallback: high vulnerability score but no specific indicator crossed threshold
    if (actions.length === _vulnStart) {
      actions.push({
        phase: vulnHigh ? 'short_term' : 'long_term',
        title: 'Targeted ASHA expansion + community health workers',
        description: `This district ranks at the ${d.vulnerability_score.toFixed(0)}th percentile nationally for population vulnerability. Scale up ASHA coverage, prioritise enrollment of marginalised households in PM-JAY, and run village health sanitation and nutrition committee (VHSNC) sessions.`,
        gap: 'vulnerability',
        metricTrigger: `vulnerability_score = ${d.vulnerability_score.toFixed(0)}/100 (${d.vulnerability_score >= 90 ? 'top 10%' : d.vulnerability_score >= 75 ? 'top 25%' : 'top 50%'} nationally for population vulnerability)`,
        program: 'NHM ASHA + Ayushman Bharat PM-JAY',
      });
    }
  }

  // ── 4. HEALTH BURDEN GAP ──────────────────────────────────────────────────
  const burdenHigh = d.burden_score >= T.burden.scoreHigh;
  const burdenMid = d.burden_score >= T.burden.scoreMid;

  if (burdenMid) {
    const _burdenStart = actions.length;
    const birth = d.institutional_birth_pct ?? 100;
    if (birth < T.burden.criticalBirth) {
      actions.push({
        phase: 'immediate',
        title: 'Institutional delivery push — Janani Suraksha Yojana',
        description: `Only ${birth.toFixed(0)}% of deliveries are institutional — home births without skilled attendance are a major cause of maternal mortality. Activate JSY cash incentives, strengthen SBA training, and ensure a 24/7 delivery point within 30 km.`,
        gap: 'burden',
        metricTrigger: `${birth.toFixed(0)}% institutional births (critical threshold: <${T.burden.criticalBirth}%)`,
        program: 'Janani Suraksha Yojana (JSY)',
      });
    } else if (birth < T.burden.lowBirth && burdenHigh) {
      actions.push({
        phase: 'short_term',
        title: 'Antenatal care promotion + skilled birth attendant training',
        description: `Institutional birth rate (${birth.toFixed(0)}%) has room to improve. Strengthen ANC sessions at sub-centres and fast-track SBA certification for resident ANMs and dais.`,
        gap: 'burden',
        metricTrigger: `${birth.toFixed(0)}% institutional births (recommended: ≥${T.burden.lowBirth}%)`,
        program: 'LaQshya / SBA training',
      });
    }

    const vax = d.child_vax_pct ?? 100;
    if (vax < T.burden.criticalVax) {
      actions.push({
        phase: 'immediate',
        title: 'Emergency immunisation catch-up (Mission Indradhanush)',
        description: `Only ${vax.toFixed(0)}% of children are fully vaccinated. Implement intensive Mission Indradhanush rounds targeting zero-dose and under-vaccinated children with mobile immunisation teams.`,
        gap: 'burden',
        metricTrigger: `${vax.toFixed(0)}% child vaccination (critical threshold: <${T.burden.criticalVax}%)`,
        program: 'Mission Indradhanush / INTENSIFIED MI',
      });
    } else if (vax < T.burden.lowVax && burdenHigh) {
      actions.push({
        phase: 'short_term',
        title: 'Routine immunisation strengthening',
        description: `Vaccination coverage (${vax.toFixed(0)}%) falls short of herd immunity thresholds. Audit cold chain gaps, reinstate drop-out tracking, and run village-level immunisation drives.`,
        gap: 'burden',
        metricTrigger: `${vax.toFixed(0)}% child vaccination (recommended: ≥${T.burden.lowVax}%)`,
        program: 'Universal Immunisation Programme (UIP)',
      });
    }

    const stunt = d.child_stunted_pct ?? 0;
    if (stunt > T.burden.criticalStunting) {
      actions.push({
        phase: 'short_term',
        title: 'SAM management + nutrition supplementation (ICDS/POSHAN)',
        description: `${stunt.toFixed(0)}% of under-5 children are stunted — indicating chronic food insecurity and micronutrient deficiency. Strengthen ICDS Anganwadis with RUTF/RUSF supplies, introduce community-based management of SAM, and scale POSHAN Abhiyan interventions.`,
        gap: 'burden',
        metricTrigger: `${stunt.toFixed(0)}% children stunted (critical threshold: >${T.burden.criticalStunting}%)`,
        program: 'POSHAN Abhiyan / ICDS / NRC',
      });
    } else if (stunt > T.burden.highStunting && burdenHigh) {
      actions.push({
        phase: 'short_term',
        title: 'Enhanced nutritional counselling through Anganwadis',
        description: `Stunting prevalence (${stunt.toFixed(0)}%) is above average. Prioritise growth monitoring, dietary diversity counselling, and micronutrient supplementation (Vitamin A, Iron, Zinc) at Anganwadi centres.`,
        gap: 'burden',
        metricTrigger: `${stunt.toFixed(0)}% child stunting (high threshold: >${T.burden.highStunting}%)`,
        program: 'POSHAN Abhiyan – Anganwadi strengthening',
      });
    }

    const anaemia = d.women_anaemic_pct ?? 0;
    if (anaemia > T.burden.criticalAnaemia) {
      actions.push({
        phase: 'short_term',
        title: 'Anaemia mukt Bharat — mass IFA campaign',
        description: `${anaemia.toFixed(0)}% of women are anaemic — this is a public health emergency that drives maternal mortality and low birth weight. Implement weekly IFA supplementation for adolescent girls and pregnant women through school and ANM networks, with deworming.`,
        gap: 'burden',
        metricTrigger: `${anaemia.toFixed(0)}% women anaemic (critical threshold: >${T.burden.criticalAnaemia}%)`,
        program: 'Anaemia Mukt Bharat (AMB)',
      });
    } else if (anaemia > T.burden.highAnaemia && burdenHigh) {
      actions.push({
        phase: 'short_term',
        title: 'Iron-folic acid distribution scale-up',
        description: `Women's anaemia rate (${anaemia.toFixed(0)}%) exceeds the national average. Scale up IFA distribution through ANMs, ASHAs, and school health programmes.`,
        gap: 'burden',
        metricTrigger: `${anaemia.toFixed(0)}% women anaemic (high threshold: >${T.burden.highAnaemia}%)`,
        program: 'Anaemia Mukt Bharat – IFA scale-up',
      });
    }

    // Fallback: high burden score but no specific indicator crossed threshold
    if (actions.length === _burdenStart) {
      actions.push({
        phase: burdenHigh ? 'immediate' : 'short_term',
        title: 'Integrated maternal & child health programme',
        description: `This district ranks at the ${d.burden_score.toFixed(0)}th percentile nationally for health burden. Launch an integrated programme covering ANC, institutional delivery, full immunisation, and child nutrition through the NHM RMNCH+A framework.`,
        gap: 'burden',
        metricTrigger: `burden_score = ${d.burden_score.toFixed(0)}/100 (${d.burden_score >= 90 ? 'top 10%' : d.burden_score >= 75 ? 'top 25%' : 'top 50%'} nationally for health burden)`,
        program: 'NHM RMNCH+A + POSHAN Abhiyan',
      });
    }
  }

  // ── 5. SPECIALTY GAP ──────────────────────────────────────────────────────
  const specHigh = d.specialty_gap_score >= T.specialty.scoreHigh;
  const specMid = d.specialty_gap_score >= T.specialty.scoreMid;

  if (specMid) {
    const _specStart = actions.length;
    const nMat = d.n_maternal_facilities ?? 0;
    if (nMat < T.specialty.noMaternalFacilities) {
      actions.push({
        phase: 'short_term',
        title: 'Upgrade CHC to 24/7 EmOC First Referral Unit',
        description: 'No maternal care facility detected. Upgrade the nearest CHC to FRU standard — trained obstetrician, round-the-clock C-section capability, blood bank linkage, and SNCU for sick neonates.',
        gap: 'specialty',
        metricTrigger: '0 maternal care facilities (minimum: 1)',
        program: 'FRU / LaQshya / Dakshata',
      });
    }

    const matKm = d.km_nearest_maternal ?? 0;
    if (matKm >= T.specialty.criticalMaternalKm && specHigh) {
      actions.push({
        phase: 'immediate',
        title: 'Telemedicine + quarterly specialist outreach missions',
        description: `Nearest specialist maternal facility is ${matKm.toFixed(0)} km away. Establish a telemedicine link to district hospital for OB/GYN, paediatrics, and general surgery, backed by quarterly in-person specialist visits.`,
        gap: 'specialty',
        metricTrigger: `${matKm.toFixed(0)} km to nearest maternal facility (critical threshold: >${T.specialty.criticalMaternalKm} km)`,
        program: 'eSanjeevani specialist consultation',
      });
    }

    if (specHigh && nMat < 2 && matKm >= 20) {
      actions.push({
        phase: 'long_term',
        title: 'Specialist recruitment — OB/GYN + paediatrician',
        description: 'Long-term population coverage requires in-district specialist capacity. Apply state DPMU specialist recruitment quotas and NHM contractual specialist placement.',
        gap: 'specialty',
        metricTrigger: 'Specialist gap combined with high access barrier',
        program: 'NHM specialist contractual recruitment',
      });
    }

    // Fallback: high specialty score but no specific check fired
    if (actions.length === _specStart) {
      actions.push({
        phase: specHigh ? 'short_term' : 'long_term',
        title: 'eSanjeevani telemedicine + specialist outreach',
        description: `This district ranks at the ${d.specialty_gap_score.toFixed(0)}th percentile nationally for specialist care gap. Connect the nearest PHC/CHC to eSanjeevani for remote OB/GYN, paediatric, and surgical consultations and schedule quarterly visiting specialist camps.`,
        gap: 'specialty',
        metricTrigger: `specialty_gap_score = ${d.specialty_gap_score.toFixed(0)}/100 (${d.specialty_gap_score >= 90 ? 'top 10%' : d.specialty_gap_score >= 75 ? 'top 25%' : 'top 50%'} nationally for specialist gap)`,
        program: 'eSanjeevani specialist teleconsultation',
      });
    }
  }

  // ── Sort: immediate → short_term → long_term ──────────────────────────────
  const phaseOrder: Record<ActionPhase, number> = { immediate: 0, short_term: 1, long_term: 2 };
  actions.sort((a, b) => phaseOrder[a.phase] - phaseOrder[b.phase]);

  // ── Deduplicate same-title actions ────────────────────────────────────────
  const seen = new Set<string>();
  const deduped = actions.filter((a) => {
    if (seen.has(a.title)) return false;
    seen.add(a.title);
    return true;
  });

  // ── Headline ──────────────────────────────────────────────────────────────
  const urgency = tierToUrgency(d.severity_tier);
  const immediateCount = deduped.filter((a) => a.phase === 'immediate').length;
  const headline = immediateCount > 0
    ? `${immediateCount} immediate action${immediateCount > 1 ? 's' : ''} required — ${deduped.length} total interventions identified`
    : `${deduped.length} planned intervention${deduped.length !== 1 ? 's' : ''} identified`;

  return { urgency, headline, actions: deduped };
}

export const PHASE_LABEL: Record<ActionPhase, string> = {
  immediate: 'Immediate (0 – 6 months)',
  short_term: 'Short-term (6 – 18 months)',
  long_term: 'Long-term (18+ months)',
};

export const URGENCY_COLOR: Record<Urgency, string> = {
  critical: '#b42318',
  high: '#e8590c',
  moderate: '#c77700',
  watch: '#157a4a',
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  critical: 'CRITICAL',
  high: 'HIGH PRIORITY',
  moderate: 'MODERATE',
  watch: 'WATCH',
};
