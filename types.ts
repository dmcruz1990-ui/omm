
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
  PAYROLL = 'PAYROLL'
}

/* UserRole including 'desarrollo' */
export type UserRole = 'admin' | 'gerencia' | 'mesero' | 'chef' | 'guest' | 'desarrollo';

/* Recipe interface with all required properties for RecipeManager */
export interface Recipe {
  id: string;
  menu_item_id: string;
  name: string;
  ingredients: Array<{
    supply_item_id: string;
    name: string;
    quantity: number;
    unit: string;
    cost_contribution: number;
  }>;
  total_cost: number;
  target_margin: number;
  suggested_price: number;
}

/* SupplyItem with extended properties */
export interface SupplyItem {
  id: string;
  name: string;
  theoretical: number;
  real: number;
  costPerUnit: number;
  status: 'optimal' | 'low' | 'critical';
  unit: string;
  category: string;
  lastCostIncrease: number;
  expirationDate: string;
  pending_invoice: boolean;
  received_quantity?: number;
}

/* Table interface with extended properties */
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

/* Game types for ExperienceBeats */
export enum GameStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
}

export enum CutDirection {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  ANY = 'ANY',
}

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
  right: '#3b82f6',
};

export type HandType = 'left' | 'right';

/* Operational types */
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

export type Severity = 'Crítica' | 'Alta' | 'Media' | 'Baja';

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

export interface InventoryItem {
  name: string;
  current: number;
  minStock: number;
  unit: string;
}

export const NEXUS_COLORS = {
  primary: '#2563eb',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
};

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'inactive';
  shift: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  segment: string;
  total_spend: number;
  order_count: number;
  visit_count: number;
  rating: number;
  avatar_url: string;
  lastVisit: {
    venue: string;
    total: number;
    items: Array<{
      qty: number;
      name: string;
      price: number;
    }>;
  };
  tags: Array<{
    label: string;
    type: string;
  }>;
  churnRisk: number;
  walletBalance: string;
}

export interface KitchenOrder {
  id: string;
  table_id: number;
  opened_at: string;
  items: any[];
}

export interface Transaction {
  id: string;
  amount: number;
  type: string;
  timestamp: string;
  description: string;
}

export type LoyaltyLevel = 'UMBRAL' | 'CONSAGRADO' | 'CATADOR' | 'SUPREMO' | 'ULTRA_VIP';

export interface MenuItem {
  id?: string;
  name: string;
  price: number;
  category: string;
}

export interface OmmEvent {
  id: string;
  title: string;
  date: string;
  price: number;
  category: string;
  image_url: string;
}

export interface EventTicket {
  id: string;
  event_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  ticket_code: string;
  is_paid: boolean;
  checked_in: boolean;
  checked_in_at?: string;
  created_at: string;
}

export interface ShiftPrediction {
  date: string;
  expected_traffic: string;
  recommended_staff: number;
  reasoning: string;
  external_event: string;
}

export interface Brand {
  id: string;
  name: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  settings?: any;
}

export interface SocialProfile {
  id: string;
  name: string;
  relation: string;
  preferences: string[];
}

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

export interface PayrollEmployee {
  id: string;
  name: string;
  role: string;
  base_salary: number;
  efficiency: number;
}

export interface ShiftPayroll {
  id: string;
  date: string;
  employees: PayrollEmployee[];
}
