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
  const [activeTab, setActiveTab] = useState<'equipo'|'ranking'|'alertas'|'propinas'|'euros'|'vida'>('equipo');

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
            { id:'euros',    icon:Award,    label:'Euros App' },
{ id:'vida',     icon:Brain,    label:'Seratta Life 🚀' },
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

    </div>
  );
}
