
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

export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  venueId: string;
}

export interface Table {
  id: number;
  status: 'free' | 'occupied' | 'calling' | 'ordered' | 'cleaning';
  capacity: number;
  zone: 'Cava VIP' | 'Salón Principal' | 'Terraza';
  welcomeTimerStart?: number;
  ritualStep: number;
}

export interface ServiceRecord {
  tableId: number;
  type: string;
  durationSeconds: number;
  timestamp: number;
  staffId: string;
}

export interface RitualTask {
  id: string;
  tableId: number;
  ritualLabel: string;
  responsible: 'MESERO' | 'COCINA' | 'BAR' | 'SOMMELIER';
  startTime: number;
  status: 'pending' | 'active' | 'completed';
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
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
export enum CutDirection { UP = 'UP', DOWN = 'DOWN', LEFT = 'LEFT', RIGHT = 'RIGHT', ANY = 'ANY' }
export type HandType = 'left' | 'right';

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

export interface HandPositions {
  left: THREE.Vector3 | null;
  right: THREE.Vector3 | null;
  leftVelocity: THREE.Vector3;
  rightVelocity: THREE.Vector3;
}

export const COLORS = { left: '#ef4444', right: '#2563eb' };

export interface Experience {
  id: string;
  title: string;
  category: 'Cata' | 'DJ Set' | 'Degustación' | 'Celebración';
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

export interface Opportunity {
  id: string;
  title: string;
  type: 'TRAFFIC' | 'EVENT' | 'COMPETITOR' | 'WEATHER';
  score: number;
  description: string;
  potentialRevenue: number;
  aiReasoning: string;
}

export interface MarketingAction { id: string; label: string; }

export interface ServiceIncident {
  id: string;
  tableId: number;
  type: string;
  severity: Severity;
  timeElapsed: number;
  customerLTV: number;
  status: string;
}

export type Severity = 'Baja' | 'Media' | 'Alta' | 'Crítica';

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
  status: string;
}

export interface PurchaseOrder {
  id: string;
  provider: string;
  total: number;
  itemsCount: number;
  status: string;
  aiSuggested: boolean;
}

export interface KitchenOrder {
  id: string;
  tableId: number;
  items: string[];
  station: string;
  startTime: number;
  priority: string;
  status: string;
  ritualSync: string;
}

export interface StationSaturation {
  station: string;
  load: number;
  avgPrepTime: number;
  bottleneckRisk: boolean;
}

export interface FinancialAnomaly {
  id: string;
  title: string;
  severity: string;
  description: string;
  impact: number;
}

export interface CashflowPoint {
  date: string;
  actual: number;
  predicted: number;
}

export interface Transaction {
  id: string;
  timestamp: number;
  type: string;
  amount: number;
  tax: number;
  paymentMethod: string;
  brand: string;
  status: string;
}

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
  status: 'active' | 'break' | 'off';
  shift: string;
}

export interface Reservation {
  id: string;
  customer: string;
  pax: number;
  time: string;
  plan: string;
  type: string;
  status: string;
  noShowProbability: number;
  assignedTable?: number;
  duration: number;
  upsellSuggested?: string;
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
