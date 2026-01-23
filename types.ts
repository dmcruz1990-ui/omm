
import * as THREE from 'three';

export enum ModuleType {
  DISCOVER = 'DISCOVER',
  RESERVE = 'RESERVE',
  RELATIONSHIP = 'RELATIONSHIP',
  SERVICE_OS = 'SERVICE_OS',
  FLOW = 'FLOW',
  SUPPLY = 'SUPPLY',
  CARE = 'CARE',
  FINANCE = 'FINANCE',
  COMMAND = 'COMMAND',
  STAFF_HUB = 'STAFF_HUB'
}

export type TableStatus = 'free' | 'occupied' | 'calling' | 'ordered' | 'cleaning' | 'reserved';

export interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'mesero' | 'chef' | 'hostess';
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

export interface Customer {
  id: string;
  name: string;
  phone: string;
  vip_status: boolean;
  notes?: string;
}

export interface Order {
  id: string;
  table_id: number;
  status: 'open' | 'preparing' | 'delivered' | 'paid';
  total_amount: number;
  opened_at: string;
}

export interface Reservation {
  id: string;
  customer?: string;
  customer_id?: string;
  table_id?: number;
  assignedTable?: number;
  reservation_time?: string;
  time?: string;
  pax: number;
  plan?: string;
  type?: string;
  status: string;
  noShowProbability?: number;
  duration?: number;
  upsellSuggested?: string;
}

export interface ServiceRecord {
  table_id: number;
  type: string;
  duration_seconds: number;
  timestamp: string;
  staff_id: string;
}

export interface RitualTask {
  id: string;
  table_id?: number;
  tableId?: number;
  ritual_label?: string;
  ritualLabel?: string;
  responsible: 'MESERO' | 'COCINA' | 'BAR' | 'SOMMELIER';
  start_time?: string;
  startTime?: number;
  status: 'pending' | 'active' | 'completed';
}

export const NEXUS_COLORS = {
  primary: '#2563eb',
  secondary: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  bg: '#0a0a0c',
  card: '#111114'
};

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

export interface Opportunity {
  id: string;
  title: string;
  type: 'TRAFFIC' | 'EVENT' | 'COMPETITOR' | 'WEATHER';
  score: number;
  description: string;
  potentialRevenue: number;
  aiReasoning: string;
}

export type MarketingAction = string;

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
  status: string;
  shift: string;
}

export interface Experience {
  id: string;
  title: string;
  category: string;
  price: number;
  availability: number;
  impact: number;
  actionLabel: string;
}

export interface PlanType {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  segment: string;
  totalSpend: number;
  lastVisit: string;
  preferredRest: string;
  tastes: string[];
  nextVisitPrediction: string;
  churnRisk: number;
  walletBalance: string;
}

export interface KitchenOrder {
  id: string;
  tableId: number;
  items: string[];
  status: 'pending' | 'preparing' | 'ready';
  timestamp: number;
}

export interface StationSaturation {
  station: string;
  load: number;
}

export interface SupplyItem {
  id: string;
  name: string;
  theoretical: number;
  real: number;
  unit: string;
  category: string;
  costPerUnit: number;
  lastCostIncrease: number;
  expirationDate: string;
  status: 'optimal' | 'low' | 'critical' | 'waste_risk';
}

export interface PurchaseOrder {
  id: string;
  provider: string;
  total: number;
  itemsCount: number;
  status: 'pending' | 'approved' | 'received';
  aiSuggested: boolean;
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
