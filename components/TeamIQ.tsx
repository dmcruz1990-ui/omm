import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  calcularRetiroCompleto, calcularIndemnizacion,
  type TipoContrato, type CausaRetiro,
} from '../lib/nexumLiquidacion';
import {
  Users, TrendingUp, TrendingDown, AlertTriangle, Award,
  Zap, BarChart2, DollarSign, Clock, Star, ChevronDown,
  Search, Filter, ArrowUpRight, ArrowDownRight, Minus,
  Brain, Target, Shield, Flame, Crown, RefreshCw
} from 'lucide-react';

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface Empleado {
  id: number;
  nombre_completo: string;
  rol: string;
  cargo_display: string;
  avatar_iniciales: string;
  salario_base: number;
  memorandos: number;
  vacaciones_dias: number;
  fecha_ingreso: string;
  restaurante?: { nombre: string; emoji: string };
  complejos?: { nombre: string };
  // ── Datos RH / contacto (de la tabla `empleados`; opcionales en demo) ──
  cedula?: string;
  tipo_documento?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  contacto_emergencia?: string;
  tipo_contrato?: string;
  arl?: string;
  eps?: string;
  afp?: string;
  banco?: string;
  cuenta_bancaria?: string;
  // ── Calculados en cargar() para data real ──
  dias_empresa?: number;
  vacaciones_disponibles?: number;
  vacaciones_acumuladas?: number;
  vacaciones_usadas?: number;
  // Calculados / demo
  ventas_mes: number;
  ticket_promedio: number;
  upselling_pct: number;
  score: number;
  score_delta: number;
  propinas_mes: number;
  turno_hoy?: string;
  estado: 'activo' | 'ausente' | 'turno';
  alertas: string[];
}

// ─── DEMO DATA ────────────────────────────────────────────────────────────────
const DEMO_EMPLEADOS: Empleado[] = [
  { id:1,  nombre_completo:'Juan Camilo Rojas',   rol:'mesero',     cargo_display:'Mesero',         avatar_iniciales:'JR', salario_base:1800000, memorandos:1, vacaciones_dias:10, fecha_ingreso:'2023-05-12', ventas_mes:38000000, ticket_promedio:84000,  upselling_pct:18, score:72,  score_delta:+3,  propinas_mes:270000, turno_hoy:'17:00–23:00', estado:'turno',  alertas:['1 memorando activo'],
    cedula:'1.018.452.331', tipo_documento:'CC', email:'jc.rojas@grupoomm.co',   telefono:'+57 311 845 2233', direccion:'Cra 13 #85-32, Chapinero, Bogotá',      contacto_emergencia:'Marta Rojas (madre) · 310 442 7781', tipo_contrato:'indefinido',     arl:'Sura',     eps:'Sanitas',   afp:'Porvenir',    banco:'Bancolombia',  cuenta_bancaria:'24500087712' },
  { id:2,  nombre_completo:'Andrés Felipe Mora',  rol:'mesero',     cargo_display:'Mesero',         avatar_iniciales:'AM', salario_base:1900000, memorandos:0, vacaciones_dias:0,  fecha_ingreso:'2022-11-03', ventas_mes:52000000, ticket_promedio:96000,  upselling_pct:31, score:88,  score_delta:+5,  propinas_mes:320000, turno_hoy:'17:00–23:00', estado:'turno',  alertas:[],
    cedula:'1.030.778.114', tipo_documento:'CC', email:'af.mora@grupoomm.co',    telefono:'+57 320 117 9043', direccion:'Calle 53 #24-18, Galerías, Bogotá',       contacto_emergencia:'Paula Mora (esposa) · 315 908 2210',  tipo_contrato:'indefinido',     arl:'Positiva', eps:'Sura',      afp:'Protección',  banco:'Davivienda',   cuenta_bancaria:'00489912034' },
  { id:3,  nombre_completo:'Sebastián Duarte',    rol:'mesero',     cargo_display:'Mesero',         avatar_iniciales:'SD', salario_base:1750000, memorandos:2, vacaciones_dias:12, fecha_ingreso:'2024-02-10', ventas_mes:24000000, ticket_promedio:61000,  upselling_pct:9,  score:54,  score_delta:-4,  propinas_mes:180000, turno_hoy:undefined,     estado:'ausente', alertas:['2 memorandos','Rendimiento por debajo -28%'],
    cedula:'1.022.901.556', tipo_documento:'CC', email:'s.duarte@grupoomm.co',   telefono:'+57 312 556 8890', direccion:'Cra 7 #45-09, Soledad, Bogotá',           contacto_emergencia:'Luis Duarte (padre) · 318 220 1145',  tipo_contrato:'fijo',           arl:'Sura',     eps:'Compensar', afp:'Colpensiones',banco:'Nequi',        cuenta_bancaria:'3125568890' },
  { id:4,  nombre_completo:'Mateo Herrera',       rol:'mesero',     cargo_display:'Mesero Senior',  avatar_iniciales:'MH', salario_base:2100000, memorandos:0, vacaciones_dias:5,  fecha_ingreso:'2021-07-01', ventas_mes:61000000, ticket_promedio:112000, upselling_pct:42, score:93,  score_delta:+8,  propinas_mes:410000, turno_hoy:'17:00–23:00', estado:'turno',  alertas:[],
    cedula:'1.014.223.870', tipo_documento:'CC', email:'m.herrera@grupoomm.co',  telefono:'+57 301 778 4521', direccion:'Calle 100 #19-54, Chicó, Bogotá',         contacto_emergencia:'Sofía Herrera (hermana) · 304 119 6678',tipo_contrato:'indefinido',   arl:'Colmena',  eps:'Sura',      afp:'Porvenir',    banco:'Bancolombia',  cuenta_bancaria:'24500119087' },
  { id:5,  nombre_completo:'Laura Villalobos',    rol:'maitre',     cargo_display:'Maître',         avatar_iniciales:'LV', salario_base:4500000, memorandos:0, vacaciones_dias:0,  fecha_ingreso:'2020-03-15', ventas_mes:0,         ticket_promedio:0,      upselling_pct:0,  score:91,  score_delta:+2,  propinas_mes:520000, turno_hoy:'17:00–23:00', estado:'turno',  alertas:[],
    cedula:'52.778.190',    tipo_documento:'CC', email:'l.villalobos@grupoomm.co',telefono:'+57 314 220 7765',direccion:'Cra 11 #93-44, El Nogal, Bogotá',         contacto_emergencia:'Carlos Villalobos (esposo) · 312 778 0091',tipo_contrato:'indefinido',arl:'Sura',     eps:'Sanitas',   afp:'Protección',  banco:'BBVA',         cuenta_bancaria:'01900456231' },
  { id:6,  nombre_completo:'Carlos Méndez',       rol:'cocinero',   cargo_display:'Cocinero',       avatar_iniciales:'CM', salario_base:2200000, memorandos:1, vacaciones_dias:8,  fecha_ingreso:'2023-01-20', ventas_mes:0,         ticket_promedio:0,      upselling_pct:0,  score:68,  score_delta:+1,  propinas_mes:130000, turno_hoy:'11:00–18:00', estado:'turno',  alertas:['1 memorando'],
    cedula:'80.451.223',    tipo_documento:'CC', email:'c.mendez@grupoomm.co',   telefono:'+57 313 905 1182', direccion:'Calle 22 Sur #18-30, Restrepo, Bogotá',   contacto_emergencia:'Ana Méndez (esposa) · 311 556 9043',  tipo_contrato:'indefinido',     arl:'Positiva', eps:'Famisanar', afp:'Colfondos',   banco:'Davivienda',   cuenta_bancaria:'00489088771' },
  { id:7,  nombre_completo:'Diego Ramírez',       rol:'cocinero',   cargo_display:'Cocinero',       avatar_iniciales:'DR', salario_base:2300000, memorandos:0, vacaciones_dias:0,  fecha_ingreso:'2022-09-10', ventas_mes:0,         ticket_promedio:0,      upselling_pct:0,  score:82,  score_delta:+4,  propinas_mes:130000, turno_hoy:'11:00–18:00', estado:'turno',  alertas:[],
    cedula:'1.026.334.901', tipo_documento:'CC', email:'d.ramirez@grupoomm.co',  telefono:'+57 318 442 6610', direccion:'Cra 30 #1-50, Quiroga, Bogotá',           contacto_emergencia:'Jorge Ramírez (padre) · 320 118 7745', tipo_contrato:'indefinido',    arl:'Sura',     eps:'Sura',      afp:'Porvenir',    banco:'Bancolombia',  cuenta_bancaria:'24500220114' },
  { id:10, nombre_completo:'Santiago León',       rol:'bartender',  cargo_display:'Bartender',      avatar_iniciales:'SL', salario_base:2800000, memorandos:0, vacaciones_dias:0,  fecha_ingreso:'2022-06-18', ventas_mes:44000000, ticket_promedio:88000,  upselling_pct:28, score:85,  score_delta:+6,  propinas_mes:380000, turno_hoy:'18:00–02:00', estado:'turno',  alertas:[],
    cedula:'1.019.667.402', tipo_documento:'CC', email:'s.leon@grupoomm.co',     telefono:'+57 305 778 3392', direccion:'Calle 70 #5-22, Quinta Camacho, Bogotá',  contacto_emergencia:'Diana León (hermana) · 314 009 5567', tipo_contrato:'indefinido',     arl:'Colmena',  eps:'Compensar', afp:'Protección',  banco:'Nu',           cuenta_bancaria:'3057783392' },
  { id:11, nombre_completo:'Esteban Salazar',     rol:'sommelier',  cargo_display:'Sommelier',      avatar_iniciales:'ES', salario_base:3800000, memorandos:0, vacaciones_dias:7,  fecha_ingreso:'2021-04-22', ventas_mes:58000000, ticket_promedio:118000, upselling_pct:55, score:96,  score_delta:+3,  propinas_mes:460000, turno_hoy:'17:00–23:00', estado:'turno',  alertas:[],
    cedula:'79.554.118',    tipo_documento:'CC', email:'e.salazar@grupoomm.co',  telefono:'+57 310 667 1190', direccion:'Cra 9 #80-15, Zona G, Bogotá',            contacto_emergencia:'Camila Salazar (esposa) · 315 220 8843',tipo_contrato:'indefinido',   arl:'Sura',     eps:'Sanitas',   afp:'Porvenir',    banco:'Bancolombia',  cuenta_bancaria:'24500334876' },
  { id:14, nombre_completo:'Kenji Nakamura',      rol:'cocinero',   cargo_display:'Sushero',        avatar_iniciales:'KN', salario_base:3200000, memorandos:0, vacaciones_dias:0,  fecha_ingreso:'2022-02-28', ventas_mes:0,         ticket_promedio:0,      upselling_pct:0,  score:89,  score_delta:+2,  propinas_mes:150000, turno_hoy:'11:00–18:00', estado:'turno',  alertas:[],
    cedula:'1.233.908.551', tipo_documento:'CE', email:'k.nakamura@grupoomm.co', telefono:'+57 319 005 7781', direccion:'Calle 81 #11-08, El Retiro, Bogotá',      contacto_emergencia:'Yuki Nakamura (esposa) · 318 776 2204', tipo_contrato:'indefinido',    arl:'Positiva', eps:'Sura',      afp:'Protección',  banco:'Davivienda',   cuenta_bancaria:'00489556102' },
  { id:19, nombre_completo:'Alejandro Trinidade', rol:'jefe_cocina',cargo_display:'Chef Ejecutivo', avatar_iniciales:'AT', salario_base:7500000, memorandos:0, vacaciones_dias:15, fecha_ingreso:'2020-02-01', ventas_mes:0,         ticket_promedio:0,      upselling_pct:0,  score:94,  score_delta:+1,  propinas_mes:0,      turno_hoy:'09:00–18:00', estado:'turno',  alertas:[],
    cedula:'70.118.554',    tipo_documento:'CC', email:'a.trinidade@grupoomm.co',telefono:'+57 300 442 1198', direccion:'Cra 15 #88-64, El Chicó, Bogotá',         contacto_emergencia:'Renata Trinidade (esposa) · 311 009 4456',tipo_contrato:'indefinido',  arl:'Sura',     eps:'Sanitas',   afp:'Porvenir',    banco:'BBVA',         cuenta_bancaria:'01900778334' },
];

const PROMEDIO_VENTAS = 44000000;
const PROMEDIO_TICKET = 96000;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
const fmtM = (n: number) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : fmt(n);

const scoreColor = (s: number) =>
  s >= 90 ? '#22D07A' : s >= 75 ? '#4A8FD4' : s >= 60 ? '#FFB347' : '#FF5C5C';

const scoreBadge = (s: number) =>
  s >= 90 ? { label: 'Elite', color: '#22D07A', bg: 'rgba(34,208,122,.12)' }
  : s >= 75 ? { label: 'Destacado', color: '#4A8FD4', bg: 'rgba(74,143,212,.12)' }
  : s >= 60 ? { label: 'Regular', color: '#FFB347', bg: 'rgba(255,179,71,.12)' }
  : { label: 'Atención', color: '#FF5C5C', bg: 'rgba(255,92,53,.12)' };

const areaFromRol = (rol: string) => {
  if (['mesero','maitre','host','sommelier','lider_turno'].includes(rol)) return 'servicio';
  if (['bartender'].includes(rol)) return 'bar';
  if (['cocinero','jefe_cocina','pastelero','sushero'].includes(rol)) return 'cocina';
  return 'admin';
};

// ─── COMPONENTES ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon, delta }: any) {
  return (
    <div style={{
      background: 'linear-gradient(135deg,#111,#0d0d0d)',
      border: '1px solid #1e1e1e',
      borderRadius: 14,
      padding: '16px',
      flex: 1,
      minWidth: 0,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position:'absolute', top:-16, right:-16, width:60, height:60,
        background:`radial-gradient(circle,${color}20 0%,transparent 70%)`,
        borderRadius:'50%', pointerEvents:'none' }} />
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
        <div style={{ width:28, height:28, borderRadius:8, background:`${color}15`,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ fontSize:10, fontWeight:700, color:'#505050',
          textTransform:'uppercase', letterSpacing:'.8px' }}>{label}</span>
      </div>
      <div style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:900,
        color:'#f0f0f0', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#505050', marginTop:4 }}>{sub}</div>}
      {delta !== undefined && (
        <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:6 }}>
          {delta > 0
            ? <ArrowUpRight size={12} color="#22D07A" />
            : delta < 0
              ? <ArrowDownRight size={12} color="#FF5C5C" />
              : <Minus size={12} color="#505050" />
          }
          <span style={{ fontSize:11, fontWeight:700,
            color: delta > 0 ? '#22D07A' : delta < 0 ? '#FF5C5C' : '#505050' }}>
            {delta > 0 ? '+' : ''}{delta}% vs período ant.
          </span>
        </div>
      )}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const c = scoreColor(score);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ flex:1, background:'#1a1a1a', borderRadius:100, height:5, overflow:'hidden' }}>
        <div style={{ width:`${score}%`, height:'100%', background:c,
          borderRadius:100, transition:'width .4s ease' }} />
      </div>
      <span style={{ fontFamily:'Syne,sans-serif', fontSize:13, fontWeight:800,
        color:c, minWidth:28, textAlign:'right' }}>{score}</span>
    </div>
  );
}

function DeltaChip({ delta }: { delta: number }) {
  if (delta === 0) return <span style={{ fontSize:10, color:'#505050' }}>—</span>;
  const up = delta > 0;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:2,
      padding:'2px 7px', borderRadius:20,
      background: up ? 'rgba(34,208,122,.1)' : 'rgba(255,92,53,.1)',
      color: up ? '#22D07A' : '#FF5C5C', fontSize:10, fontWeight:700 }}>
      {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {up ? '+' : ''}{delta}
    </span>
  );
}

// ─── PANEL DETALLE EMPLEADO ───────────────────────────────────────────────────
// Helper para celdas de la Ficha del empleado — uniformes y limpias
function FichaRow({ label, val, mono, full, href, target, icon, colorVal }: {
  label: string; val?: string | number | null;
  mono?: boolean; full?: boolean;
  href?: string; target?: string;
  icon?: string; colorVal?: string;
}) {
  const display = val == null || val === '' ? '—' : String(val);
  const empty = display === '—';
  return (
    <div style={{
      gridColumn: full ? '1 / -1' : undefined,
      background:'#141414', border:'1px solid #1e1e1e', borderRadius:8,
      padding:'8px 10px',
    }}>
      <div style={{ fontSize:9, color:'#505050', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:3 }}>
        {label}
      </div>
      {href && !empty ? (
        <a href={href} target={target} rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          style={{ fontSize:12, fontWeight:700, color: colorVal || '#f0f0f0', textDecoration:'none',
            fontFamily: mono ? 'monospace' : undefined,
            wordBreak: 'break-word' as const, display:'block' }}>
          {icon ? `${icon} ` : ''}{display}
        </a>
      ) : (
        <div style={{ fontSize:12, fontWeight:700, color: empty ? '#404040' : (colorVal || '#f0f0f0'),
          fontFamily: mono ? 'monospace' : undefined,
          wordBreak: 'break-word' as const }}>
          {icon && !empty ? `${icon} ` : ''}{display}
        </div>
      )}
    </div>
  );
}

