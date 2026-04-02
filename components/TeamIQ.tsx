import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
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
  { id:1,  nombre_completo:'Juan Camilo Rojas',   rol:'mesero',     cargo_display:'Mesero',         avatar_iniciales:'JR', salario_base:1800000, memorandos:1, vacaciones_dias:10, fecha_ingreso:'2023-05-12', ventas_mes:38000000, ticket_promedio:84000,  upselling_pct:18, score:72,  score_delta:+3,  propinas_mes:270000, turno_hoy:'17:00–23:00', estado:'turno',  alertas:['1 memorando activo'] },
  { id:2,  nombre_completo:'Andrés Felipe Mora',  rol:'mesero',     cargo_display:'Mesero',         avatar_iniciales:'AM', salario_base:1900000, memorandos:0, vacaciones_dias:0,  fecha_ingreso:'2022-11-03', ventas_mes:52000000, ticket_promedio:96000,  upselling_pct:31, score:88,  score_delta:+5,  propinas_mes:320000, turno_hoy:'17:00–23:00', estado:'turno',  alertas:[] },
  { id:3,  nombre_completo:'Sebastián Duarte',    rol:'mesero',     cargo_display:'Mesero',         avatar_iniciales:'SD', salario_base:1750000, memorandos:2, vacaciones_dias:12, fecha_ingreso:'2024-02-10', ventas_mes:24000000, ticket_promedio:61000,  upselling_pct:9,  score:54,  score_delta:-4,  propinas_mes:180000, turno_hoy:undefined,     estado:'ausente', alertas:['2 memorandos','Rendimiento por debajo -28%'] },
  { id:4,  nombre_completo:'Mateo Herrera',       rol:'mesero',     cargo_display:'Mesero Senior',  avatar_iniciales:'MH', salario_base:2100000, memorandos:0, vacaciones_dias:5,  fecha_ingreso:'2021-07-01', ventas_mes:61000000, ticket_promedio:112000, upselling_pct:42, score:93,  score_delta:+8,  propinas_mes:410000, turno_hoy:'17:00–23:00', estado:'turno',  alertas:[] },
  { id:5,  nombre_completo:'Laura Villalobos',    rol:'maitre',     cargo_display:'Maître',         avatar_iniciales:'LV', salario_base:4500000, memorandos:0, vacaciones_dias:0,  fecha_ingreso:'2020-03-15', ventas_mes:0,         ticket_promedio:0,      upselling_pct:0,  score:91,  score_delta:+2,  propinas_mes:520000, turno_hoy:'17:00–23:00', estado:'turno',  alertas:[] },
  { id:6,  nombre_completo:'Carlos Méndez',       rol:'cocinero',   cargo_display:'Cocinero',       avatar_iniciales:'CM', salario_base:2200000, memorandos:1, vacaciones_dias:8,  fecha_ingreso:'2023-01-20', ventas_mes:0,         ticket_promedio:0,      upselling_pct:0,  score:68,  score_delta:+1,  propinas_mes:130000, turno_hoy:'11:00–18:00', estado:'turno',  alertas:['1 memorando'] },
  { id:7,  nombre_completo:'Diego Ramírez',       rol:'cocinero',   cargo_display:'Cocinero',       avatar_iniciales:'DR', salario_base:2300000, memorandos:0, vacaciones_dias:0,  fecha_ingreso:'2022-09-10', ventas_mes:0,         ticket_promedio:0,      upselling_pct:0,  score:82,  score_delta:+4,  propinas_mes:130000, turno_hoy:'11:00–18:00', estado:'turno',  alertas:[] },
  { id:10, nombre_completo:'Santiago León',       rol:'bartender',  cargo_display:'Bartender',      avatar_iniciales:'SL', salario_base:2800000, memorandos:0, vacaciones_dias:0,  fecha_ingreso:'2022-06-18', ventas_mes:44000000, ticket_promedio:88000,  upselling_pct:28, score:85,  score_delta:+6,  propinas_mes:380000, turno_hoy:'18:00–02:00', estado:'turno',  alertas:[] },
  { id:11, nombre_completo:'Esteban Salazar',     rol:'sommelier',  cargo_display:'Sommelier',      avatar_iniciales:'ES', salario_base:3800000, memorandos:0, vacaciones_dias:7,  fecha_ingreso:'2021-04-22', ventas_mes:58000000, ticket_promedio:118000, upselling_pct:55, score:96,  score_delta:+3,  propinas_mes:460000, turno_hoy:'17:00–23:00', estado:'turno',  alertas:[] },
  { id:14, nombre_completo:'Kenji Nakamura',      rol:'cocinero',   cargo_display:'Sushero',        avatar_iniciales:'KN', salario_base:3200000, memorandos:0, vacaciones_dias:0,  fecha_ingreso:'2022-02-28', ventas_mes:0,         ticket_promedio:0,      upselling_pct:0,  score:89,  score_delta:+2,  propinas_mes:150000, turno_hoy:'11:00–18:00', estado:'turno',  alertas:[] },
  { id:19, nombre_completo:'Alejandro Trinidade', rol:'jefe_cocina',cargo_display:'Chef Ejecutivo', avatar_iniciales:'AT', salario_base:7500000, memorandos:0, vacaciones_dias:15, fecha_ingreso:'2020-02-01', ventas_mes:0,         ticket_promedio:0,      upselling_pct:0,  score:94,  score_delta:+1,  propinas_mes:0,      turno_hoy:'09:00–18:00', estado:'turno',  alertas:[] },
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
function PanelEmpleado({ emp, onClose }: { emp: Empleado; onClose: () => void }) {
  const badge = scoreBadge(emp.score);
  const area = areaFromRol(emp.rol);
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
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
          {[
            { label:'Memorandos', val: emp.memorandos, warn: emp.memorandos > 0 },
            { label:'Días vacaciones', val: emp.vacaciones_dias },
            { label:'Antigüedad', val: Math.floor((Date.now() - new Date(emp.fecha_ingreso).getTime()) / (365.25*86400000)) + ' años' },
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

        {/* Acciones */}
        <div style={{ display:'flex', gap:8 }}>
          <button style={{
            flex:1, padding:13, borderRadius:10,
            background:'rgba(212,148,58,.1)', border:'1px solid rgba(212,148,58,.3)',
            color:'#d4943a', fontSize:13, fontWeight:700, cursor:'pointer',
          }}>📩 Enviar feedback</button>
          <button style={{
            flex:1, padding:13, borderRadius:10,
            background:'rgba(34,208,122,.1)', border:'1px solid rgba(34,208,122,.3)',
            color:'#22D07A', fontSize:13, fontWeight:700, cursor:'pointer',
          }}>🎯 Ver plan desarrollo</button>
        </div>

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
  const [activeTab, setActiveTab] = useState<'equipo'|'ranking'|'alertas'|'propinas'>('equipo');

  // Cargar empleados desde Supabase con fallback demo
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('*, restaurantes(nombre,emoji), complejos(nombre)')
        .eq('activo', true)
        .order('nombre_completo');

      if (!error && data && data.length > 0) {
        // Enriquecer con datos demo de rendimiento (en producción vendrían de tablas analytics)
        const enriquecidos = data.map((e: any) => {
          const demo = DEMO_EMPLEADOS.find(d => d.id === e.id) || DEMO_EMPLEADOS[0];
          return {
            ...e,
            ventas_mes:      demo.ventas_mes,
            ticket_promedio: demo.ticket_promedio,
            upselling_pct:   demo.upselling_pct,
            score:           demo.score,
            score_delta:     demo.score_delta,
            propinas_mes:    demo.propinas_mes,
            turno_hoy:       demo.turno_hoy,
            estado:          demo.estado,
            alertas:         [
              ...(e.memorandos > 0 ? [`${e.memorandos} memorando${e.memorandos>1?'s':''}`] : []),
              ...(demo.score < 60 ? ['Rendimiento por debajo del estándar'] : []),
            ],
          };
        });
        setEmpleados(enriquecidos);
      } else {
        setEmpleados(DEMO_EMPLEADOS);
      }
    } catch {
      setEmpleados(DEMO_EMPLEADOS);
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Filtrar
  const filtered = empleados.filter(e => {
    const matchArea = area === 'todos' || areaFromRol(e.rol) === area;
    const matchSearch = !search ||
      e.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
      e.cargo_display.toLowerCase().includes(search.toLowerCase());
    return matchArea && matchSearch;
  });

  // KPIs
  const totalVentas   = empleados.reduce((s, e) => s + e.ventas_mes, 0);
  const avgScore      = Math.round(empleados.reduce((s, e) => s + e.score, 0) / (empleados.length || 1));
  const totalPropinas = empleados.reduce((s, e) => s + e.propinas_mes, 0);
  const alertasCnt    = empleados.filter(e => e.alertas.length > 0).length;
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
          <button onClick={cargar} style={{
            width:34, height:34, borderRadius:8, border:'1px solid #1e1e1e',
            background:'transparent', color:'#606060', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <RefreshCw size={14} />
          </button>
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

        {/* KPI cards */}
        <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto', scrollbarWidth:'none' }}>
          <KpiCard label="Ventas totales" value={fmtM(totalVentas)} sub={periodoLabel[periodo]} color="#d4943a" icon={DollarSign} delta={12} />
          <KpiCard label="Score equipo" value={avgScore} sub="promedio general" color="#9b72ff" icon={Brain} delta={4} />
          <KpiCard label="En turno" value={`${enTurno}/${empleados.length}`} sub="colaboradores activos" color="#22D07A" icon={Users} />
          <KpiCard label="Propinas mes" value={fmtM(totalPropinas)} color="#4A8FD4" icon={Zap} delta={8} />
        </div>

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
            { id:'equipo',   icon:Users,    label:'Equipo' },
            { id:'ranking',  icon:Crown,    label:'Ranking' },
            { id:'alertas',  icon:Shield,   label:`Alertas${alertasCnt>0?' ·'+alertasCnt:''}` },
            { id:'propinas', icon:DollarSign,label:'Propinas' },
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
            {/* Filtro área */}
            <div style={{ display:'flex', gap:6, marginBottom:12, overflowX:'auto', scrollbarWidth:'none' }}>
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

            {loading ? (
              <div style={{ textAlign:'center', padding:40, color:'#404040' }}>Cargando equipo...</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {filtered.map(emp => {
                  const badge = scoreBadge(emp.score);
                  return (
                    <div key={emp.id}
                      onClick={() => setEmpSel(emp)}
                      style={{
                        background:'#0d0d0d', border:`1px solid ${emp.alertas.length > 0 ? 'rgba(255,92,53,.2)' : '#141414'}`,
                        borderRadius:14, padding:'14px 16px', cursor:'pointer',
                        transition:'border-color .15s',
                        display:'flex', alignItems:'center', gap:12,
                      }}>
                      {/* Avatar */}
                      <div style={{
                        width:44, height:44, borderRadius:12, flexShrink:0,
                        background:`linear-gradient(135deg,${scoreColor(emp.score)}25,${scoreColor(emp.score)}10)`,
                        border:`1px solid ${scoreColor(emp.score)}30`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:15, color:'#f0f0f0',
                      }}>{emp.avatar_iniciales}</div>

                      {/* Info */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                          <span style={{ fontWeight:700, fontSize:14, color:'#f0f0f0',
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {emp.nombre_completo}
                          </span>
                          {emp.alertas.length > 0 && <AlertTriangle size={12} color="#FF5C5C" />}
                        </div>
                        <div style={{ fontSize:11, color:'#505050', marginBottom:6 }}>
                          {emp.cargo_display}
                          {emp.turno_hoy && <span style={{ color:'#22D07A' }}> · {emp.turno_hoy}</span>}
                        </div>
                        <ScoreBar score={emp.score} />
                      </div>

                      {/* Badge + delta */}
                      <div style={{ flexShrink:0, display:'flex', flexDirection:'column',
                        alignItems:'flex-end', gap:5 }}>
                        <span style={{ padding:'3px 9px', borderRadius:20, fontSize:10,
                          fontWeight:700, background:badge.bg, color:badge.color }}>
                          {badge.label}
                        </span>
                        <DeltaChip delta={emp.score_delta} />
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div style={{ textAlign:'center', padding:32, color:'#404040', fontSize:13 }}>
                    No hay resultados
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── TAB: RANKING ── */}
        {activeTab === 'ranking' && (
          <div>
            <div style={{ fontSize:12, color:'#505050', marginBottom:12 }}>
              Ranking por score · {periodoLabel[periodo]}
            </div>
            {ranking.map((emp, i) => {
              const medals = ['🥇','🥈','🥉'];
              const medal = medals[i] || `#${i+1}`;
              const c = scoreColor(emp.score);
              return (
                <div key={emp.id} onClick={() => setEmpSel(emp)} style={{
                  display:'flex', alignItems:'center', gap:12,
                  background: i < 3 ? `${c}08` : '#0d0d0d',
                  border: `1px solid ${i < 3 ? c+'25' : '#141414'}`,
                  borderRadius:12, padding:'12px 14px', marginBottom:8, cursor:'pointer',
                }}>
                  <span style={{ fontSize:20, width:28, textAlign:'center', flexShrink:0 }}>{medal}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {emp.nombre_completo}
                    </div>
                    <div style={{ fontSize:11, color:'#505050' }}>{emp.cargo_display}</div>
                  </div>
                  <div style={{ flexShrink:0, textAlign:'right' }}>
                    <div style={{ fontFamily:'Syne,sans-serif', fontSize:18,
                      fontWeight:900, color:c }}>{emp.score}</div>
                    <DeltaChip delta={emp.score_delta} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB: ALERTAS ── */}
        {activeTab === 'alertas' && (
          <div>
            {empleados.filter(e => e.alertas.length > 0).length === 0 ? (
              <div style={{ textAlign:'center', padding:40 }}>
                <div style={{ fontSize:32, marginBottom:12 }}>✅</div>
                <div style={{ color:'#22D07A', fontWeight:700 }}>Todo en orden</div>
                <div style={{ color:'#404040', fontSize:12, marginTop:4 }}>
                  Sin alertas activas en el equipo
                </div>
              </div>
            ) : (
              empleados.filter(e => e.alertas.length > 0).map(emp => (
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

      </div>

      {/* Panel detalle */}
      {empSel && <PanelEmpleado emp={empSel} onClose={() => setEmpSel(null)} />}

    </div>
  );
}
