
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';

export enum ModuleType {
  DISCOVER = 'DISCOVER',
  RESERVE = 'RESERVE',
  RELATIONSHIP = 'RELATIONSHIP',
  SERVICE_OS = 'SERVICE_OS',
  FLOW = 'FLOW',
  SUPPLY = 'SUPPLY',
  CARE = 'CARE',
  FINANCE_HUB = 'FINANCE_HUB',
  COMMAND = 'COMMAND',
  STAFF_HUB = 'STAFF_HUB',
  KITCHEN_KDS = 'KITCHEN_KDS',
  BRAND_STUDIO = 'BRAND_STUDIO',
  CONFIG = 'CONFIG',
  PAYROLL = 'PAYROLL',
  GENESIS = 'GENESIS',
  MOBILE_MGR = 'MOBILE_MGR',
  OH_YEAH = 'OH_YEAH'
}

export type UserRole = 'admin' | 'gerencia' | 'mesero' | 'cocina' | 'desarrollo';

/* Genesis Internal Scoring Types */
export interface GenesisSignalScore {
  size: number;           // 0-25
  revenue: number;        // 0-25
  complexity: number;     // 0-20
  dataMaturity: number;   // 0-15
  strategicValue: number; // 0-15
  total: number;          // 0-100
  classification: 'MICRO' | 'MEDIUM' | 'INTERESTING' | 'PREMIUM';
  insights: string[];
}

export interface GenesisInternalReport {
  restaurantName: string;
  location: string;
  score: GenesisSignalScore;
  leadIntent: number; // 0-100 based on behavior
  timestamp: string;
}

export type RFMSegment = 'CHAMPION' | 'LOYAL' | 'AT_RISK' | 'ABOUT_TO_SLEEP' | 'NEW' | 'POTENTIAL';

export interface CustomerPreference {
  category: string;
  item_name: string;
  weight: number; 
}

export interface NexumMasterTag {
  id: string;
  label: string;
  type: 'behavior' | 'financial' | 'psychographic' | 'alert';
  color: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  segment: RFMSegment;
  total_spend: number;
  order_count: number;
  visit_count: number;
  last_visit_at: string;
  rating: number;
  avatar_url: string;
  preferences: CustomerPreference[];
  tags: NexumMasterTag[];
  ai_hospitality_note?: string;
  rfm_scores: { r: number; f: number; m: number };
}

export type PYGCategory = 
  | 'Costo de alimentos' 
  | 'Costo de bebidas' 
  | 'Empaques y desechables' 
  | 'Comisiones y plataformas' 
  | 'Personal operativo' 
  | 'Arriendo y ocupación' 
  | 'Servicios públicos y conectividad' 
  | 'Aseo, mantenimiento y operación' 
  | 'Marketing y crecimiento' 
  | 'Tecnología y suscripciones' 
  | 'Impuestos y tasas no recuperables' 
  | 'Finanzas, legales y otros';

export type AccountingNature = 'COSTO' | 'GASTO';

export interface SupplyItem {
  id: string;
  name: string;
  theoretical: number;
  real: number;
  costPerUnit: number;
  status: 'optimal' | 'low' | 'critical' | 'variance_alert';
  unit: string;
  category: string;
  pyg_category?: PYGCategory;
  nature?: AccountingNature;
  lastCostIncrease: number;
  expirationDate: string;
  pending_invoice: boolean;
  received_quantity?: number;
  cufe?: string;
  confidence_score?: number; 
  niif_mapping?: string; 
  last_recon_at?: string;
  variance_pct?: number;
  audit_requested?: boolean;
}

export interface Table {
  id: number;
  status: 'free' | 'occupied' | 'calling' | 'reserved' | 'seated' | 'waiting_list';
  seats: number;
  zone: string;
  name?: string;
  welcome_timer_start?: string | null;
  ritual_step?: number;
}

export interface AttendanceLog {
  id: string;
  staff_id: string;
  name: string;
  timestamp: string;
  type: 'IN' | 'OUT';
  confidence: number;
}

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  loyalty_level: LoyaltyLevel;
}

