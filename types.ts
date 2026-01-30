
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
  FINANCE_HUB = 'FINANCE_HUB', // Unificado
  COMMAND = 'COMMAND',
  STAFF_HUB = 'STAFF_HUB',
  KITCHEN_KDS = 'KITCHEN_KDS',
  BRAND_STUDIO = 'BRAND_STUDIO'
}

// Roles solicitados para el restaurante real
export type UserRole = 'admin' | 'desarrollo' | 'gerencia' | 'mesero' | 'chef';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
}

export interface MenuItem {
  category: string;
  name: string;
  price: number;
  note: string;
}

export interface Table {
  id: number;
  name?: string;
  status: TableStatus;
  seats: number;
  zone: 'Cava VIP' | 'Salón Principal' | 'Terraza';
  ritual_step: number;
  ritualStep?: number;
  welcome_timer_start?: string | null;
}

export type TableStatus = 'free' | 'occupied' | 'calling' | 'ordered' | 'cleaning' | 'reserved';

export interface RitualTask {
  id: string;
  table_id: number;
  step_label: string;
  staff_id: string;
  started_at: string;
  completed_at?: string;
  status: 'active' | 'completed';
  responsible: string;
}

export interface Brand {
  id: string;
  name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  settings?: any;
}

export interface OmmEvent {
  id: string;
  title: string;
  description: string;
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
  checked_in_at?: string | null;
  created_at?: string;
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

export interface Transaction {
  id: string;
  timestamp: number;
  type: string;
  amount: number;
  tax: number;
  paymentMethod: string;
  brand: string;
  status: 'conciliado' | 'pendiente' | 'error';
}

export interface FinancialAnomaly {
  id: string;
  title: string;
  severity: 'alta' | 'media' | 'baja';
  description: string;
  impact: number;
}

export interface CashflowPoint {
  date: string;
  actual: number;
  predicted: number;
}

export enum GameStatus { IDLE = 'IDLE', PLAYING = 'PLAYING', PAUSED = 'PAUSED', ENDED = 'ENDED' }
export type HandType = 'left' | 'right';
export interface HandPositions {
  left: THREE.Vector3 | null;
  right: THREE.Vector3 | null;
  leftVelocity: THREE.Vector3;
  rightVelocity: THREE.Vector3;
}

export enum CutDirection {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  ANY = 'ANY'
}

export interface NoteData {
  id: string;
  time: number;
  lineIndex: number;
  lineLayer: number;
  type: HandType;
  cutDirection: CutDirection;
  hit?: boolean;
  missed?: boolean;
  hitTime?: number;
}

export const COLORS = {
  left: '#ef4444',
  right: '#2563eb',
};

// --- Added missing exports to resolve build errors ---

/**
 * @description Standard color palette for the NEXUM system
 */
export const NEXUS_COLORS = {
  primary: '#2563eb',
  secondary: '#0a0a0c',
  accent: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
};

/**
 * @description Representation of an item in the inventory for KPI tracking
 */
export interface InventoryItem {
  name: string;
  current: number;
  minStock: number;
  unit: string;
}

/**
 * @description Representation of a staff member within the hub
 */
export interface StaffMember {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'inactive';
  shift: string;
}

/**
 * @description Single item within a kitchen order
 */
export interface KitchenOrderItem {
  id: string;
  order_id: string;
  status: 'pending' | 'preparing' | 'served';
  quantity: number;
  menu_items: {
    name: string;
    category: string;
  };
}

/**
 * @description Full kitchen order for KDS and Flow modules
 */
export interface KitchenOrder {
  id: string;
  table_id: number;
  opened_at: string;
  items: KitchenOrderItem[];
}

/**
 * @description Base item in the supply chain / inventory
 */
export interface SupplyItem {
  id: string;
  name: string;
  category: string;
  theoretical: number;
  real: number;
  unit: string;
  costPerUnit: number;
  lastCostIncrease: number;
  expirationDate: string;
  status: 'optimal' | 'low' | 'critical';
}

/**
 * @description Severity levels for service incidents
 */
export type Severity = 'Crítica' | 'Alta' | 'Media' | 'Baja';

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  segment: string;
  total_spend: number;
  lastVisit: string;
  preferredRest: string;
  tastes: string[];
  nextVisitPrediction: string;
  churnRisk: number;
  walletBalance: string;
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