function PanelEmpleado({ emp, onClose }: { emp: Empleado; onClose: () => void }) {
  const badge = scoreBadge(emp.score);
  const area = areaFromRol(emp.rol);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const vsVentas = emp.ventas_mes > 0
    ? Math.round(((emp.ventas_mes - PROMEDIO_VENTAS) / PROMEDIO_VENTAS) * 100) : null;
  const vsTicket = emp.ticket_promedio > 0
    ? Math.round(((emp.ticket_promedio - PROMEDIO_TICKET) / PROMEDIO_TICKET) * 100) : null;

  // Mensaje IA personalizado
  const genMensaje = () => {
    if (emp.score >= 90) return `${emp.nombre_completo.split(' ')[0]} está en el top del equipo este mes. Score elite — mantener el ritmo.`;
    if (emp.score >= 75) {
      const gap = vsTicket ? Math.abs(vsTicket) : 0;
      return `${emp.nombre_completo.split(' ')[0]} tiene buen desempeño. Su ticket promedio está ${gap}% ${(vsTicket||0) < 0 ? 'por debajo' : 'por encima'} del equipo. ${(vsTicket||0) < 0 ? 'Enfocarse en upselling.' : 'Sigue así.'}`;
    }
    return `${emp.nombre_completo.split(' ')[0]} necesita apoyo. Rendimiento por debajo del estándar. Revisar con líder de turno.`;
  };

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:1000,
      background:'rgba(0,0,0,.7)', display:'flex',
      alignItems:'flex-end', justifyContent:'center',
    }} onClick={onClose}>
      <div style={{
        background:'#0d0d0d', border:'1px solid #1e1e1e',
        borderRadius:'20px 20px 0 0', padding:24, width:'100%',
        maxWidth:540, maxHeight:'85vh', overflowY:'auto',
      }} onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{ width:40, height:4, borderRadius:2, background:'#2a2a2a',
          margin:'0 auto 20px' }} />

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
          <div style={{
            width:52, height:52, borderRadius:14,
            background:`linear-gradient(135deg,${scoreColor(emp.score)}30,${scoreColor(emp.score)}15)`,
            border:`1px solid ${scoreColor(emp.score)}40`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'Syne,sans-serif', fontWeight:900, fontSize:18, color:'#f0f0f0',
          }}>{emp.avatar_iniciales}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontSize:17, fontWeight:800,
              color:'#f0f0f0' }}>{emp.nombre_completo}</div>
            <div style={{ fontSize:12, color:'#606060' }}>
              {emp.cargo_display} · {emp.turno_hoy || 'Sin turno hoy'}
            </div>
          </div>
          <div style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700,
            background:badge.bg, color:badge.color }}>{badge.label}</div>
        </div>

        {/* Mensaje IA */}
        <div style={{
          background:'rgba(155,114,255,.06)', border:'1px solid rgba(155,114,255,.2)',
          borderRadius:12, padding:14, marginBottom:16,
        }}>
          <div style={{ fontSize:10, color:'#9b72ff', fontWeight:700,
            letterSpacing:'1px', textTransform:'uppercase', marginBottom:6 }}>
            ✦ Team IQ™ Intelligence
          </div>
          <div style={{ fontSize:13, color:'#d0d0d0', lineHeight:1.6 }}>{genMensaje()}</div>
        </div>

        {/* Stats grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
          {[
            { label:'Score', val: emp.score + '/100', color: scoreColor(emp.score) },
            { label:'Propinas mes', val: fmt(emp.propinas_mes), color:'#22D07A' },
            emp.ventas_mes > 0
              ? { label:'Ventas mes', val: fmtM(emp.ventas_mes), color:'#d4943a' }
              : { label:'Salario base', val: fmtM(emp.salario_base), color:'#4A8FD4' },
            emp.ticket_promedio > 0
              ? { label:'Ticket prom.', val: fmt(emp.ticket_promedio), color:'#9b72ff' }
              : { label:'Área', val: area.charAt(0).toUpperCase() + area.slice(1), color:'#9b72ff' },
          ].map((s, i) => (
            <div key={i} style={{ background:'#141414', border:'1px solid #1e1e1e',
              borderRadius:10, padding:12 }}>
              <div style={{ fontSize:10, color:'#505050', fontWeight:600,
                textTransform:'uppercase', letterSpacing:'.6px', marginBottom:4 }}>{s.label}</div>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:800,
                color:s.color }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Score bar */}
        <div style={{ background:'#111', border:'1px solid #1e1e1e',
          borderRadius:12, padding:14, marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', marginBottom:10 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#f0f0f0' }}>Score de Desempeño</span>
            <DeltaChip delta={emp.score_delta} />
          </div>
          <ScoreBar score={emp.score} />
          {vsTicket !== null && (
            <div style={{ fontSize:11, color:'#505050', marginTop:8 }}>
              Ticket {vsTicket >= 0 ? '+' : ''}{vsTicket}% vs promedio equipo
            </div>
          )}
        </div>

        {/* Alertas */}
        {emp.alertas.length > 0 && (
          <div style={{ marginBottom:16 }}>
            {emp.alertas.map((a, i) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:8, padding:'10px 12px',
                background:'rgba(255,92,53,.06)', border:'1px solid rgba(255,92,53,.2)',
                borderRadius:10, marginBottom:6,
              }}>
                <AlertTriangle size={14} color="#FF5C5C" />
                <span style={{ fontSize:12, color:'#FF7755' }}>{a}</span>
              </div>
            ))}
          </div>
        )}

        {/* Info personal */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
          {[
            { label:'Memorandos', val: emp.memorandos, warn: emp.memorandos > 0 },
            { label:'Días vacaciones', val: emp.vacaciones_disponibles ?? emp.vacaciones_dias ?? 0 },
            { label:'Antigüedad', val: emp.fecha_ingreso ? Math.floor((Date.now() - new Date(emp.fecha_ingreso).getTime()) / (365.25*86400000)) + ' años' : '—' },
            { label:'Upselling', val: emp.upselling_pct > 0 ? emp.upselling_pct + '%' : 'N/A' },
          ].map((f, i) => (
            <div key={i} style={{ background:'#0a0a0a', border:`1px solid ${f.warn ? 'rgba(255,92,53,.3)' : '#1a1a1a'}`,
              borderRadius:8, padding:'8px 12px', display:'flex',
              justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, color:'#505050' }}>{f.label}</span>
              <span style={{ fontSize:12, fontWeight:700,
                color: f.warn ? '#FF5C5C' : '#f0f0f0' }}>{f.val}</span>
            </div>
          ))}
        </div>

        {/* ═══ FICHA DEL EMPLEADO · todos los datos legales y de contacto ═══ */}
        <div style={{ background:'#0a0a0a', border:'1px solid #1e1e1e', borderRadius:14, padding:16, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, paddingBottom:10, borderBottom:'1px solid #1e1e1e' }}>
            <span style={{ fontSize:16 }}>📇</span>
            <span style={{ fontFamily:'Syne,sans-serif', fontSize:13, fontWeight:900, color:'#f0f0f0', letterSpacing:'.04em' }}>
              FICHA DEL EMPLEADO
            </span>
            <span style={{ fontSize:9, color:'#505050', marginLeft:'auto', letterSpacing:'.1em', textTransform:'uppercase' }}>
              datos para RH y liquidación
            </span>
          </div>

          {/* Identificación */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:9, color:'#d4943a', fontWeight:800, textTransform:'uppercase', letterSpacing:'.12em', marginBottom:6 }}>
              🆔 Identificación
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              <FichaRow label="Cédula" val={emp.cedula} mono />
              <FichaRow label="Avatar / iniciales" val={emp.avatar_iniciales} />
            </div>
          </div>

          {/* Contacto */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:9, color:'#4a8fd4', fontWeight:800, textTransform:'uppercase', letterSpacing:'.12em', marginBottom:6 }}>
              📞 Contacto
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              <FichaRow label="Email" val={emp.email}
                href={emp.email ? `mailto:${emp.email}` : undefined} icon="✉" colorVal="#4a8fd4"/>
              <FichaRow label="Teléfono" val={emp.telefono}
                href={emp.telefono ? `https://wa.me/${String(emp.telefono).replace(/\D/g,'')}` : undefined}
                target="_blank" icon="💬" colorVal="#22D07A"/>
              <FichaRow label="Dirección" val={emp.direccion} icon="📍" full/>
              <FichaRow label="Contacto emergencia" val={emp.contacto_emergencia} icon="🆘" colorVal="#FF5C53" full/>
            </div>
          </div>

          {/* Laboral */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:9, color:'#b388ff', fontWeight:800, textTransform:'uppercase', letterSpacing:'.12em', marginBottom:6 }}>
              💼 Laboral
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              <FichaRow label="Cargo" val={emp.cargo_display} />
              <FichaRow label="Rol sistema" val={emp.rol} />
              <FichaRow label="Tipo contrato" val={emp.tipo_contrato} colorVal="#b388ff"/>
              <FichaRow label="Fecha ingreso" val={emp.fecha_ingreso ? new Date(emp.fecha_ingreso+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : null} />
              <FichaRow label="Salario base" val={emp.salario_base ? `$${Number(emp.salario_base).toLocaleString('es-CO')}` : null} colorVal="#d4943a"/>
              <FichaRow label="Valor hora" val={emp.salario_base ? `$${Math.round(emp.salario_base/168).toLocaleString('es-CO')}` : null} />
            </div>
          </div>

          {/* Seguridad social */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:9, color:'#22D07A', fontWeight:800, textTransform:'uppercase', letterSpacing:'.12em', marginBottom:6 }}>
              🛡 Seguridad social
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
              <FichaRow label="ARL" val={emp.arl} />
              <FichaRow label="EPS" val={emp.eps} />
              <FichaRow label="AFP" val={emp.afp} />
            </div>
          </div>

          {/* Cuenta bancaria */}
          <div>
            <div style={{ fontSize:9, color:'#FFB547', fontWeight:800, textTransform:'uppercase', letterSpacing:'.12em', marginBottom:6 }}>
              🏦 Cuenta bancaria · para nómina
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              <FichaRow label="Banco" val={emp.banco} colorVal="#FFB547"/>
              <FichaRow label="N° cuenta" val={emp.cuenta_bancaria} mono />
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>setFeedbackOpen(true)} style={{
            flex:1, padding:13, borderRadius:10,
            background:'rgba(212,148,58,.1)', border:'1px solid rgba(212,148,58,.3)',
            color:'#d4943a', fontSize:13, fontWeight:700, cursor:'pointer',
          }}>📩 Enviar feedback</button>
          <button onClick={()=>setPlanOpen(true)} style={{
            flex:1, padding:13, borderRadius:10,
            background:'rgba(34,208,122,.1)', border:'1px solid rgba(34,208,122,.3)',
            color:'#22D07A', fontSize:13, fontWeight:700, cursor:'pointer',
          }}>🎯 Ver plan desarrollo</button>
        </div>

        {feedbackOpen && <FeedbackModal emp={emp} onClose={()=>setFeedbackOpen(false)}/>}
        {planOpen && <PlanDesarrolloModal emp={emp} onClose={()=>setPlanOpen(false)}/>}

      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function TeamIQ() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading]     = useState(true);
  const [area, setArea]           = useState<'todos'|'servicio'|'bar'|'cocina'|'admin'>('todos');
  const [periodo, setPeriodo]     = useState<'hoy'|'semana'|'mes'|'3meses'>('mes');
  const [search, setSearch]       = useState('');
  const [empSel, setEmpSel]       = useState<Empleado | null>(null);
  const [activeTab, setActiveTab] = useState<'equipo'|'performance'|'alertas'|'oldschool'|'academia'>('equipo');
  const [historial, setHistorial] = useState<any[]>([]); // empleados retirados (old school)
  const [areaCargo, setAreaCargo] = useState<string>('todos'); // filtro adicional por cargo
  const [showNuevoEmp, setShowNuevoEmp] = useState(false);
  const [showDespedir, setShowDespedir] = useState(false);
  const [ventasMes, setVentasMes] = useState(0); // venta total del mes del restaurante

  // Cargar empleados desde Supabase con métricas REALES
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Empleados activos
      const { data: empData } = await supabase
        .from('empleados')
        .select('*, restaurantes(nombre,emoji), complejos(nombre)')
        .eq('activo', true)
        .order('nombre_completo');

      // 2. Asistencia últimos 30 días → retardos, incapacidades, puntualidad
      const hace30 = new Date(Date.now() - 30*86400000).toISOString().split('T')[0];
      const { data: asistData } = await supabase.from('attendance')
        .select('staff_id,empleado_nombre,minutos_tarde,estado,fecha')
        .gte('fecha', hace30);

      // 3. Novedades (incapacidades, memorandos)
      const { data: novData } = await supabase.from('workforce_novedades')
        .select('empleado_id,tipo,estado,fecha_inicio')
        .gte('fecha_inicio', hace30);

      // 4. Ventas por mesero del mes (cobros_trazabilidad)
      const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0);
      const { data: cobrosData } = await supabase.from('cobros_trazabilidad')
        .select('total,mesero')
        .gte('created_at', inicioMes.toISOString());

      // Calcular ventas totales del restaurante (para KPI top)
      const ventaTotalMes = (cobrosData||[]).reduce((s:number,c:any)=>s+(Number(c.total)||0), 0);
      setVentasMes(ventaTotalMes);

      // Indexar asistencia por nombre/id
      const retardosPorEmp: Record<string, number> = {};
      const noShowsPorEmp: Record<string, number> = {};
      const totalAsistPorEmp: Record<string, number> = {};
      (asistData||[]).forEach((a:any) => {
        const key = a.staff_id || a.empleado_nombre;
        if (!key) return;
        totalAsistPorEmp[key] = (totalAsistPorEmp[key]||0) + 1;
        if (a.estado === 'tarde') retardosPorEmp[key] = (retardosPorEmp[key]||0) + 1;
        if (a.estado === 'no_show') noShowsPorEmp[key] = (noShowsPorEmp[key]||0) + 1;
      });

      const incapacidadesPorEmp: Record<number, number> = {};
      const memorandosPorEmp: Record<number, number> = {};
      (novData||[]).forEach((n:any) => {
        if (n.tipo === 'incapacidad') incapacidadesPorEmp[n.empleado_id] = (incapacidadesPorEmp[n.empleado_id]||0) + 1;
        if (n.tipo === 'memorando') memorandosPorEmp[n.empleado_id] = (memorandosPorEmp[n.empleado_id]||0) + 1;
      });

      const ventasPorMesero: Record<string, { ventas:number; tickets:number }> = {};
      (cobrosData||[]).forEach((c:any) => {
        if (!c.mesero) return;
        if (!ventasPorMesero[c.mesero]) ventasPorMesero[c.mesero] = { ventas:0, tickets:0 };
        ventasPorMesero[c.mesero].ventas += Number(c.total)||0;
        ventasPorMesero[c.mesero].tickets++;
      });

      // Combinar
      const enriquecidos = (empData||[]).map((e:any) => {
        const keyAsist = e.staff_nexum_id || e.nombre_completo;
        const retardos = retardosPorEmp[keyAsist] || 0;
        const noShows = noShowsPorEmp[keyAsist] || 0;
        const totalDiasAsist = totalAsistPorEmp[keyAsist] || 0;
        const puntualidad = totalDiasAsist > 0 ? Math.round(((totalDiasAsist - retardos - noShows) / totalDiasAsist) * 100) : 100;
        const incap = incapacidadesPorEmp[e.id] || 0;
        const memos = memorandosPorEmp[e.id] || e.memorandos || 0;
        const ventasMesero = ventasPorMesero[e.nombre_completo] || { ventas:0, tickets:0 };
        const ticketProm = ventasMesero.tickets > 0 ? ventasMesero.ventas / ventasMesero.tickets : 0;
        // Score: combina puntualidad (40%) + sin memorandos (30%) + ticket prom (30%)
        const scoreCalc = Math.round(
          puntualidad * 0.4 +
          (memos === 0 ? 100 : Math.max(0, 100 - memos*20)) * 0.3 +
          (ticketProm > 100000 ? 100 : ticketProm/1000) * 0.3
        );
        // Vacaciones acumuladas: 15 días por año (Colombia: 15 hábiles)
        const diasDesdeIngreso = e.fecha_ingreso ? Math.floor((Date.now() - new Date(e.fecha_ingreso).getTime())/86400000) : 0;
        const anios = diasDesdeIngreso / 365;
        const vacacionesAcumuladas = Math.floor(anios * 15);
        const vacacionesUsadas = e.vacaciones_dias || 0;
        const vacacionesDisponibles = Math.max(0, vacacionesAcumuladas - vacacionesUsadas);
        // Días totales en empresa
        return {
          ...e,
          retardos, noShows, puntualidad,
          incapacidades: incap,
          memorandos: memos,
          ventas_mes: ventasMesero.ventas,
          ticket_promedio: ticketProm,
          tickets_mes: ventasMesero.tickets,
          score: Math.max(0, Math.min(100, scoreCalc)),
          score_delta: 0,
          dias_empresa: diasDesdeIngreso,
          vacaciones_acumuladas: vacacionesAcumuladas,
          vacaciones_disponibles: vacacionesDisponibles,
          vacaciones_usadas: vacacionesUsadas,
          alertas: [
            ...(memos > 0 ? [`${memos} memorando${memos>1?'s':''}`] : []),
            ...(incap > 0 ? [`${incap} incapacidad${incap>1?'es':''}`] : []),
            ...(puntualidad < 80 ? [`Puntualidad ${puntualidad}% < 80%`] : []),
          ],
          // legacy fields for compat
          upselling_pct: 0,
          propinas_mes: 0,
          turno_hoy: undefined,
          estado: 'turno' as const,
        };
      });
      setEmpleados(enriquecidos.length > 0 ? enriquecidos : DEMO_EMPLEADOS);
    } catch {
      setEmpleados(DEMO_EMPLEADOS);
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Cargar histórico de empleados retirados (Old School).
  // Bandera alive evita que una respuesta tardía pise un setHistorial reciente
  // si el efecto re-corre (p. ej. cuando se despide otro empleado).
  useEffect(() => {
    let alive = true;
    supabase.from('empleados_historial')
      .select('*, liquidaciones:liquidaciones(*)')
      .order('fecha_retiro', { ascending: false })
      .then(({ data }) => { if (alive) setHistorial(data || []); });
    return () => { alive = false; };
  }, [empleados.length]);

  // Filtrar
  const filtered = empleados.filter(e => {
    const matchArea = area === 'todos' || areaFromRol(e.rol) === area;
    const q = search.toLowerCase();
    const matchSearch = !search ||
      String(e.nombre_completo||'').toLowerCase().includes(q) ||
      String(e.cargo_display||'').toLowerCase().includes(q);
    return matchArea && matchSearch;
  });

  // KPIs
  const totalVentas   = empleados.reduce((s, e) => s + e.ventas_mes, 0);
  const avgScore      = Math.round(empleados.reduce((s, e) => s + e.score, 0) / (empleados.length || 1));
  const totalPropinas = empleados.reduce((s, e) => s + e.propinas_mes, 0);
  const alertasCnt    = empleados.filter(e => e.alertas.length > 0 || (e.score||0) < 70).length;
  const enTurno       = empleados.filter(e => e.estado === 'turno').length;
  const ranking       = [...empleados].sort((a,b) => b.score - a.score);

  const periodoLabel = { hoy:'Hoy', semana:'Esta semana', mes:'Este mes', '3meses':'Últimos 3 meses' };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: '#080808', color: '#f0f0f0',
      fontFamily: 'DM Sans, system-ui, sans-serif',
    }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg,#0d0d0d,#080808)',
        borderBottom: '1px solid #141414', padding: '20px 20px 16px',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{
                width:32, height:32, borderRadius:8,
                background:'linear-gradient(135deg,#9b72ff,#d4943a)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Brain size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontFamily:'Syne,sans-serif', fontSize:18, fontWeight:900,
                  letterSpacing:'-0.3px', lineHeight:1 }}>
                  Team IQ™
                </div>
                <div style={{ fontSize:10, color:'#505050', letterSpacing:'1.5px',
                  textTransform:'uppercase' }}>Human Performance Intelligence · Nexum</div>
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button onClick={()=>setShowNuevoEmp(true)} style={{
              padding:'8px 14px', borderRadius:10, border:'none', cursor:'pointer',
              fontSize:12, fontWeight:800, color:'#fff',
              background:'linear-gradient(135deg,#22D07A,#1A9E5C)',
              boxShadow:'0 6px 14px rgba(34,208,122,0.25)',
              display:'flex',alignItems:'center',gap:6,
            }}>+ Nuevo empleado</button>
            <button onClick={()=>setShowDespedir(true)} style={{
              padding:'8px 14px', borderRadius:10, cursor:'pointer',
              fontSize:12, fontWeight:800, color:'#FF5C53',
              background:'rgba(255,92,83,0.10)', border:'1px solid rgba(255,92,83,0.4)',
              display:'flex',alignItems:'center',gap:6,
            }}>👋 Despedir</button>
            <button onClick={cargar} style={{
              width:34, height:34, borderRadius:8, border:'1px solid #1e1e1e',
              background:'transparent', color:'#606060', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Filtro período */}
        <div style={{ display:'flex', gap:6, marginBottom:12, overflowX:'auto', scrollbarWidth:'none' }}>
          {(['hoy','semana','mes','3meses'] as const).map(p => (
            <button key={p} onClick={() => setPeriodo(p)} style={{
              padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer',
              fontWeight:600, fontSize:12, whiteSpace:'nowrap', flexShrink:0,
              background: periodo === p ? '#d4943a' : '#141414',
              color: periodo === p ? '#000' : '#606060',
              transition:'all .15s',
            }}>{periodoLabel[p]}</button>
          ))}
        </div>

        {/* Búsqueda */}
        <div style={{ position:'relative' }}>
          <Search size={14} color="#404040" style={{ position:'absolute', left:12, top:'50%',
            transform:'translateY(-50%)', pointerEvents:'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o cargo..."
            style={{
              width:'100%', background:'#111', border:'1px solid #1e1e1e',
              borderRadius:10, padding:'10px 12px 10px 34px', color:'#f0f0f0',
              fontSize:13, outline:'none', boxSizing:'border-box',
            }}
          />
        </div>
      </div>

      <div style={{ padding:'16px 16px 80px' }}>

        {/* KPI cards · suma base − ventas, score, turnos, retardos, incap, ticket prom */}
        {(() => {
          const sumaBase = empleados.reduce((s:number,e:any)=>s+(Number(e.salario_base)||0), 0);
          const margenBase = ventasMes - sumaBase;
          const totalIncap = empleados.reduce((s:number,e:any)=>s+(e.incapacidades||0), 0);
          const totalRetardos = empleados.reduce((s:number,e:any)=>s+(e.retardos||0), 0);
          const promPuntualidad = empleados.length > 0 ? Math.round(empleados.reduce((s:number,e:any)=>s+(e.puntualidad||0), 0)/empleados.length) : 0;
          const meserosConVenta = empleados.filter((e:any)=>e.tickets_mes > 0);
          const promTicket = meserosConVenta.length > 0 ? meserosConVenta.reduce((s:number,e:any)=>s+e.ticket_promedio, 0)/meserosConVenta.length : 0;
          // Rotación: empleados con menos de 90 días / total (proxy básico)
          const nuevos90 = empleados.filter((e:any)=>e.dias_empresa < 90).length;
          const rotacion = empleados.length > 0 ? Math.round((nuevos90/empleados.length)*100) : 0;
          return (
            <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto', scrollbarWidth:'none' }}>
              <KpiCard label="Margen vs nómina" value={fmtM(margenBase)} sub={`Venta ${fmtM(ventasMes)} − base ${fmtM(sumaBase)}`} color={margenBase>0?'#22D07A':'#FF5C53'} icon={DollarSign} delta={margenBase>0?0:-1} />
              <KpiCard label="Score equipo" value={empleados.length>0?Math.round(empleados.reduce((s:number,e:any)=>s+(e.score||0),0)/empleados.length):0} sub="promedio general" color="#9b72ff" icon={Brain} />
              <KpiCard label="En turno hoy" value={`${empleados.filter((e:any)=>e.estado==='turno').length}/${empleados.length}`} sub="colaboradores" color="#4A8FD4" icon={Users} />
              <KpiCard label="Retardos 30d" value={totalRetardos} sub={`Puntualidad ${promPuntualidad}%`} color={totalRetardos>5?'#FF5C53':'#22D07A'} icon={Clock} />
              <KpiCard label="Incapacidades" value={totalIncap} sub="último mes" color="#FFB547" icon={AlertTriangle} />
              <KpiCard label="Rotación 90d" value={`${rotacion}%`} sub={`${nuevos90} nuevos`} color={rotacion>30?'#FF5C53':'#9b72ff'} icon={TrendingUp} />
              <KpiCard label="Ticket prom mesero" value={fmtM(promTicket)} sub="ponderado" color="#d4943a" icon={Star} />
            </div>
          );
        })()}

        {/* Alerta estructura si hay ausentes */}
        {alertasCnt > 0 && (
          <div style={{
            background:'rgba(255,92,53,.06)', border:'1px solid rgba(255,92,53,.25)',
            borderRadius:12, padding:'12px 14px', marginBottom:14,
            display:'flex', alignItems:'center', gap:10,
          }}>
            <AlertTriangle size={16} color="#FF5C53" />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#FF7755' }}>
                {alertasCnt} colaborador{alertasCnt>1?'es':''} requieren atención
              </div>
              <div style={{ fontSize:11, color:'#606060' }}>
                Memorandos activos o rendimiento por debajo del estándar
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display:'flex', gap:4, marginBottom:14,
          background:'#0d0d0d', border:'1px solid #141414',
          borderRadius:12, padding:4,
        }}>
          {([
            { id:'equipo',      icon:Users,    label:'Equipo' },
            { id:'performance', icon:Crown,    label:'Performance' },
            { id:'academia',    icon:Brain,    label:'Academia' },
            { id:'alertas',     icon:Shield,   label:`Alertas${alertasCnt>0?' ·'+alertasCnt:''}` },
            { id:'oldschool',   icon:Award,    label:`Old School${historial.length>0?' ·'+historial.length:''}` },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)} style={{
              flex:1, display:'flex', alignItems:'center', justifyContent:'center',
              gap:4, padding:'8px 4px', borderRadius:9, border:'none', cursor:'pointer',
              fontSize:11, fontWeight:700, transition:'all .15s',
              background: activeTab === t.id ? '#1a1a1a' : 'transparent',
              color: activeTab === t.id ? '#f0f0f0' : '#505050',
            }}>
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: EQUIPO ── */}
        {activeTab === 'equipo' && (
          <>
            {/* Toolbar · filtros + búsqueda + export Excel */}
            <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
              <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none' }}>
                {([
                  { id:'todos', label:'Todos' },
                  { id:'servicio', label:'🍽️ Servicio' },
                  { id:'bar', label:'🍸 Bar' },
                  { id:'cocina', label:'👨‍🍳 Cocina' },
                  { id:'admin', label:'📋 Admin' },
                ] as const).map(a => (
                  <button key={a.id} onClick={() => setArea(a.id)} style={{
                    padding:'6px 14px', borderRadius:20, cursor:'pointer',
                    fontSize:12, fontWeight:600, whiteSpace:'nowrap', flexShrink:0,
                    border: area === a.id ? '1px solid #d4943a' : '1px solid #1e1e1e',
                    background: area === a.id ? 'rgba(212,148,58,.1)' : 'transparent',
                    color: area === a.id ? '#d4943a' : '#606060',
                  }}>{a.label}</button>
                ))}
              </div>
              <div style={{ position:'relative', flex:'1 1 200px', maxWidth:280 }}>
                <Search size={14} color="#404040" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nombre, cargo, CC, email…"
                  style={{ width:'100%', background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:10, padding:'9px 12px 9px 34px', color:'#f0f0f0', fontSize:12, outline:'none', boxSizing:'border-box' }}/>
              </div>
              <button onClick={() => {
                  // Export Excel-compatible CSV con TODA la info
                  const cols = ['Nombre','Cargo','Rol','CC','Email','Teléfono','Contrato','Banco','Cuenta','Salario base','Fecha ingreso','Días empresa','ARL','EPS','AFP','Dirección','Contacto emergencia','Vacaciones disponibles','Score','Memorandos'];
                  const rows = filtered.map((e:any) => [
                    e.nombre_completo||'', e.cargo_display||'', e.rol||'',
                    e.cedula||'', e.email||'', e.telefono||'',
                    e.tipo_contrato||'', e.banco||'', e.cuenta_bancaria||'',
                    e.salario_base||0,
                    e.fecha_ingreso||'', e.dias_empresa||0,
                    e.arl||'', e.eps||'', e.afp||'',
                    (e.direccion||'').replace(/[,;]/g,' '),
                    (e.contacto_emergencia||'').replace(/[,;]/g,' '),
                    e.vacaciones_disponibles||0,
                    e.score||0, e.memorandos||0,
                  ]);
                  const csv = '﻿' + [cols.join(';'), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';'))].join('\n');
                  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `empleados_OMM_${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ marginLeft:'auto', padding:'8px 14px', borderRadius:10, border:'1px solid #22D07A55', background:'rgba(34,208,122,0.10)', color:'#22D07A', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6 }}>
                📊 Exportar Excel
              </button>
              <div style={{ fontSize:11, color:'#606060', fontWeight:700, whiteSpace:'nowrap' }}>
                {filtered.length} empleado{filtered.length===1?'':'s'}
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign:'center', padding:40, color:'#404040' }}>Cargando equipo...</div>
            ) : (
              // ── TABLA PRO ESTILO EXCEL — todos los campos de empleados ──
              <div style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:12, overflow:'hidden' }}>
                <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:'70vh', scrollbarColor:'#2a2a2a #0a0a0a' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:1400 }}>
                    <thead>
                      <tr style={{ background:'#141414', position:'sticky', top:0, zIndex:5 }}>
                        {[
                          { l:'Empleado',     w:200, sticky:true },
                          { l:'Cargo',        w:140 },
                          { l:'CC',           w:110 },
                          { l:'Email',        w:200 },
                          { l:'📱 Teléfono',  w:130 },
                          { l:'Contrato',     w:120 },
                          { l:'🏦 Cuenta',    w:160 },
                          { l:'💰 Salario',   w:110 },
                          { l:'Ingresó',      w:110 },
                          { l:'Antigüedad',   w:100 },
                          { l:'ARL · EPS · AFP', w:180 },
                          { l:'📍 Dirección', w:200 },
                          { l:'🆘 Emergencia', w:170 },
                          { l:'🏖 Vac.',      w:80  },
                          { l:'Score',        w:80  },
                          { l:'⚠',            w:60  },
                        ].map(h => (
                          <th key={h.l} style={{
                            padding:'10px 12px', textAlign:'left', fontSize:10, color:'#606060',
                            fontWeight:800, textTransform:'uppercase', letterSpacing:'.08em',
                            borderBottom:'1px solid #2a2a2a', whiteSpace:'nowrap',
                            minWidth:h.w,
                            position: h.sticky ? 'sticky' as const : undefined,
                            left: h.sticky ? 0 : undefined,
                            background: h.sticky ? '#141414' : undefined,
                            zIndex: h.sticky ? 6 : undefined,
                          }}>{h.l}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((emp, i) => {
                        const c = scoreColor(emp.score);
                        const cuentaMasked = emp.cuenta_bancaria ? `••${String(emp.cuenta_bancaria).slice(-4)}` : '—';
                        const antiguedad = emp.dias_empresa
                          ? (emp.dias_empresa >= 365 ? `${Math.floor(emp.dias_empresa/365)}a ${Math.floor((emp.dias_empresa%365)/30)}m` : `${Math.floor(emp.dias_empresa/30)}m ${emp.dias_empresa%30}d`)
                          : '—';
                        const bg = i % 2 === 0 ? '#0d0d0d' : '#0f0f10';
                        return (
                          <tr key={emp.id}
                            onClick={() => setEmpSel(emp)}
                            style={{ background:bg, borderBottom:'1px solid rgba(255,255,255,0.02)', cursor:'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,148,58,0.05)')}
                            onMouseLeave={e => (e.currentTarget.style.background = bg)}>
                            {/* Empleado · sticky */}
                            <td style={{ padding:'10px 12px', position:'sticky', left:0, background:bg, borderRight:'1px solid #1a1a1a' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{
                                  width:32, height:32, borderRadius:9, flexShrink:0,
                                  background:`linear-gradient(135deg,${c}25,${c}10)`,
                                  border:`1px solid ${c}30`,
                                  display:'flex', alignItems:'center', justifyContent:'center',
                                  fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:11, color:'#f0f0f0',
                                }}>{emp.avatar_iniciales || (emp.nombre_completo||'').split(' ').map((x:string)=>x[0]).slice(0,2).join('').toUpperCase()}</div>
                                <div style={{ minWidth:0 }}>
                                  <div style={{ fontWeight:700, color:'#f0f0f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.nombre_completo}</div>
                                  <div style={{ fontSize:10, color:emp.activo?'#22D07A':'#FF5C53' }}>{emp.activo ? '● activo' : '○ inactivo'}</div>
                                </div>
                              </div>
                            </td>
                            {/* Cargo */}
                            <td style={{ padding:'10px 12px', color:'#a0a0a0' }}>
                              <div>{emp.cargo_display || '—'}</div>
                              <div style={{ fontSize:9, color:'#505050', textTransform:'capitalize' }}>{emp.rol || ''}</div>
                            </td>
                            {/* CC */}
                            <td style={{ padding:'10px 12px', color:emp.cedula?'#f0f0f0':'#505050', fontFamily:'monospace', fontSize:11 }}>
                              {emp.cedula || '—'}
                            </td>
                            {/* Email */}
                            <td style={{ padding:'10px 12px', color:emp.email?'#4a8fd4':'#505050', fontSize:11 }}>
                              {emp.email ? (
                                <a href={`mailto:${emp.email}`} onClick={ev=>ev.stopPropagation()} style={{ color:'inherit', textDecoration:'none' }}>
                                  ✉ {emp.email}
                                </a>
                              ) : '—'}
                            </td>
                            {/* Teléfono */}
                            <td style={{ padding:'10px 12px', color:emp.telefono?'#22D07A':'#505050' }}>
                              {emp.telefono ? (
                                <a href={`https://wa.me/${String(emp.telefono).replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" onClick={ev=>ev.stopPropagation()} style={{ color:'inherit', textDecoration:'none' }}>
                                  💬 {emp.telefono}
                                </a>
                              ) : '—'}
                            </td>
                            {/* Contrato */}
                            <td style={{ padding:'10px 12px' }}>
                              {emp.tipo_contrato ? (
                                <span style={{ fontSize:10, padding:'3px 9px', borderRadius:50, fontWeight:700,
                                  background:'rgba(155,114,255,0.12)', color:'#b388ff', border:'1px solid rgba(155,114,255,0.3)', textTransform:'capitalize' }}>
                                  {emp.tipo_contrato.replace(/_/g,' ')}
                                </span>
                              ) : <span style={{ color:'#505050' }}>—</span>}
                            </td>
                            {/* Cuenta · enmascarada por seguridad */}
                            <td style={{ padding:'10px 12px', fontSize:11 }}>
                              <div style={{ color:emp.banco?'#f0f0f0':'#505050', fontWeight:700 }}>{emp.banco || '—'}</div>
                              <div style={{ color:'#606060', fontFamily:'monospace' }}>{cuentaMasked}</div>
                            </td>
                            {/* Salario */}
                            <td style={{ padding:'10px 12px', textAlign:'right' as const, color:'#d4943a', fontWeight:700, fontFamily:'Syne,sans-serif' }}>
                              {emp.salario_base ? `$${Number(emp.salario_base).toLocaleString('es-CO')}` : '—'}
                            </td>
                            {/* Fecha ingreso */}
                            <td style={{ padding:'10px 12px', color:'#a0a0a0', fontSize:11 }}>
                              {emp.fecha_ingreso ? new Date(emp.fecha_ingreso+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
                            </td>
                            {/* Antigüedad */}
                            <td style={{ padding:'10px 12px', color:'#22D07A', fontWeight:700, fontSize:11 }}>{antiguedad}</td>
                            {/* ARL · EPS · AFP */}
                            <td style={{ padding:'10px 12px', fontSize:10, color:'#a0a0a0' }}>
                              <div>🛡 {emp.arl || '—'}</div>
                              <div>+ {emp.eps || '—'}</div>
                              <div>💼 {emp.afp || '—'}</div>
                            </td>
                            {/* Dirección */}
                            <td style={{ padding:'10px 12px', color:'#a0a0a0', fontSize:11, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                              title={emp.direccion||''}>
                              {emp.direccion || '—'}
                            </td>
                            {/* Contacto emergencia */}
                            <td style={{ padding:'10px 12px', color:'#FF5C53', fontSize:11, maxWidth:170, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                              title={emp.contacto_emergencia||''}>
                              {emp.contacto_emergencia || '—'}
                            </td>
                            {/* Vacaciones */}
                            <td style={{ padding:'10px 12px', textAlign:'center' as const }}>
                              <div style={{ fontFamily:'Syne,sans-serif', fontSize:14, fontWeight:900, color:'#22d3ee' }}>{emp.vacaciones_disponibles ?? 0}</div>
                              <div style={{ fontSize:9, color:'#505050' }}>días</div>
                            </td>
                            {/* Score */}
                            <td style={{ padding:'10px 12px', textAlign:'center' as const }}>
                              <div style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:900, color:c }}>{emp.score}</div>
                            </td>
                            {/* Alertas */}
                            <td style={{ padding:'10px 12px', textAlign:'center' as const }}>
                              {emp.alertas?.length > 0 ? (
                                <span title={emp.alertas.join(' · ')}>
                                  <AlertTriangle size={14} color="#FF5C5C" />
                                </span>
                              ) : <span style={{ color:'#22D07A' }}>✓</span>}
                            </td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={16} style={{ textAlign:'center', padding:32, color:'#404040', fontSize:13 }}>
                            No hay resultados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── TAB: PERFORMANCE — equipo actual con regla de 8 ── */}
        {activeTab === 'performance' && (
          <div>
            {/* Filtro área/cargo + búsqueda — antes del ranking */}
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
              <div style={{position:'relative',flex:'1 1 220px'}}>
                <Search size={14} color="#404040" style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar empleado…"
                  style={{width:'100%',background:'#0d0d0d',border:'1px solid #1e1e1e',borderRadius:10,padding:'9px 12px 9px 34px',color:'#f0f0f0',fontSize:12,outline:'none',boxSizing:'border-box'}}/>
              </div>
              <select value={areaCargo} onChange={e=>setAreaCargo(e.target.value)}
                style={{background:'#0d0d0d',border:'1px solid #1e1e1e',borderRadius:10,padding:'9px 12px',color:'#f0f0f0',fontSize:12,outline:'none',colorScheme:'dark'}}>
                <option value="todos">Todos los cargos</option>
                {Array.from(new Set(empleados.map((e:any)=>e.cargo_display||e.rol).filter(Boolean))).map(c=>(<option key={String(c)} value={String(c)}>{String(c)}</option>))}
              </select>
            </div>
            <div style={{fontSize:11,color:'#505050',marginBottom:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em'}}>
              📊 Regla de 8 · score = 8 dimensiones ponderadas
            </div>
            {ranking.filter((e:any)=>areaCargo==='todos' || (e.cargo_display||e.rol)===areaCargo)
              .filter((e:any)=>!search || e.nombre_completo.toLowerCase().includes(search.toLowerCase()))
              .map((emp, i) => {
                const medals = ['🥇','🥈','🥉'];
                const medal = medals[i] || `#${i+1}`;
                const c = scoreColor(emp.score);
                // Regla de 8: cada dimensión 12.5%
                const dim = {
                  puntualidad: emp.puntualidad || 90,
                  retos:       Math.min(100, (emp.puntualidad || 90) - 5), // proxy
                  care:        Math.min(100, emp.score + 5),                // proxy
                  ventas:      emp.ticket_promedio > 80000 ? 95 : Math.round((emp.ticket_promedio||0)/1000),
                  upselling:   emp.upselling_pct || 0,
                  asistencia:  Math.max(0, 100 - (emp.noShows||0)*15),
                  memorandos:  emp.memorandos===0?100:Math.max(0,100-emp.memorandos*25),
                  academia:    emp.cursos_completados ? Math.min(100,emp.cursos_completados*15) : 50,
                };
                return (
                  <div key={emp.id} onClick={() => setEmpSel(emp)} style={{
                    display:'flex', flexDirection:'column', gap:8,
                    background: i < 3 ? `${c}08` : '#0d0d0d',
                    border: `1px solid ${i < 3 ? c+'25' : '#141414'}`,
                    borderRadius:12, padding:'12px 14px', marginBottom:10, cursor:'pointer',
                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <span style={{ fontSize:20, width:28, textAlign:'center', flexShrink:0 }}>{medal}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.nombre_completo}</div>
                        <div style={{ fontSize:11, color:'#505050' }}>{emp.cargo_display}</div>
                      </div>
                      <div style={{ flexShrink:0, textAlign:'right' }}>
                        <div style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:900, color:c, lineHeight:1 }}>{emp.score}</div>
                        <div style={{fontSize:9,color:'#505050',marginTop:1}}>de 100</div>
                      </div>
                    </div>
                    {/* Mini-barras de las 8 dimensiones */}
                    <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:3}}>
                      {(['puntualidad','retos','care','ventas','upselling','asistencia','memorandos','academia'] as const).map(k=>{
                        const v = Math.round((dim as any)[k]);
                        const col = v>=80?'#22D07A':v>=60?'#FFB547':'#FF5C53';
                        return (
                          <div key={k} title={`${k}: ${v}%`} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                            <div style={{height:14,width:'100%',background:'#141414',borderRadius:3,overflow:'hidden',position:'relative'}}>
                              <div style={{position:'absolute',bottom:0,left:0,right:0,height:`${v}%`,background:col}}/>
                            </div>
                            <span style={{fontSize:7,color:'#606060',textTransform:'capitalize'}}>{k.slice(0,4)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* ── TAB: ACADEMIA — cursos y plan de desarrollo del equipo ── */}
        {activeTab === 'academia' && (
          <div>
            <div style={{fontSize:11,color:'#9b72ff',fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',marginBottom:12}}>
              🎓 Academia NEXUM · plan de desarrollo del equipo
            </div>
            {empleados.map((emp:any)=>{
              const cursosBase = [
                { n:'Inducción Hospitalidad',    completado: true,  fecha:'2024-12-15' },
                { n:'Wine Tasting Nivel 1',      completado: emp.score>=70, fecha:'2025-03-10' },
                { n:'Servicio Premium',          completado: emp.score>=80, fecha:'2025-05-22' },
                { n:'Maridajes Avanzados',       completado: emp.score>=90, fecha:'' },
                { n:'Liderazgo Sala',            completado: false, fecha:'' },
              ];
              const tomados = cursosBase.filter(c=>c.completado).length;
              const pct = Math.round((tomados/cursosBase.length)*100);
              return (
                <div key={emp.id} onClick={()=>setEmpSel(emp)} style={{background:'#0d0d0d',border:'1px solid #141414',borderRadius:12,padding:'12px 14px',marginBottom:10,cursor:'pointer'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                    <div style={{width:36,height:36,borderRadius:'50%',background:'#1a1a1a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:900}}>{emp.avatar_iniciales||emp.nombre_completo?.charAt(0)}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700}}>{emp.nombre_completo}</div>
                      <div style={{fontSize:10,color:'#505050'}}>{emp.cargo_display}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:900,color:'#9b72ff'}}>{tomados}/{cursosBase.length}</div>
                      <div style={{fontSize:9,color:'#505050'}}>cursos</div>
                    </div>
                  </div>
                  <div style={{height:5,background:'#1a1a1a',borderRadius:3,overflow:'hidden',marginBottom:8}}>
                    <div style={{height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,#9b72ff,#22D07A)'}}/>
                  </div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {cursosBase.map((c,i)=>(
                      <span key={i} title={c.fecha||'pendiente'} style={{fontSize:9,padding:'3px 8px',borderRadius:6,background:c.completado?'rgba(34,208,122,0.12)':'rgba(255,255,255,0.04)',color:c.completado?'#22D07A':'#505050',border:`1px solid ${c.completado?'#22D07A33':'#1e1e1e'}`,fontWeight:700}}>
                        {c.completado?'✓':'○'} {c.n}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB: OLD SCHOOL — empleados retirados (BD histórica) ── */}
        {activeTab === 'oldschool' && (
          <div>
            <div style={{fontSize:11,color:'#FF5C53',fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',marginBottom:12}}>
              🗂️ Old School · {historial.length} empleados retirados
            </div>
            {historial.length === 0 ? (
              <div style={{textAlign:'center',padding:40,color:'#505050',fontSize:12}}>
                <div style={{fontSize:36,marginBottom:10}}>🗂️</div>
                Sin retiros registrados todavía
              </div>
            ) : historial.map((h:any)=>(
              <div key={h.id} style={{background:'#0d0d0d',border:'1px solid #141414',borderRadius:12,padding:'12px 14px',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                  <div style={{width:34,height:34,borderRadius:'50%',background:'rgba(255,92,83,0.12)',border:'1px solid rgba(255,92,83,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:'#FF5C53'}}>
                    {String(h.nombre_completo||'?').split(' ').slice(0,2).map((s:string)=>s[0]).join('').toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700}}>{h.nombre_completo}</div>
                    <div style={{fontSize:10,color:'#505050'}}>{h.cargo_display||h.rol} · {h.cedula||'sin CC'}</div>
                  </div>
                  <span style={{fontSize:9,padding:'3px 8px',borderRadius:6,background:'rgba(255,92,83,0.12)',color:'#FF5C53',fontWeight:700,textTransform:'uppercase'}}>{h.tipo_retiro||h.motivo_retiro}</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,fontSize:10}}>
                  <div><div style={{color:'#505050',fontSize:9}}>Ingresó</div><div style={{fontWeight:700}}>{h.fecha_ingreso||'—'}</div></div>
                  <div><div style={{color:'#505050',fontSize:9}}>Retiró</div><div style={{fontWeight:700,color:'#FF5C53'}}>{h.fecha_retiro}</div></div>
                  <div><div style={{color:'#505050',fontSize:9}}>Liquidación</div><div style={{fontWeight:700,color:'#22D07A'}}>{fmtM(h.total_liquidacion||0)}</div></div>
                  <div><div style={{color:'#505050',fontSize:9}}>Indemniz.</div><div style={{fontWeight:700,color:h.con_indemnizacion?'#FFB547':'#505050'}}>{h.con_indemnizacion?fmtM(h.total_indemnizacion||0):'—'}</div></div>
                </div>
                {h.motivo_retiro && <div style={{fontSize:10,color:'#a0a0a0',marginTop:6,fontStyle:'italic'}}>💬 {h.motivo_retiro}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: ALERTAS ── */}
        {activeTab === 'alertas' && (
          <div>
            {empleados.filter(e => e.alertas.length > 0 || (e.score||0) < 70).length === 0 ? (
              <div style={{ textAlign:'center', padding:40 }}>
                <div style={{ fontSize:32, marginBottom:12 }}>✅</div>
                <div style={{ color:'#22D07A', fontWeight:700 }}>Todo en orden</div>
                <div style={{ color:'#404040', fontSize:12, marginTop:4 }}>
                  Sin alertas activas en el equipo
                </div>
              </div>
            ) : (
              empleados.filter(e => e.alertas.length > 0 || (e.score||0) < 70).map(emp => (
                <div key={emp.id} onClick={() => setEmpSel(emp)} style={{
                  background:'rgba(255,92,53,.04)', border:'1px solid rgba(255,92,53,.2)',
                  borderRadius:12, padding:14, marginBottom:8, cursor:'pointer',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <div style={{
                      width:36, height:36, borderRadius:10, background:'rgba(255,92,53,.1)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:13, color:'#f0f0f0',
                    }}>{emp.avatar_iniciales}</div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{emp.nombre_completo}</div>
                      <div style={{ fontSize:11, color:'#505050' }}>{emp.cargo_display}</div>
                    </div>
                    <span style={{ marginLeft:'auto', fontFamily:'Syne,sans-serif',
                      fontSize:16, fontWeight:900, color:scoreColor(emp.score) }}>
                      {emp.score}
                    </span>
                  </div>
                  {emp.alertas.map((a, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:6,
                      fontSize:12, color:'#FF7755', marginTop:4 }}>
                      <AlertTriangle size={11} color="#FF5C5C" /> {a}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── TAB: PROPINAS ── */}
        {activeTab === 'propinas' && (
          <div>
            <div style={{
              background:'linear-gradient(135deg,#0d2010,#0a1a0a)',
              border:'1px solid rgba(34,208,122,.2)',
              borderRadius:14, padding:18, marginBottom:14, textAlign:'center',
            }}>
              <div style={{ fontSize:11, color:'#22D07A', fontWeight:700,
                letterSpacing:'1px', textTransform:'uppercase', marginBottom:6 }}>
                Total propinas · {periodoLabel[periodo]}
              </div>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:36,
                fontWeight:900, color:'#fff' }}>{fmtM(totalPropinas)}</div>
              <div style={{ fontSize:12, color:'#4D8A6A', marginTop:4 }}>
                Distribuido entre {empleados.length} colaboradores
              </div>
            </div>

            {[...empleados]
              .filter(e => e.propinas_mes > 0)
              .sort((a,b) => b.propinas_mes - a.propinas_mes)
              .map((emp, i) => (
                <div key={emp.id} onClick={() => setEmpSel(emp)} style={{
                  display:'flex', alignItems:'center', gap:12,
                  background:'#0d0d0d', border:'1px solid #141414',
                  borderRadius:12, padding:'12px 14px', marginBottom:8, cursor:'pointer',
                }}>
                  <span style={{ fontSize:14, fontWeight:700, color:'#404040',
                    width:20, flexShrink:0 }}>#{i+1}</span>
                  <div style={{
                    width:36, height:36, borderRadius:10, background:'#141414',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:13, flexShrink:0,
                  }}>{emp.avatar_iniciales}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {emp.nombre_completo}
                    </div>
                    <div style={{ fontSize:11, color:'#505050' }}>{emp.cargo_display}</div>
                  </div>
                  <div style={{ fontFamily:'Syne,sans-serif', fontSize:15,
                    fontWeight:900, color:'#22D07A', flexShrink:0 }}>
                    {fmt(emp.propinas_mes)}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* ── TAB: EUROS DE LA APP ── */}
        {activeTab === 'euros' && (() => {
          const eurosData = [
            { id:1,  nombre:'Mateo Herrera',       iniciales:'MH', cargo:'Mesero Senior',  euros:1240, canjeados:800,  disponibles:440, nivel:'Oro',    beneficios:['Día libre extra','Bono $50k','Descuento 30% comida'] },
            { id:2,  nombre:'Esteban Salazar',      iniciales:'ES', cargo:'Sommelier',      euros:1180, canjeados:1100, disponibles:80,  nivel:'Oro',    beneficios:['Capacitación vinos','Certificado sommelier'] },
            { id:3,  nombre:'Andrés Felipe Mora',   iniciales:'AM', cargo:'Mesero',         euros:920,  canjeados:500,  disponibles:420, nivel:'Plata',  beneficios:['Bono $30k','Turno preferido'] },
            { id:4,  nombre:'Santiago León',        iniciales:'SL', cargo:'Bartender',      euros:860,  canjeados:860,  disponibles:0,   nivel:'Plata',  beneficios:['Todos canjeados este mes'] },
            { id:5,  nombre:'Laura Villalobos',     iniciales:'LV', cargo:'Maître',         euros:780,  canjeados:200,  disponibles:580, nivel:'Plata',  beneficios:['Día libre','Bono $20k'] },
            { id:6,  nombre:'Juan Camilo Rojas',    iniciales:'JR', cargo:'Mesero',         euros:540,  canjeados:300,  disponibles:240, nivel:'Bronce', beneficios:['Descuento 20% comida'] },
            { id:7,  nombre:'Kenji Nakamura',       iniciales:'KN', cargo:'Sushero',        euros:490,  canjeados:490,  disponibles:0,   nivel:'Bronce', beneficios:['Todos canjeados'] },
            { id:8,  nombre:'Carlos Méndez',        iniciales:'CM', cargo:'Cocinero',       euros:320,  canjeados:100,  disponibles:220, nivel:'Bronce', beneficios:['Descuento comida'] },
            { id:9,  nombre:'Sebastián Duarte',     iniciales:'SD', cargo:'Mesero',         euros:180,  canjeados:0,    disponibles:180, nivel:'Básico', beneficios:['Sin beneficios canjeados aún'] },
          ];
          const nivelColor: Record<string,string> = { Oro:'#FFD700', Plata:'#C0C0C0', Bronce:'#CD7F32', Básico:'#505050' };
          const totalEuros = eurosData.reduce((a,e)=>a+e.euros,0);
          const totalCanjeados = eurosData.reduce((a,e)=>a+e.canjeados,0);
          const totalDisponibles = eurosData.reduce((a,e)=>a+e.disponibles,0);

          return (
            <div>
              {/* KPIs */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
                {[
                  { label:'Euros totales', value:totalEuros, color:'#FFD700' },
                  { label:'Canjeados', value:totalCanjeados, color:'#4A8FD4' },
                  { label:'Disponibles', value:totalDisponibles, color:'#22D07A' },
                ].map(k => (
                  <div key={k.label} style={{ background:'#0d0d0d', border:'1px solid #141414', borderRadius:12, padding:'12px 14px' }}>
                    <div style={{ fontSize:10, color:'#505050', marginBottom:4, textTransform:'uppercase' as const, letterSpacing:'.06em' }}>{k.label}</div>
                    <div style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:900, color:k.color }}>€{k.value.toLocaleString('es-CO')}</div>
                  </div>
                ))}
              </div>

              {/* Tabla */}
              {eurosData.sort((a,b)=>b.euros-a.euros).map((emp, i) => {
                const pct = Math.round((emp.canjeados / emp.euros) * 100);
                const nc = nivelColor[emp.nivel];
                return (
                  <div key={emp.id} style={{
                    background:'#0d0d0d', border:`1px solid #141414`,
                    borderRadius:12, padding:'12px 14px', marginBottom:8,
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'#303030', width:18, flexShrink:0 }}>#{i+1}</span>
                      <div style={{ width:34, height:34, borderRadius:9, background:'#141414', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:12, flexShrink:0 }}>{emp.iniciales}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.nombre}</div>
                        <div style={{ fontSize:10, color:'#505050' }}>{emp.cargo}</div>
                      </div>
                      {/* Nivel badge */}
                      <span style={{ fontSize:10, fontWeight:700, color:nc, background:nc+'18', border:`1px solid ${nc}40`, padding:'2px 8px', borderRadius:20, flexShrink:0 }}>{emp.nivel}</span>
                      {/* Total euros */}
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontFamily:'Syne,sans-serif', fontSize:15, fontWeight:900, color:'#FFD700' }}>€{emp.euros}</div>
                        <div style={{ fontSize:10, color:'#505050' }}>€{emp.disponibles} disp.</div>
                      </div>
                    </div>

                    {/* Barra de canje */}
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ flex:1, height:4, background:'#1a1a1a', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background: pct===100?'#4A8FD4':'#FFD700', borderRadius:4, transition:'width .4s' }}/>
                      </div>
                      <span style={{ fontSize:10, color:'#505050', flexShrink:0 }}>{pct}% canjeado</span>
                    </div>

                    {/* Beneficios */}
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:8 }}>
                      {emp.beneficios.map(b => (
                        <span key={b} style={{ fontSize:10, color:'#808080', background:'#141414', border:'1px solid #1e1e1e', padding:'2px 8px', borderRadius:20 }}>{b}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

      </div>

      {/* ══════════════════════════════════════════════════════════
          TAB: SERATTA LIFE™ — Workforce Intelligence Platform
          Visión completa del colaborador
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'vida' && (
        <div style={{display:'flex',flexDirection:'column',gap:12,paddingBottom:80}}>

          {/* ── HEADER VISIÓN ── */}
          <div style={{background:'linear-gradient(135deg,rgba(155,114,255,0.12),rgba(255,92,53,0.08))',border:'1px solid rgba(155,114,255,0.25)',borderRadius:14,padding:'18px 20px'}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
              <div style={{width:44,height:44,borderRadius:13,background:'linear-gradient(135deg,#9b72ff,#FF5C53)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>🚀</div>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:900,color:'#f0f0f0'}}>SERATTA LIFE™</div>
                <div style={{fontSize:10,color:'#606060',textTransform:'uppercase',letterSpacing:'.08em'}}>Super App del Colaborador — Human Performance OS</div>
              </div>
            </div>
            <div style={{fontSize:12,color:'#a0a0a0',lineHeight:1.6}}>
              Convertir a Grupo Seratta en <strong style={{color:'#9b72ff'}}>el mejor lugar para trabajar en restaurantes en Colombia</strong>. Cada colaborador debe sentir: <em style={{color:'#f0b45a'}}>"Aquí tengo claridad, apoyo, crecimiento y una empresa que sí me escucha."</em>
            </div>
          </div>

          {/* ── 6 CAPAS DEL SISTEMA ── */}
          <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:14,padding:16}}>
            <div style={{fontSize:11,fontWeight:700,color:'#505050',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>6 capas del sistema</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              {[
                {ico:'⚙️',l:'Operación',         d:'Turnos, asistencia, incidencias'},
                {ico:'👥',l:'Talento Humano',     d:'Pagos, certificados, solicitudes'},
                {ico:'💙',l:'Bienestar',          d:'Emocional, salud, pausas activas'},
                {ico:'🎯',l:'Cultura',            d:'Reconocimiento, valores, orgullo'},
                {ico:'🤖',l:'IA & Automatización',d:'Chatbot, turnos, detección burnout'},
                {ico:'📊',l:'Analítica',          d:'Clima, liderazgo, eNPS interno'},
              ].map(k=>(
                <div key={k.l} style={{background:'#0d0d0d',borderRadius:10,padding:'10px 12px'}}>
                  <div style={{fontSize:18,marginBottom:4}}>{k.ico}</div>
                  <div style={{fontSize:11,fontWeight:700,color:'#f0f0f0',marginBottom:2}}>{k.l}</div>
                  <div style={{fontSize:9,color:'#505050',lineHeight:1.4}}>{k.d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── MÓDULOS DEL PRODUCTO ── */}
          <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:14,padding:16}}>
            <div style={{fontSize:11,fontWeight:700,color:'#505050',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>12 módulos obligatorios</div>
            {[
              {n:'01',ico:'🏠',t:'Home Inteligente',         s:'Turno del día · Pagos · Solicitudes · Reconocimientos',  fase:'MVP',color:'#4A8FD4'},
              {n:'02',ico:'📅',t:'Turnos Inteligentes',      s:'Ver · Confirmar · Cambiar · Intercambiar · Disponibilidad',fase:'MVP',color:'#3dba6f'},
              {n:'03',ico:'💰',t:'Centro Laboral',           s:'Nómina · Propinas · Vacaciones · Certificados · Docs',    fase:'MVP',color:'#f0b45a'},
              {n:'04',ico:'🛡️',t:'Canal de Escucha',         s:'Denuncias anónimas · Radicado · Trazabilidad · SLA',     fase:'MVP',color:'#FF5C53'},
              {n:'05',ico:'💜',t:'Pulse Emocional',          s:'Termómetro diario · Por sede · Alertas agregadas',        fase:'MVP',color:'#9b72ff'},
              {n:'06',ico:'🎓',t:'Academia Seratta',         s:'Videos · Microlearning · Rutas por cargo · Badges',       fase:'V2', color:'#22d3ee'},
              {n:'07',ico:'🌿',t:'Bienestar Integral',       s:'Pausas activas · Apoyo psicológico · Tips estrés',        fase:'V2', color:'#3dba6f'},
              {n:'08',ico:'🏆',t:'Reconocimiento & Cultura', s:'Premiar compañeros · Gamificar · Embajadores internos',   fase:'V2', color:'#f0b45a'},
              {n:'09',ico:'🎁',t:'Beneficios & Convenios',   s:'Descuentos · Alianzas · Campañas especiales',             fase:'V2', color:'#9b72ff'},
              {n:'10',ico:'📈',t:'Plan de Carrera',          s:'Ruta por cargo · Habilidades · Vacantes internas',        fase:'V3', color:'#22d3ee'},
              {n:'11',ico:'🤖',t:'Chatbot IA Seratta',       s:'¿Cuándo me pagan? ¿Cómo pido turno? Base conocimiento',  fase:'V3', color:'#FF5C53'},
              {n:'12',ico:'📢',t:'Comunicaciones Internas',  s:'Anuncios · Campañas · Mensajes urgentes · Lectura conf.', fase:'V2', color:'#4A8FD4'},
            ].map(m=>(
              <div key={m.n} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 10px',borderRadius:10,background:'#0d0d0d',marginBottom:5}}>
                <div style={{width:32,height:32,borderRadius:9,background:`${m.color}12`,border:`1px solid ${m.color}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{m.ico}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#f0f0f0'}}>{m.t}</div>
                  <div style={{fontSize:9,color:'#505050',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.s}</div>
                </div>
                <span style={{fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:20,background:m.fase==='MVP'?'rgba(61,186,111,0.15)':m.fase==='V2'?'rgba(74,143,212,0.15)':'rgba(155,114,255,0.15)',color:m.fase==='MVP'?'#3dba6f':m.fase==='V2'?'#4A8FD4':'#9b72ff',flexShrink:0}}>{m.fase}</span>
              </div>
            ))}
          </div>

          {/* ── NOMBRE RECOMENDADO ── */}
          <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:14,padding:16}}>
            <div style={{fontSize:11,fontWeight:700,color:'#505050',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>Nombre recomendado</div>
            {[
              {n:'SERATTA LIFE™',  r:'⭐ Recomendado', d:'Fuerza de marca · Cercanía emocional · SaaS potencial · Aspiracional pero humano', c:'#f0b45a'},
              {n:'Seratta Crew',   r:'Alternativa 1',  d:'Cercano · Sentido de pertenencia · Ya existe como PWA del mesero', c:'#4A8FD4'},
              {n:'Casa Seratta',   r:'Alternativa 2',  d:'Familiar · Cálido · Fuerte para cultura interna', c:'#3dba6f'},
              {n:'Seratta Pulse',  r:'Alternativa 3',  d:'Moderno · Sugiere vitalidad · Bueno para bienestar emocional', c:'#9b72ff'},
            ].map(n=>(
              <div key={n.n} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'10px 12px',borderRadius:10,background:`${n.c}08`,border:`1px solid ${n.c}20`,marginBottom:6}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:900,color:n.c,marginBottom:2}}>{n.n} <span style={{fontSize:10,fontWeight:400,color:'#606060'}}>{n.r}</span></div>
                  <div style={{fontSize:11,color:'#808080'}}>{n.d}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── ROADMAP ── */}
          <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:14,padding:16}}>
            <div style={{fontSize:11,fontWeight:700,color:'#505050',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>Roadmap de desarrollo</div>
            {[
              {f:'Fase 1 — MVP',       dur:'8–10 semanas', c:'#3dba6f', items:['Home inteligente','Turnos básicos','Centro laboral (nómina + propinas)','Canal de escucha anónimo','Pulse emocional semanal','Notificaciones push']},
              {f:'Fase 2 — App robusta',dur:'12–16 semanas',c:'#4A8FD4', items:['Academia Seratta','Reconocimiento & cultura','Bienestar integral','Beneficios & convenios','Comunicaciones segmentadas','Dashboard RRHH + Operaciones']},
              {f:'Fase 3 — Plataforma', dur:'20–24 semanas',c:'#9b72ff', items:['Chatbot IA Seratta','Plan de carrera con IA','Optimización de turnos con IA','Detección de burnout agregado','Multi-sede · Multi-empresa','Dashboard CEO ejecutivo','Visión SaaS regional']},
            ].map(f=>(
              <div key={f.f} style={{marginBottom:12}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:f.c,flexShrink:0}}/>
                  <div style={{fontSize:12,fontWeight:700,color:f.c}}>{f.f}</div>
                  <div style={{fontSize:10,color:'#404040',marginLeft:'auto'}}>⏱ {f.dur}</div>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4,paddingLeft:18}}>
                  {f.items.map(i=>(
                    <span key={i} style={{fontSize:10,background:`${f.c}10`,color:f.c,border:`1px solid ${f.c}20`,padding:'2px 8px',borderRadius:10}}>✓ {i}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── STACK TÉCNICO ── */}
          <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:14,padding:16}}>
            <div style={{fontSize:11,fontWeight:700,color:'#505050',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>Stack técnico recomendado</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {[
                {c:'Mobile',    v:'React Native + Expo',     why:'Mismo stack que NEXUM · Rápido · iOS + Android'},
                {c:'Panel Web', v:'React + Vite + Tailwind', why:'Ya construido en NEXUM · Consistencia total'},
                {c:'Backend',   v:'Supabase',                why:'Ya activo · RLS · Realtime · Auth · Storage'},
                {c:'Auth',      v:'Supabase Auth + OTP SMS', why:'Sin contraseña · Solo teléfono para operativos'},
                {c:'Push',      v:'Expo Notifications',      why:'Nativo iOS/Android · Sin costo extra'},
                {c:'IA',        v:'Claude API (Anthropic)',   why:'Chatbot Seratta · Análisis de clima · Resúmenes'},
                {c:'Storage',   v:'Supabase Storage',        why:'Documentos · Certificados · Fotos perfil'},
                {c:'Deploy',    v:'Vercel + EAS Build',      why:'Panel en Vercel · App en stores con Expo EAS'},
              ].map(s=>(
                <div key={s.c} style={{background:'#0d0d0d',borderRadius:9,padding:'9px 11px'}}>
                  <div style={{fontSize:9,color:'#505050',textTransform:'uppercase',marginBottom:2}}>{s.c}</div>
                  <div style={{fontSize:12,fontWeight:700,color:'#f0f0f0',marginBottom:2}}>{s.v}</div>
                  <div style={{fontSize:9,color:'#606060'}}>{s.why}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── ROLES Y PERMISOS ── */}
          <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:14,padding:16}}>
            <div style={{fontSize:11,fontWeight:700,color:'#505050',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>Roles del sistema</div>
            {[
              {r:'Colaborador',        p:'Ver turnos · Ver pagos · Enviar pulse · Denunciar · Cursos',    c:'#4A8FD4'},
              {r:'Líder de turno',     p:'Todo colaborador + ver equipo asignado · Alertas operativas',  c:'#3dba6f'},
              {r:'Gerente de sede',    p:'Dashboard sede · Aprobar cambios turno · Ver casos activos',   c:'#f0b45a'},
              {r:'RRHH',               p:'Gestión completa empleados · Pagos · Certificados · Casos',    c:'#9b72ff'},
              {r:'Bienestar/Cultura',  p:'Pulse agregado · Reconocimientos · Formación · Alertas clima', c:'#22d3ee'},
              {r:'Comité convivencia', p:'Solo módulo denuncias · Confidencial · Bitácora',              c:'#FF5C53'},
              {r:'CEO/Dirección',      p:'Dashboard ejecutivo · eNPS · Todos los KPIs · Solo lectura',   c:'#f0b45a'},
              {r:'Superadmin',         p:'Control total · Multi-empresa · Configuración sistema',        c:'#FF5C53'},
            ].map(r=>(
              <div key={r.r} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:6}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:r.c,marginTop:4,flexShrink:0}}/>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:r.c}}>{r.r}</div>
                  <div style={{fontSize:10,color:'#606060'}}>{r.p}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── KPIs DE ÉXITO ── */}
          <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:14,padding:16}}>
            <div style={{fontSize:11,fontWeight:700,color:'#505050',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>KPIs de éxito del producto</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {[
                {k:'Adopción',          t:'>70% activos semanales',      c:'#3dba6f'},
                {k:'Resolución casos',  t:'<48h promedio SLA',           c:'#FF5C53'},
                {k:'Satisfacción app',  t:'>4.2/5.0 en encuesta',        c:'#9b72ff'},
                {k:'Rotación',          t:'-20% en 6 meses',             c:'#f0b45a'},
                {k:'PQR a RRHH',        t:'-40% preguntas repetitivas',  c:'#4A8FD4'},
                {k:'eNPS interno',      t:'>30 puntos en 12 meses',      c:'#22d3ee'},
                {k:'Formación',         t:'>60% completan rutas MVP',    c:'#3dba6f'},
                {k:'Pulse emocional',   t:'>80% responden semanalmente', c:'#9b72ff'},
              ].map(k=>(
                <div key={k.k} style={{background:'#0d0d0d',borderRadius:8,padding:'8px 10px'}}>
                  <div style={{fontSize:10,fontWeight:700,color:k.c}}>{k.k}</div>
                  <div style={{fontSize:11,color:'#808080',marginTop:1}}>{k.t}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── PRINCIPIOS NO NEGOCIABLES ── */}
          <div style={{background:'linear-gradient(135deg,rgba(155,114,255,0.06),rgba(255,92,53,0.04))',border:'1px solid rgba(155,114,255,0.2)',borderRadius:14,padding:16}}>
            <div style={{fontSize:11,fontWeight:700,color:'#9b72ff',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>8 principios no negociables</div>
            {[
              ['📱','Mobile First',       'Todo pensado para celular. Frontline workers primero.'],
              ['⚡','Baja fricción',       'Las tareas más importantes en menos de 3 taps.'],
              ['🔒','Alta confianza',      'Jamás sentirse vigilado. La app es del colaborador.'],
              ['✅','Claridad radical',    'Pagos, turnos y solicitudes siempre trazables.'],
              ['🌐','Escalabilidad',       'MVP → plataforma regional multiempresa SaaS.'],
              ['♿','Accesibilidad',       'Contraste, texto legible, navegación simple.'],
              ['🛡️','Privacidad & ética', 'Datos emocionales jamás para castigar.'],
              ['🚀','Impacto real',        'No humo. Solo lo que resuelve problemas reales.'],
            ].map(([ico,t,d])=>(
              <div key={t as string} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:8}}>
                <span style={{fontSize:16,flexShrink:0}}>{ico}</span>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'#f0f0f0'}}>{t as string}</div>
                  <div style={{fontSize:10,color:'#606060'}}>{d as string}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── VISIÓN SAAS ── */}
          <div style={{background:'linear-gradient(135deg,rgba(240,180,90,0.08),rgba(155,114,255,0.06))',border:'1px solid rgba(240,180,90,0.25)',borderRadius:14,padding:16}}>
            <div style={{fontSize:13,fontWeight:900,color:'#f0b45a',marginBottom:8,fontFamily:"'Syne',sans-serif"}}>🌎 Visión SaaS Futura</div>
            <div style={{fontSize:12,color:'#a0a0a0',lineHeight:1.7}}>
              <strong style={{color:'#f0b45a'}}>Seratta Life™</strong> puede evolucionar a la primera plataforma de <strong style={{color:'#f0f0f0'}}>Employee OS para restaurantes y hospitality en Latinoamérica</strong>.<br/><br/>
              El equivalente a <strong style={{color:'#9b72ff'}}>Workday + 7shifts + Slack</strong> para la industria gastronómica. Multi-sede → multi-empresa → SaaS regional con módulos de:<br/>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:10}}>
              {['Workforce Management','Turnos IA','Nómina digital','eNPS continuo','Formación LMS','Canal denuncias','Bienestar 360°','Analytics de clima','Multi-marca'].map(t=>(
                <span key={t} style={{fontSize:10,background:'rgba(240,180,90,0.1)',color:'#f0b45a',border:'1px solid rgba(240,180,90,0.2)',padding:'2px 9px',borderRadius:20}}>{t}</span>
              ))}
            </div>
            <div style={{marginTop:12,fontSize:11,color:'#606060',fontStyle:'italic'}}>
              "No existe un producto así para restaurantes en Latinoamérica. Esta es la oportunidad."
            </div>
          </div>

        </div>
      )}

      {/* Panel detalle */}
      {empSel && <PanelEmpleado emp={empSel} onClose={() => setEmpSel(null)} />}

      {/* Modal nuevo empleado */}
      {showNuevoEmp && <NuevoEmpleadoModal onClose={()=>setShowNuevoEmp(false)} onSaved={()=>{ setShowNuevoEmp(false); cargar(); }}/>}

      {/* Modal despedir empleado */}
      {showDespedir && <DespedirModal empleados={empleados} onClose={()=>setShowDespedir(false)} onSaved={()=>{ setShowDespedir(false); cargar(); }}/>}

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODAL · NUEVO EMPLEADO (formulario completo + ARL + cuenta + tipo contrato)
// ═══════════════════════════════════════════════════════════════
function NuevoEmpleadoModal({ onClose, onSaved }:{ onClose:()=>void; onSaved:()=>void }) {
  const [f, setF] = useState<any>({
    nombre_completo:'', cedula:'', tipo_documento:'CC', email:'', telefono:'',
    direccion:'', contacto_emergencia:'',
    rol:'mesero', cargo_display:'Mesero',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    salario_base: 1500000,
    tipo_contrato:'indefinido',
    eps:'', afp:'', arl:'', banco:'', cuenta_bancaria:'',
    restaurante_id: 6, complejo_id: 2,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const upd = (k:string, v:any) => setF((p:any)=>({...p, [k]:v}));

  const guardar = async () => {
    if (!f.nombre_completo.trim()) { setError('Nombre obligatorio'); return; }
    if (!f.cedula.trim()) { setError('Cédula obligatoria'); return; }
    setSaving(true); setError(null);
    try {
      const iniciales = f.nombre_completo.split(' ').slice(0,2).map((s:string)=>s[0]).join('').toUpperCase();
      const { error: insErr } = await supabase.from('empleados').insert({
        ...f, activo: true, avatar_iniciales: iniciales,
      });
      if (insErr) throw insErr;
      onSaved();
    } catch (e:any) { setError(e?.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const STY = {
    inp:{ width:'100%', padding:'10px 12px', borderRadius:9, border:'1px solid #2a2a2a', background:'#0d0d0d', color:'#f0f0f0', fontSize:13, outline:'none', boxSizing:'border-box' as const },
    lbl:{ fontSize:10, color:'#808080', fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'.1em', marginBottom:4, display:'block' },
  };

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#141414',border:'2px solid rgba(34,208,122,0.4)',borderRadius:20,padding:24,maxWidth:600,width:'100%',maxHeight:'92vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
          <div style={{width:44,height:44,borderRadius:12,background:'linear-gradient(135deg,#22D07A,#1A9E5C)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>👤</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:17,fontWeight:900,color:'#fff'}}>Nuevo empleado</div>
            <div style={{fontSize:11,color:'#808080'}}>Datos personales · contrato · seguridad social · cuenta bancaria</div>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#808080',fontSize:22,cursor:'pointer'}}>×</button>
        </div>

        <div style={{fontSize:10,color:'#22D07A',fontWeight:800,textTransform:'uppercase',letterSpacing:'.14em',marginBottom:10}}>📋 Datos personales</div>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10,marginBottom:14}}>
          <div><label style={STY.lbl}>Nombre completo *</label><input style={STY.inp} value={f.nombre_completo} onChange={e=>upd('nombre_completo',e.target.value)} placeholder="Diego Mauricio Cruz Rodríguez"/></div>
          <div><label style={STY.lbl}>Cédula *</label><input style={STY.inp} value={f.cedula} onChange={e=>upd('cedula',e.target.value)} placeholder="1.234.567.890"/></div>
          <div><label style={STY.lbl}>Email</label><input type="email" style={STY.inp} value={f.email} onChange={e=>upd('email',e.target.value)}/></div>
          <div><label style={STY.lbl}>Celular</label><input style={STY.inp} value={f.telefono} onChange={e=>upd('telefono',e.target.value)} placeholder="+57"/></div>
          <div style={{gridColumn:'1/-1'}}><label style={STY.lbl}>Dirección</label><input style={STY.inp} value={f.direccion} onChange={e=>upd('direccion',e.target.value)}/></div>
          <div style={{gridColumn:'1/-1'}}><label style={STY.lbl}>Contacto de emergencia</label><input style={STY.inp} value={f.contacto_emergencia} onChange={e=>upd('contacto_emergencia',e.target.value)} placeholder="Nombre y teléfono"/></div>
        </div>

        <div style={{fontSize:10,color:'#d4943a',fontWeight:800,textTransform:'uppercase',letterSpacing:'.14em',marginBottom:10}}>💼 Contrato</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
          <div><label style={STY.lbl}>Cargo</label><input style={STY.inp} value={f.cargo_display} onChange={e=>upd('cargo_display',e.target.value)}/></div>
          <div><label style={STY.lbl}>Rol sistema</label>
            <select style={{...STY.inp,colorScheme:'dark'}} value={f.rol} onChange={e=>upd('rol',e.target.value)}>
              {['mesero','capitan','maitre','host','chef','sous_chef','auxiliar_cocina','bartender','barback','cajero','call_center','administrativo','admin','gerencia'].map(r=><option key={r}>{r}</option>)}
            </select>
          </div>
          <div><label style={STY.lbl}>Fecha ingreso</label><input type="date" style={{...STY.inp,colorScheme:'dark'}} value={f.fecha_ingreso} onChange={e=>upd('fecha_ingreso',e.target.value)}/></div>
          <div><label style={STY.lbl}>Salario base (COP)</label><input type="number" style={STY.inp} value={f.salario_base} onChange={e=>upd('salario_base',Number(e.target.value)||0)}/></div>
          <div style={{gridColumn:'1/-1'}}>
            <label style={STY.lbl}>Tipo de contrato</label>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {[{v:'indefinido',l:'Indefinido'},{v:'fijo',l:'Término fijo'},{v:'obra',l:'Obra/labor'},{v:'aprendizaje',l:'Aprendizaje'},{v:'prestacion',l:'Prest. servicios'}].map(c=>(
                <button key={c.v} type="button" onClick={()=>upd('tipo_contrato',c.v)} style={{padding:'7px 12px',borderRadius:8,border:`1px solid ${f.tipo_contrato===c.v?'#d4943a':'#2a2a2a'}`,background:f.tipo_contrato===c.v?'#d4943a20':'transparent',color:f.tipo_contrato===c.v?'#d4943a':'#a0a0a0',fontSize:11,fontWeight:700,cursor:'pointer'}}>{c.l}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{fontSize:10,color:'#9b72ff',fontWeight:800,textTransform:'uppercase',letterSpacing:'.14em',marginBottom:10}}>🛡️ Seguridad social</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:14}}>
          <div><label style={STY.lbl}>EPS</label><input style={STY.inp} value={f.eps} onChange={e=>upd('eps',e.target.value)} placeholder="Sura, Sanitas, etc."/></div>
          <div><label style={STY.lbl}>AFP / Pensión</label><input style={STY.inp} value={f.afp} onChange={e=>upd('afp',e.target.value)} placeholder="Porvenir, Protección…"/></div>
          <div><label style={STY.lbl}>ARL</label><input style={STY.inp} value={f.arl} onChange={e=>upd('arl',e.target.value)} placeholder="Sura, Positiva…"/></div>
        </div>

        <div style={{fontSize:10,color:'#4A8FD4',fontWeight:800,textTransform:'uppercase',letterSpacing:'.14em',marginBottom:10}}>🏦 Cuenta bancaria</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:10,marginBottom:18}}>
          <div><label style={STY.lbl}>Banco</label><input style={STY.inp} value={f.banco} onChange={e=>upd('banco',e.target.value)} placeholder="Bancolombia, Davivienda…"/></div>
          <div><label style={STY.lbl}>Cuenta (ahorros/corriente)</label><input style={STY.inp} value={f.cuenta_bancaria} onChange={e=>upd('cuenta_bancaria',e.target.value)} placeholder="N° de cuenta"/></div>
        </div>

        {error && <div style={{background:'rgba(255,92,83,0.12)',border:'1px solid rgba(255,92,83,0.3)',borderRadius:8,padding:'8px 12px',color:'#FF5C53',fontSize:12,marginBottom:12}}>⚠ {error}</div>}

        <button onClick={guardar} disabled={saving} style={{width:'100%',padding:14,borderRadius:12,border:'none',background:'linear-gradient(135deg,#22D07A,#1A9E5C)',color:'#fff',fontSize:14,fontWeight:900,cursor:'pointer',boxShadow:'0 8px 24px rgba(34,208,122,0.3)'}}>
          {saving?'Guardando…':'✓ Crear empleado'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODAL · DESPEDIR EMPLEADO (motivos + indemnización + liquidación + PDF)
// ═══════════════════════════════════════════════════════════════
// Causa de retiro mapeada al motor oficial NEXUM (§4 del manual)
const MOTIVOS_DESPIDO:{ id:CausaRetiro; l:string; con_indemn:boolean }[] = [
  { id:'sin_justa_causa',                  l:'Despido sin justa causa',            con_indemn:true  },
  { id:'terminacion_imputable_al_empleador', l:'Terminación imputable al empleador', con_indemn:true  },
  { id:'justa_causa',                      l:'Despido con justa causa',            con_indemn:false },
  { id:'mutuo_acuerdo',                    l:'Mutuo acuerdo',                      con_indemn:false },
  { id:'renuncia',                         l:'Renuncia voluntaria',                con_indemn:false },
  { id:'fin_contrato',                     l:'Vencimiento de contrato',            con_indemn:false },
];

const TIPOS_CONTRATO:{ id:TipoContrato; l:string; desc:string }[] = [
  { id:'indefinido', l:'Indefinido', desc:'Indemnización según umbral 10 SMMLV' },
  { id:'fijo',       l:'Término fijo', desc:'Indemnización = días faltantes hasta fin' },
  { id:'obra_labor', l:'Obra / labor', desc:'Indemnización = MAX(días faltantes, 15)' },
];

function DespedirModal({ empleados, onClose, onSaved }:{ empleados:any[]; onClose:()=>void; onSaved:()=>void }) {
  const [empId, setEmpId] = useState<number|''>('');
  const [causa, setCausa] = useState<CausaRetiro>('sin_justa_causa');
  const [tipo, setTipo] = useState<TipoContrato>('indefinido');
  const [variable, setVariable] = useState(0);
  const [diasVac, setDiasVac] = useState(0);
  const [otros, setOtros] = useState(0);
  const [descuentos, setDescuentos] = useState(0);
  const [fechaFin, setFechaFin] = useState('');
  const [diasFaltantesObra, setDiasFaltantesObra] = useState(0);
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const emp = empleados.find(e=>e.id===empId);
  const motivoMeta = MOTIVOS_DESPIDO.find(m=>m.id===causa);

  // Hidratar tipo de contrato del empleado al seleccionarlo
  React.useEffect(() => {
    if (!emp) return;
    const t = String(emp.tipo_contrato||'indefinido').toLowerCase();
    if (t === 'fijo')   setTipo('fijo');
    else if (t === 'obra' || t === 'obra_labor') setTipo('obra_labor');
    else setTipo('indefinido');
    setDiasVac(emp.vacaciones_disponibles || 0);
  }, [emp]);

  // CÁLCULO usando el motor oficial NEXUM
  const calculo = React.useMemo(() => {
    if (!emp) return null;
    try {
      const input = {
        salario_mensual: Number(emp.salario_base) || 0,
        salario_variable_promedio: variable,
        fecha_ingreso: emp.fecha_ingreso,
        fecha_retiro: new Date().toISOString().split('T')[0],
        fecha_fin_contrato: fechaFin || undefined,
        dias_faltantes_obra: diasFaltantesObra,
        dias_vacaciones_pendientes: diasVac,
        otros_pagos_pendientes: otros,
        descuentos_autorizados: descuentos,
        tipo_contrato: tipo,
        causa_retiro: causa,
      };
      return calcularRetiroCompleto(input);
    } catch (e:any) {
      console.warn('cálculo retiro:', e);
      return null;
    }
  }, [emp, causa, tipo, variable, diasVac, otros, descuentos, fechaFin, diasFaltantesObra]);

  const ejecutar = async () => {
    if (!emp) { setError('Selecciona un empleado'); return; }
    if (!calculo) { setError('No se pudo calcular'); return; }
    const liq = calculo.liquidacion;
    const ind = calculo.indemnizacion;
    const totalPagar = calculo.total_a_pagar;
    if (!confirm(`Confirmar retiro de ${emp.nombre_completo}\nCausa: ${motivoMeta?.l}\nTipo contrato: ${tipo}\nLiquidación: ${fmtM(liq.total_liquidacion)}${ind.aplica?` + Indemnización ${fmtM(ind.total_indemnizacion)}`:''}\nTotal: ${fmtM(totalPagar)}\n\nEsta acción es irreversible.`)) return;
    setSaving(true); setError(null);
    try {
      await supabase.from('liquidaciones').insert({
        empleado_id: emp.id, empleado_nombre: emp.nombre_completo,
        dias_trabajados: liq.dias_trabajados_ano, salario_base: emp.salario_base,
        cesantias: liq.cesantias_a_pagar, intereses_cesantias: liq.intereses_cesantias,
        prima_servicios: liq.prima_a_pagar, vacaciones_pendientes: liq.vacaciones_a_pagar,
        salario_pendiente: liq.salario_pendiente + liq.auxilio_pendiente,
        bonificaciones: liq.otros_pagos_pendientes,
        total_liquidacion: liq.total_liquidacion,
        con_indemnizacion: ind.aplica, valor_indemnizacion: ind.total_indemnizacion,
        total_a_pagar: totalPagar,
        motivo_retiro: motivoMeta?.l, tipo_retiro: causa,
        notas, generado_por: 'Gerencia',
      });

      await supabase.from('empleados_historial').insert({
        empleado_id: emp.id, restaurante_id: emp.restaurante_id, complejo_id: emp.complejo_id,
        nombre_completo: emp.nombre_completo, cedula: emp.cedula, cargo_display: emp.cargo_display,
        rol: emp.rol, fecha_ingreso: emp.fecha_ingreso,
        motivo_retiro: motivoMeta?.l, tipo_retiro: causa,
        salario_base: emp.salario_base,
        con_indemnizacion: ind.aplica,
        total_liquidacion: liq.total_liquidacion,
        total_indemnizacion: ind.total_indemnizacion,
        archivado_por: 'Gerencia', notas,
      });

      await supabase.from('empleados').update({ activo: false }).eq('id', emp.id);

      generarPDFRetiroV2(emp, calculo, motivoMeta!, tipo, notas);
      onSaved();
    } catch (e:any) { setError(e?.message || 'Error al procesar el retiro'); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#141414',border:'2px solid rgba(255,92,83,0.4)',borderRadius:20,padding:24,maxWidth:540,width:'100%',maxHeight:'92vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
          <div style={{width:44,height:44,borderRadius:12,background:'linear-gradient(135deg,#FF5C53,#C03A33)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>👋</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:17,fontWeight:900,color:'#fff'}}>Retiro de empleado</div>
            <div style={{fontSize:11,color:'#808080'}}>Liquidación automática · indemnización opcional · documento PDF</div>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#808080',fontSize:22,cursor:'pointer'}}>×</button>
        </div>

        <div style={{fontSize:10,color:'#FF5C53',fontWeight:800,textTransform:'uppercase',letterSpacing:'.14em',marginBottom:6}}>👤 Empleado</div>
        <select value={empId} onChange={e=>setEmpId(e.target.value?Number(e.target.value):'')} style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid #2a2a2a',background:'#0d0d0d',color:'#f0f0f0',fontSize:13,outline:'none',marginBottom:14,colorScheme:'dark'}}>
          <option value="">Selecciona…</option>
          {empleados.map(e=><option key={e.id} value={e.id}>{e.nombre_completo} · {e.cargo_display}</option>)}
        </select>

        <div style={{fontSize:10,color:'#FF5C53',fontWeight:800,textTransform:'uppercase',letterSpacing:'.14em',marginBottom:6}}>📋 Causa de retiro (§4 Manual NEXUM)</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:14}}>
          {MOTIVOS_DESPIDO.map(m=>(
            <button key={m.id} onClick={()=>setCausa(m.id)} style={{padding:'8px 10px',borderRadius:8,border:`1px solid ${causa===m.id?'#FF5C53':'#2a2a2a'}`,background:causa===m.id?'#FF5C5318':'transparent',color:causa===m.id?'#FF5C53':'#a0a0a0',fontSize:11,fontWeight:700,cursor:'pointer',textAlign:'left'}}>
              {m.l}{m.con_indemn && <span style={{display:'block',fontSize:9,opacity:0.7,color:'#FFB547'}}>⚠️ Genera indemnización</span>}
            </button>
          ))}
        </div>

        <div style={{fontSize:10,color:'#FF5C53',fontWeight:800,textTransform:'uppercase',letterSpacing:'.14em',marginBottom:6}}>📑 Tipo de contrato</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:14}}>
          {TIPOS_CONTRATO.map(t=>(
            <button key={t.id} onClick={()=>setTipo(t.id)} style={{padding:'8px 10px',borderRadius:8,border:`1px solid ${tipo===t.id?'#9b72ff':'#2a2a2a'}`,background:tipo===t.id?'#9b72ff18':'transparent',color:tipo===t.id?'#9b72ff':'#a0a0a0',fontSize:11,fontWeight:700,cursor:'pointer',textAlign:'left'}}>
              {t.l}<span style={{display:'block',fontSize:8,opacity:0.7,marginTop:2}}>{t.desc}</span>
            </button>
          ))}
        </div>

        {/* Inputs específicos según tipo de contrato */}
        {tipo === 'fijo' && (
          <div style={{display:'grid',gridTemplateColumns:'1fr',gap:6,marginBottom:14}}>
            <div>
              <div style={{fontSize:9,color:'#a0a0a0',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>Fecha fin de contrato</div>
              <input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #2a2a2a',background:'#0d0d0d',color:'#f0f0f0',fontSize:12,outline:'none',colorScheme:'dark'}}/>
            </div>
          </div>
        )}
        {tipo === 'obra_labor' && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:9,color:'#a0a0a0',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>Días faltantes de la obra</div>
            <input type="number" value={diasFaltantesObra} onChange={e=>setDiasFaltantesObra(Number(e.target.value)||0)} placeholder="Mínimo aplicable: 15 días" style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #2a2a2a',background:'#0d0d0d',color:'#f0f0f0',fontSize:12,outline:'none'}}/>
          </div>
        )}

        {/* Ajustes adicionales */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
          <div>
            <div style={{fontSize:9,color:'#a0a0a0',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>Variable salarial prom.</div>
            <input type="number" value={variable} onChange={e=>setVariable(Number(e.target.value)||0)} placeholder="Comisiones, recargos" style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #2a2a2a',background:'#0d0d0d',color:'#f0f0f0',fontSize:12,outline:'none'}}/>
          </div>
          <div>
            <div style={{fontSize:9,color:'#a0a0a0',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>Días vac. pendientes</div>
            <input type="number" value={diasVac} onChange={e=>setDiasVac(Number(e.target.value)||0)} style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #2a2a2a',background:'#0d0d0d',color:'#f0f0f0',fontSize:12,outline:'none'}}/>
          </div>
          <div>
            <div style={{fontSize:9,color:'#a0a0a0',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>Otros pagos pendientes</div>
            <input type="number" value={otros} onChange={e=>setOtros(Number(e.target.value)||0)} placeholder="Extras, recargos" style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #2a2a2a',background:'#0d0d0d',color:'#f0f0f0',fontSize:12,outline:'none'}}/>
          </div>
          <div>
            <div style={{fontSize:9,color:'#a0a0a0',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>Descuentos autorizados</div>
            <input type="number" value={descuentos} onChange={e=>setDescuentos(Number(e.target.value)||0)} placeholder="Préstamos, anticipos" style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #2a2a2a',background:'#0d0d0d',color:'#f0f0f0',fontSize:12,outline:'none'}}/>
          </div>
        </div>

        <textarea value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Notas / soporte del retiro (obligatorio para auditoría)" rows={2} style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid #2a2a2a',background:'#0d0d0d',color:'#f0f0f0',fontSize:12,outline:'none',marginBottom:14,resize:'none',boxSizing:'border-box'}}/>

        {calculo && emp && (
          <div style={{background:'rgba(255,92,83,0.05)',border:'1px solid rgba(255,92,83,0.25)',borderRadius:12,padding:14,marginBottom:14}}>
            <div style={{fontSize:10,color:'#FF5C53',fontWeight:800,textTransform:'uppercase',letterSpacing:'.14em',marginBottom:8}}>💰 Liquidación normal · Motor NEXUM</div>
            <div style={{display:'flex',flexDirection:'column',gap:5,fontSize:12}}>
              {calculo.liquidacion.bases.aplica_auxilio && (
                <div style={{padding:'6px 8px',marginBottom:4,borderRadius:6,background:'rgba(34,208,122,0.06)',border:'1px solid rgba(34,208,122,0.2)',fontSize:10,color:'#22D07A'}}>
                  ✓ Aux. transporte incluido en prestaciones: {fmtM(calculo.liquidacion.bases.auxilio_transporte)} (salario ≤ 2 SMMLV)
                </div>
              )}
              <Row label={`Salario pendiente · ${calculo.liquidacion.dias_laborados_mes}d del mes`} v={fmtM(calculo.liquidacion.salario_pendiente)}/>
              {calculo.liquidacion.auxilio_pendiente > 0 && <Row label="Auxilio pendiente" v={fmtM(calculo.liquidacion.auxilio_pendiente)}/>}
              <Row label={`Cesantías a pagar · ${calculo.liquidacion.dias_trabajados_ano}d año`} v={fmtM(calculo.liquidacion.cesantias_a_pagar)}/>
              <Row label="Int. cesantías · 12% anual" v={fmtM(calculo.liquidacion.intereses_cesantias)}/>
              <Row label={`Prima a pagar · ${calculo.liquidacion.dias_trabajados_semestre}d sem`} v={fmtM(calculo.liquidacion.prima_a_pagar)}/>
              <Row label={`Vacaciones · ${calculo.liquidacion.dias_vacaciones_pendientes}d pend.`} v={fmtM(calculo.liquidacion.vacaciones_a_pagar)}/>
              {calculo.liquidacion.otros_pagos_pendientes > 0 && <Row label="Otros pagos pendientes" v={fmtM(calculo.liquidacion.otros_pagos_pendientes)}/>}
              {calculo.liquidacion.descuentos_totales > 0 && <Row label="− Descuentos" v={`-${fmtM(calculo.liquidacion.descuentos_totales)}`} accent="#FF5C53"/>}
              <div style={{borderTop:'1px solid rgba(255,92,83,0.2)',marginTop:4,paddingTop:6,display:'flex',justifyContent:'space-between',fontWeight:800,color:'#FF5C53'}}>
                <span>Subtotal liquidación normal</span><span>{fmtM(calculo.liquidacion.total_liquidacion)}</span>
              </div>
            </div>

            {/* Indemnización · separada según motor */}
            <div style={{marginTop:12,paddingTop:10,borderTop:'1px solid rgba(255,181,71,0.3)'}}>
              <div style={{fontSize:10,color:'#FFB547',fontWeight:800,textTransform:'uppercase',letterSpacing:'.14em',marginBottom:6}}>⚖️ Indemnización · §4 Manual</div>
              {calculo.indemnizacion.aplica ? (
                <>
                  <div style={{fontSize:10,color:'#a0a0a0',marginBottom:6}}>{calculo.indemnizacion.detalle}</div>
                  <Row label={`Indemnización · ${calculo.indemnizacion.dias_indemnizacion.toFixed(1)}d × ${fmtM(calculo.indemnizacion.salario_diario)}/día`} v={fmtM(calculo.indemnizacion.total_indemnizacion)} accent="#FFB547"/>
                </>
              ) : (
                <div style={{fontSize:11,color:'#22D07A',padding:'6px 10px',background:'rgba(34,208,122,0.06)',border:'1px solid rgba(34,208,122,0.2)',borderRadius:6}}>
                  ℹ️ {calculo.indemnizacion.motivo_no_aplica || 'No genera indemnización'}
                </div>
              )}
            </div>

            <div style={{borderTop:'2px solid rgba(255,92,83,0.4)',marginTop:10,paddingTop:10,display:'flex',justifyContent:'space-between',fontSize:17,fontWeight:900,color:'#fff'}}>
              <span>TOTAL A PAGAR</span><span>{fmtM(calculo.total_a_pagar)}</span>
            </div>
          </div>
        )}

        {error && <div style={{background:'rgba(255,92,83,0.12)',border:'1px solid rgba(255,92,83,0.3)',borderRadius:8,padding:'8px 12px',color:'#FF5C53',fontSize:12,marginBottom:12}}>⚠ {error}</div>}

        <button onClick={ejecutar} disabled={saving || !emp} style={{width:'100%',padding:14,borderRadius:12,border:'none',background:saving||!emp?'#2a2a2a':'linear-gradient(135deg,#FF5C53,#C03A33)',color:'#fff',fontSize:14,fontWeight:900,cursor:saving||!emp?'not-allowed':'pointer',boxShadow:saving||!emp?'none':'0 8px 24px rgba(255,92,83,0.3)'}}>
          {saving?'Procesando…':'👋 Confirmar retiro + generar PDF'}
        </button>
        <p style={{fontSize:10,color:'#606060',textAlign:'center',marginTop:10}}>
          El empleado se desactivará y pasará a <strong>empleados_historial</strong>. Liquidación queda registrada y se genera PDF descargable.
        </p>
      </div>
    </div>
  );
}

function Row({ label, v, accent }:{ label:string; v:string; accent?:string }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',color:accent||'#a0a0a0'}}>
      <span>{label}</span><span style={{fontWeight:700,color:accent||'#f0f0f0'}}>{v}</span>
    </div>
  );
}

// Generar PDF v2 con desglose completo según motor NEXUM
function generarPDFRetiroV2(emp:any, calculo:any, motivo:{l:string;con_indemn:boolean}, tipo:TipoContrato, notas:string) {
  const liq = calculo.liquidacion;
  const ind = calculo.indemnizacion;
  const total = calculo.total_a_pagar;
  const fmt = (n:number) => '$' + Math.round(n||0).toLocaleString('es-CO');
  const tipoLabel = tipo === 'indefinido' ? 'Indefinido' : tipo === 'fijo' ? 'Término fijo' : 'Obra/labor';
  const html = `<!DOCTYPE html><html><head><title>Retiro · ${emp.nombre_completo}</title>
<style>
body{font-family:'Helvetica',sans-serif;max-width:780px;margin:30px auto;padding:30px;color:#1a1a1a;line-height:1.45}
h1{font-size:24px;margin:0 0 4px;color:#000;letter-spacing:-0.3px}
h2{font-size:11px;color:#666;margin:0 0 18px;text-transform:uppercase;letter-spacing:3px;font-weight:600}
h3{margin:0 0 8px;font-size:13px;color:#9b72ff;text-transform:uppercase;letter-spacing:1.5px}
.box{border:1px solid #ddd;border-radius:10px;padding:18px;margin:14px 0}
.box.warn{border-color:#FFB547;background:#FFF8EE}
.row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed #eee;font-size:12.5px}
.row.sum{font-weight:700;border-top:1px solid #1a1a1a;border-bottom:none;margin-top:6px;padding-top:8px}
.row.total{font-size:18px;font-weight:900;border-top:2px solid #000;padding-top:12px;margin-top:10px}
table{width:100%;border-collapse:collapse;font-size:11.5px}
td{padding:3px 0;vertical-align:top}
.label{color:#666;width:42%}
.detail{font-size:10.5px;color:#777;margin-top:4px;font-style:italic}
.footer{margin-top:60px;display:flex;justify-content:space-around;font-size:11px;color:#666}
.firma{border-top:1px solid #1a1a1a;padding-top:6px;min-width:220px;text-align:center}
.warn-msg{font-size:11px;color:#9b6500;padding:6px 10px;background:#FFF8EE;border:1px solid #FFE0A0;border-radius:5px;margin:6px 0}
.ok-msg{font-size:11px;color:#1A7548;padding:6px 10px;background:#E8F8EF;border:1px solid #B8E5CC;border-radius:5px;margin:6px 0}
</style></head><body>
<h1>ACTA DE LIQUIDACIÓN LABORAL</h1>
<h2>NEXUM Talent · ${new Date().toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'})}</h2>

<div class="box">
  <h3>👤 Datos del colaborador</h3>
  <table>
    <tr><td class="label">Nombre completo:</td><td><strong>${emp.nombre_completo}</strong></td></tr>
    <tr><td class="label">Documento:</td><td>${emp.tipo_documento||'CC'} ${emp.cedula||'—'}</td></tr>
    <tr><td class="label">Cargo:</td><td>${emp.cargo_display||emp.rol||'—'}</td></tr>
    <tr><td class="label">Tipo de contrato:</td><td><strong>${tipoLabel}</strong></td></tr>
    <tr><td class="label">Fecha ingreso:</td><td>${emp.fecha_ingreso||'—'}</td></tr>
    <tr><td class="label">Fecha retiro:</td><td>${new Date().toLocaleDateString('es-CO')}</td></tr>
    <tr><td class="label">Antigüedad total:</td><td>${ind.dias_antiguedad} días (≈ ${(ind.dias_antiguedad/365).toFixed(2)} años)</td></tr>
    <tr><td class="label">Causa de retiro:</td><td><strong style="color:#9b72ff">${motivo.l}</strong></td></tr>
  </table>
</div>

<div class="box">
  <h3>💰 Bases salariales</h3>
  <table>
    <tr><td class="label">Salario mensual:</td><td>${fmt(emp.salario_base||0)}</td></tr>
    ${liq.bases.aplica_auxilio?`<tr><td class="label">Aux. de transporte:</td><td>${fmt(liq.bases.auxilio_transporte)}</td></tr>`:''}
    <tr><td class="label">Base prestaciones:</td><td><strong>${fmt(liq.bases.salario_base_prestaciones)}</strong></td></tr>
    <tr><td class="label">Base indemnización:</td><td><strong>${fmt(liq.bases.salario_base_indemnizacion)}</strong> (sin aux. transporte)</td></tr>
    <tr><td class="label">Salario diario:</td><td>${fmt(liq.bases.salario_diario)}</td></tr>
  </table>
</div>

<div class="box">
  <h3>📊 Liquidación normal</h3>
  <div class="row"><span>Salario pendiente · ${liq.dias_laborados_mes} días</span><span>${fmt(liq.salario_pendiente)}</span></div>
  ${liq.auxilio_pendiente>0?`<div class="row"><span>Auxilio pendiente</span><span>${fmt(liq.auxilio_pendiente)}</span></div>`:''}
  <div class="row"><span>Cesantías a pagar · ${liq.dias_trabajados_ano} días año</span><span>${fmt(liq.cesantias_a_pagar)}</span></div>
  <div class="row"><span>Intereses cesantías · 12% anual</span><span>${fmt(liq.intereses_cesantias)}</span></div>
  <div class="row"><span>Prima a pagar · ${liq.dias_trabajados_semestre} días semestre</span><span>${fmt(liq.prima_a_pagar)}</span></div>
  <div class="row"><span>Vacaciones · ${liq.dias_vacaciones_pendientes} días pendientes</span><span>${fmt(liq.vacaciones_a_pagar)}</span></div>
  ${liq.otros_pagos_pendientes>0?`<div class="row"><span>Otros pagos pendientes</span><span>${fmt(liq.otros_pagos_pendientes)}</span></div>`:''}
  ${liq.descuentos_totales>0?`<div class="row" style="color:#c03333"><span>− Descuentos autorizados</span><span>-${fmt(liq.descuentos_totales)}</span></div>`:''}
  <div class="row sum"><span>Subtotal liquidación normal</span><span>${fmt(liq.total_liquidacion)}</span></div>
</div>

<div class="box ${ind.aplica?'warn':''}">
  <h3 style="color:${ind.aplica?'#9b6500':'#22A75A'}">⚖️ Indemnización (CST Art. 64)</h3>
  ${ind.aplica
    ? `<div class="warn-msg">${ind.detalle}</div>
       <div class="row"><span>Días de indemnización</span><span><strong>${ind.dias_indemnizacion.toFixed(1)} días</strong></span></div>
       <div class="row"><span>Salario diario × días</span><span>${fmt(ind.salario_diario)} × ${ind.dias_indemnizacion.toFixed(1)}</span></div>
       <div class="row sum" style="color:#9b6500"><span>Valor indemnización</span><span>${fmt(ind.total_indemnizacion)}</span></div>`
    : `<div class="ok-msg">ℹ️ ${ind.motivo_no_aplica||'No genera indemnización'}</div>`}
</div>

<div class="box" style="background:#1a1a1a;color:#fff;border:none">
  <div class="row total" style="border-color:#fff;color:#fff"><span>TOTAL A PAGAR AL COLABORADOR</span><span>${fmt(total)} COP</span></div>
</div>

${notas?`<div class="box"><h3 style="color:#333">📝 Observaciones</h3><p style="font-size:12.5px;color:#444;margin:0">${notas}</p></div>`:''}

<div class="footer">
  <div class="firma">Firma colaborador</div>
  <div class="firma">Firma representante legal</div>
</div>

<p style="font-size:9.5px;color:#999;text-align:center;margin-top:50px;font-style:italic">
  Liquidación calculada con el motor oficial NEXUM Talent · Manual técnico Colombia 2026.
  Este documento es una guía de cálculo y no reemplaza revisión jurídica de casos especiales (fueros, estabilidad laboral reforzada, incapacidades prolongadas).
  Generado: ${new Date().toISOString()}
</p>
</body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(()=>w.print(), 500); }
}

// Legacy (sin uso, conservado por compat)
function generarPDFRetiro(emp:any, calculo:any, motivo:{l:string;con_indemn:boolean}, notas:string) {
  const html = `<!DOCTYPE html><html><head><title>Retiro · ${emp.nombre_completo}</title>
<style>
body{font-family:'Helvetica',sans-serif;max-width:680px;margin:40px auto;padding:30px;color:#1a1a1a}
h1{font-size:22px;margin-bottom:4px;color:#000}
h2{font-size:13px;color:#666;margin-top:0;text-transform:uppercase;letter-spacing:2px;font-weight:600}
.box{border:1px solid #ddd;border-radius:10px;padding:20px;margin:20px 0}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #eee;font-size:13px}
.total{font-size:18px;font-weight:900;border-top:2px solid #000;padding-top:12px;margin-top:8px}
table{width:100%;border-collapse:collapse;font-size:12px}
td{padding:4px 0}
.label{color:#666}
.footer{margin-top:60px;display:flex;justify-content:space-around;font-size:11px;color:#666}
.firma{border-top:1px solid #1a1a1a;padding-top:6px;min-width:200px;text-align:center}
</style></head><body>
<h1>ACTA DE RETIRO LABORAL</h1>
<h2>NEXUM · OMM — ${new Date().toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'})}</h2>
<div class="box">
  <table>
    <tr><td class="label">Empleado:</td><td><strong>${emp.nombre_completo}</strong></td></tr>
    <tr><td class="label">Cédula:</td><td>${emp.cedula||'—'}</td></tr>
    <tr><td class="label">Cargo:</td><td>${emp.cargo_display||emp.rol||'—'}</td></tr>
    <tr><td class="label">Fecha ingreso:</td><td>${emp.fecha_ingreso||'—'}</td></tr>
    <tr><td class="label">Fecha retiro:</td><td>${new Date().toLocaleDateString('es-CO')}</td></tr>
    <tr><td class="label">Tiempo laborado:</td><td>${Math.floor(calculo.diasEmpresa/365)} años, ${Math.floor((calculo.diasEmpresa%365)/30)} meses</td></tr>
    <tr><td class="label">Motivo:</td><td><strong>${motivo.l}</strong></td></tr>
  </table>
</div>
<div class="box">
  <h3 style="margin-top:0;color:#9b72ff">Liquidación</h3>
  <div class="row"><span>Cesantías</span><span>$${Math.round(calculo.cesantias).toLocaleString('es-CO')}</span></div>
  <div class="row"><span>Intereses cesantías (12%)</span><span>$${Math.round(calculo.interesesCes).toLocaleString('es-CO')}</span></div>
  <div class="row"><span>Prima de servicios</span><span>$${Math.round(calculo.prima).toLocaleString('es-CO')}</span></div>
  <div class="row"><span>Vacaciones pendientes (${calculo.vacacionesDiasPendientes} días)</span><span>$${Math.round(calculo.vacaciones).toLocaleString('es-CO')}</span></div>
  <div class="row" style="font-weight:700"><span>Subtotal liquidación</span><span>$${Math.round(calculo.totalLiq).toLocaleString('es-CO')}</span></div>
  ${calculo.indemnizacion>0?`<div class="row" style="color:#c4671e"><span>Indemnización</span><span>$${Math.round(calculo.indemnizacion).toLocaleString('es-CO')}</span></div>`:''}
  <div class="row total"><span>TOTAL A PAGAR</span><span>$${Math.round(calculo.totalPagar).toLocaleString('es-CO')} COP</span></div>
</div>
${notas?`<div class="box"><h3 style="margin-top:0">Observaciones</h3><p style="font-size:13px;color:#444">${notas}</p></div>`:''}
<div class="footer">
  <div class="firma">Firma empleado</div>
  <div class="firma">Firma gerencia</div>
</div>
<p style="font-size:10px;color:#999;text-align:center;margin-top:40px">Documento generado por NEXUM Workforce Intelligence · ${new Date().toISOString()}</p>
</body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(()=>w.print(), 500); }
}

// ═══════════════════════════════════════════════════════════════
// MODAL · ENVIAR FEEDBACK (texto + sugerencia IA + push a Seratta Crew)
// ═══════════════════════════════════════════════════════════════
function FeedbackModal({ emp, onClose }:{ emp:any; onClose:()=>void }) {
  const [mensaje, setMensaje] = useState('');
  const [categoria, setCategoria] = useState<'reconocimiento'|'recomendacion'|'mejora'|'critico'>('recomendacion');
  const [saving, setSaving] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const sugerenciasIA = (() => {
    const arr:string[] = [];
    if ((emp.score||0) < 60) arr.push(`Score bajo (${emp.score}). Considerá una conversación 1:1 esta semana para entender qué está pasando.`);
    if ((emp.puntualidad||100) < 80) arr.push(`Puntualidad ${emp.puntualidad}%. Mencioná el impacto en el equipo y revisá si hay un tema personal.`);
    if ((emp.memorandos||0) >= 2) arr.push(`Ya tiene ${emp.memorandos} memorandos. Próxima falta = proceso disciplinario formal.`);
    if ((emp.ticket_promedio||0) < 60000 && (emp.tickets_mes||0) > 0) arr.push(`Ticket promedio bajo. Reforzá técnicas de upselling y maridajes.`);
    if ((emp.incapacidades||0) > 1) arr.push(`${emp.incapacidades} incapacidades este mes. Validá con RRHH si hay un patrón.`);
    if (arr.length === 0) arr.push(`${emp.nombre_completo.split(' ')[0]} viene bien. Aprovechá para reconocer un comportamiento puntual y reforzarlo.`);
    return arr;
  })();

  const enviar = async () => {
    if (!mensaje.trim()) return;
    setSaving(true);
    try {
      // Notificación a Seratta Crew (push interno del equipo)
      await supabase.from('seratta_crew_notificaciones').insert({
        empleado_id: emp.id, empleado_nombre: emp.nombre_completo,
        tipo: 'feedback_' + categoria,
        titulo: categoria==='reconocimiento'?'🌟 Reconocimiento':categoria==='critico'?'⚠️ Atención requerida':categoria==='mejora'?'🎯 Oportunidad de mejora':'💬 Feedback',
        mensaje,
        prioridad: categoria==='critico'?'alta':categoria==='reconocimiento'?'baja':'media',
        leida: false,
      }).then(()=>{}, ()=>{});
      // También log en workforce_audit para trazabilidad
      await supabase.from('workforce_audit').insert({
        actor: 'Gerencia', accion:'feedback.enviado', objeto:'empleado',
        despues:{ empleado_id: emp.id, categoria, mensaje:mensaje.slice(0,200) },
        motivo: categoria,
      }).then(()=>{}, ()=>{});
      setEnviado(true);
      setTimeout(()=>onClose(), 1400);
    } catch {}
    setSaving(false);
  };

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#141414',border:'2px solid rgba(212,148,58,0.4)',borderRadius:20,padding:24,maxWidth:520,width:'100%',maxHeight:'92vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
          <div style={{width:44,height:44,borderRadius:12,background:'linear-gradient(135deg,#d4943a,#9b72ff)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>📩</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:17,fontWeight:900,color:'#fff'}}>Feedback a {emp.nombre_completo}</div>
            <div style={{fontSize:11,color:'#808080'}}>Llega como notificación push en Seratta Crew</div>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#808080',fontSize:22,cursor:'pointer'}}>×</button>
        </div>

        {enviado ? (
          <div style={{textAlign:'center',padding:'30px 10px'}}>
            <div style={{fontSize:48,marginBottom:10}}>✅</div>
            <div style={{fontSize:16,fontWeight:900,color:'#22D07A'}}>Feedback enviado</div>
            <div style={{fontSize:12,color:'#808080',marginTop:4}}>{emp.nombre_completo.split(' ')[0]} lo verá en su app Seratta Crew</div>
          </div>
        ) : (
          <>
            {/* Categoría */}
            <div style={{fontSize:10,color:'#d4943a',fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',marginBottom:8}}>Categoría</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:6,marginBottom:14}}>
              {[
                {id:'reconocimiento',l:'🌟 Reconocimiento',c:'#22D07A'},
                {id:'recomendacion', l:'💡 Recomendación', c:'#9b72ff'},
                {id:'mejora',        l:'🎯 Oportunidad',   c:'#d4943a'},
                {id:'critico',       l:'⚠️ Crítico',        c:'#FF5C53'},
              ].map((c:any)=>(
                <button key={c.id} onClick={()=>setCategoria(c.id)} style={{padding:'9px 12px',borderRadius:9,border:`1px solid ${categoria===c.id?c.c:'#2a2a2a'}`,background:categoria===c.id?`${c.c}18`:'transparent',color:categoria===c.id?c.c:'#a0a0a0',fontSize:12,fontWeight:700,cursor:'pointer',textAlign:'left'}}>{c.l}</button>
              ))}
            </div>

            {/* Sugerencias IA */}
            <div style={{background:'rgba(155,114,255,0.08)',border:'1px solid rgba(155,114,255,0.25)',borderRadius:10,padding:'10px 12px',marginBottom:14}}>
              <div style={{fontSize:10,color:'#9b72ff',fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
                <Brain size={12}/> Sugerencias IA (basadas en métricas)
              </div>
              {sugerenciasIA.map((s,i)=>(
                <button key={i} onClick={()=>setMensaje(s)} style={{display:'block',width:'100%',textAlign:'left',background:'transparent',border:'1px dashed rgba(155,114,255,0.3)',borderRadius:8,padding:'8px 10px',marginBottom:5,color:'#d0c8ff',fontSize:11,cursor:'pointer',lineHeight:1.4}}>
                  💬 {s}
                </button>
              ))}
            </div>

            {/* Mensaje */}
            <div style={{fontSize:10,color:'#a0a0a0',fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',marginBottom:6}}>Tu mensaje</div>
            <textarea value={mensaje} onChange={e=>setMensaje(e.target.value)} placeholder="Escribe el feedback aquí…" rows={5}
              style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid #2a2a2a',background:'#0d0d0d',color:'#f0f0f0',fontSize:13,outline:'none',resize:'none',marginBottom:14,boxSizing:'border-box'}}/>

            <button onClick={enviar} disabled={saving || !mensaje.trim()} style={{width:'100%',padding:13,borderRadius:11,border:'none',background:saving||!mensaje.trim()?'#2a2a2a':'linear-gradient(135deg,#d4943a,#9b72ff)',color:'#fff',fontSize:13,fontWeight:900,cursor:saving||!mensaje.trim()?'not-allowed':'pointer'}}>
              {saving?'Enviando…':`📤 Enviar a ${emp.nombre_completo.split(' ')[0]}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODAL · PLAN DE DESARROLLO (cursos academia + ruta de carrera)
// ═══════════════════════════════════════════════════════════════
function PlanDesarrolloModal({ emp, onClose }:{ emp:any; onClose:()=>void }) {
  // Plan de desarrollo basado en el rol — cursos disponibles en Academia NEXUM
  const planPorRol:any = {
    mesero:    ['Inducción Hospitalidad','Wine Tasting Nivel 1','Servicio Premium','Maridajes Avanzados','Liderazgo Sala'],
    capitan:   ['Servicio Premium','Maridajes Avanzados','Liderazgo Sala','Gestión de turno','Manejo de quejas'],
    chef:      ['Mise en place pro','Costos y rentabilidad','Liderazgo cocina','Innovación de carta'],
    bartender: ['Mixología clásica','Mixología de autor','Costos y rentabilidad','Etiqueta y carta'],
    cocinero:  ['Mise en place pro','Sanidad e inocuidad','Estaciones y flow','Costos y rentabilidad'],
  };
  const cursos = (planPorRol[emp.rol] || planPorRol.mesero).map((n:string,i:number)=>({
    nombre: n,
    completado: i < ((emp.score||0)/100*5),
    fecha: i < 2 ? '2025-02-10' : '',
  }));
  const tomados = cursos.filter((c:any)=>c.completado).length;
  const pct = Math.round((tomados/cursos.length)*100);

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#141414',border:'2px solid rgba(34,208,122,0.4)',borderRadius:20,padding:24,maxWidth:540,width:'100%',maxHeight:'92vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
          <div style={{width:44,height:44,borderRadius:12,background:'linear-gradient(135deg,#22D07A,#1A9E5C)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>🎓</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:17,fontWeight:900,color:'#fff'}}>Plan de desarrollo</div>
            <div style={{fontSize:11,color:'#808080'}}>{emp.nombre_completo} · {emp.cargo_display||emp.rol}</div>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#808080',fontSize:22,cursor:'pointer'}}>×</button>
        </div>

        {/* Progreso */}
        <div style={{background:'rgba(34,208,122,0.06)',border:'1px solid rgba(34,208,122,0.2)',borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{fontSize:11,color:'#22D07A',fontWeight:800,textTransform:'uppercase',letterSpacing:'.1em'}}>📈 Progreso Academia</span>
            <span style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:900,color:'#22D07A'}}>{tomados}/{cursos.length}</span>
          </div>
          <div style={{height:10,background:'#1a1a1a',borderRadius:5,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,#22D07A,#9b72ff)',borderRadius:5}}/>
          </div>
        </div>

        <div style={{fontSize:11,color:'#9b72ff',fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',marginBottom:10}}>🛤️ Ruta de carrera</div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {cursos.map((c:any,i:number)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:c.completado?'rgba(34,208,122,0.06)':'rgba(255,255,255,0.02)',border:`1px solid ${c.completado?'rgba(34,208,122,0.3)':'#1e1e1e'}`,borderRadius:10}}>
              <div style={{width:30,height:30,borderRadius:'50%',background:c.completado?'#22D07A':'#2a2a2a',color:c.completado?'#000':'#606060',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:13}}>{c.completado?'✓':i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:c.completado?'#fff':'#a0a0a0'}}>{c.nombre}</div>
                <div style={{fontSize:10,color:c.completado?'#22D07A':'#606060'}}>
                  {c.completado ? `✓ Completado · ${c.fecha}` : '○ Pendiente'}
                </div>
              </div>
              {!c.completado && (
                <button style={{padding:'5px 10px',borderRadius:7,border:'1px solid #9b72ff55',background:'rgba(155,114,255,0.1)',color:'#9b72ff',fontSize:10,fontWeight:700,cursor:'pointer'}}>
                  Inscribir
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{marginTop:16,padding:12,background:'rgba(155,114,255,0.06)',border:'1px solid rgba(155,114,255,0.2)',borderRadius:10}}>
          <div style={{fontSize:10,color:'#9b72ff',fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',marginBottom:6}}>🎯 Próximo paso recomendado</div>
          <div style={{fontSize:12,color:'#e0d8ff'}}>
            {cursos.find((c:any)=>!c.completado)?.nombre || 'Plan completado — considerá promoción.'}
          </div>
        </div>
      </div>
    </div>
  );
}