export interface RitualTask {
  id: string;
  table_id: number;
  step_label: string;
  staff_id: string;
  started_at: string;
  completed_at?: string;
  status: 'active' | 'completed';
  responsible?: string;
}

export interface ServiceIncident {
  id: string;
  tableId: number;
  type: string;
  severity: Severity;
  timeElapsed: number;
  customerLTV: number;
  status: 'active' | 'resolved';
}

export interface Opportunity {
  id: string;
  title: string;
  type: 'TRAFFIC' | 'EVENT' | 'COMPETITOR' | 'WEATHER';
  score: number;
  description: string;
  potentialRevenue: number;
  aiReasoning: string;
}

export type LoyaltyLevel = 'UMBRAL' | 'CONSAGRADO' | 'CATADOR' | 'SUPREMO' | 'ULTRA_VIP';

export interface MenuItem { id?: string; name: string; price: number; category: string; }
export interface OmmEvent { id: string; title: string; date: string; price: number; category: string; image_url: string; }
export interface EventTicket { id: string; event_id: string; customer_name: string; customer_phone: string; customer_email: string; ticket_code: string; is_paid: boolean; checked_in: boolean; checked_in_at?: string; created_at: string; }
export interface ShiftPrediction { date: string; expected_traffic: string; reasoning: string; external_event: string; recommended_staff: number; }
export interface Brand { id: string; name: string; logo_url?: string; primary_color?: string; secondary_color?: string; settings?: any; }
export interface SocialProfile { id: string; name: string; relation: string; preferences: string[]; }

/* Business DNA & AI Agency Types */
export type BusinessDNA = 'FINE_DINING' | 'BAR_NIGHTLIFE' | 'CASUAL_DINING' | 'CASUAL_PREMIUM' | 'QSR_FAST_CASUAL';
export type AIAgencyLevel = 'ADVISORY' | 'CO_PILOT' | 'AUTONOMOUS';

export interface OperationalSettings {
  id?: string;
  business_dna: BusinessDNA;
  target_margin: number;
  target_cogs: number;
  target_labor: number;
  ai_agency_level: AIAgencyLevel;
  notifications_enabled: boolean;
}

export interface MicroCredential {
  id: string;
  name: string;
  level: number;
  category: string;
  status: 'earned' | 'in_progress' | 'not_started';
}

export interface SalaryBenchmark {
  city: string;
  role: string;
  avg_base: number;
  currency: string;
}

export interface PayrollEmployee { id: string; name: string; role: string; base_salary: number; efficiency: number; credentials?: MicroCredential[]; reputation_score: number; }

export enum GameStatus { IDLE, PLAYING, PAUSED }
export enum CutDirection { UP, DOWN, LEFT, RIGHT, ANY }
export interface NoteData {
  id: string;
  time: number;
  lineIndex: number;
  lineLayer: number;
  type: 'left' | 'right';
  cutDirection: CutDirection;
  hit?: boolean;
  missed?: boolean;
  hitTime?: number;
}
export interface HandPositions {
  left: THREE.Vector3 | null;
  right: THREE.Vector3 | null;
  leftVelocity: THREE.Vector3;
  rightVelocity: THREE.Vector3;
}
export const COLORS = {
  left: '#ef4444', 
  right: '#2563eb' 
};
export type HandType = 'left' | 'right';

export const NEXUS_COLORS = {
  primary: '#2563eb',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444'
};

export interface InventoryItem {
  name: string;
  current: number;
  minStock: number;
  unit: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'inactive';
  shift: string;
}

export interface KitchenOrder {
  id: string;
  table_id: number;
  opened_at: string;
  items: any[];
}

export type Severity = 'Crítica' | 'Alta' | 'Media' | 'Baja';

export interface Transaction {
  id: string;
  amount: number;
  type: string;
  timestamp: string;
}

export interface Recipe {
  id: string;
  menu_item_id: string;
  name: string;
  total_cost: number;
  target_margin: number;
  suggested_price: number;
  ingredients: { supply_item_id: string; name: string; quantity: number; unit: string; cost_contribution: number; }[];
}
