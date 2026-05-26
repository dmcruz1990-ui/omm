import React, { useState } from 'react';
import {
  Home, TrendingUp, Users, Zap, Wine, UserCheck, CalendarDays, Settings,
  DollarSign, Receipt, Heart, Bell, ChevronRight,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   NEXUM COMMAND CENTER — vista réplica del mockup
   ────────────────────────────────────────────────────────────────────────── */

interface CommandModuleProps { onSimulateEvent?: (type: 'hand'|'task'|'finance'|'reserve') => void; }

const SIDE = [
  { id:'inicio', label:'INICIO', icon: Home },
  { id:'ventas', label:'VENTAS', icon: TrendingUp },
  { id:'clientes', label:'CLIENTES', icon: Users },
  { id:'operaciones', label:'OPERACIONES', icon: Zap },
  { id:'barra', label:'BARRA', icon: Wine },
  { id:'equipo', label:'EQUIPO', icon: UserCheck },
  { id:'reservas', label:'RESERVAS', icon: CalendarDays },
  { id:'config', label:'CONFIGURACIÓN', icon: Settings },
];

const cocina = [
  { l:'Robata',   v:85, c:'#4a8fd4' },
  { l:'Sushi',    v:92, c:'#3dba6f' },
  { l:'Caliente', v:74, c:'#f0a050' },
  { l:'Postres',  v:89, c:'#3dba6f' },
];
const barra = [
  { l:'Coctelería', v:78, c:'#f0a050' },
  { l:'Vinos',      v:95, c:'#3dba6f' },
];

const acciones = [
  'Reforzar barra de autor',
  'Confirmar 12 reservas de 8:30 p.m.',
  'Empujar productos foco',
  'Revisar demoras en cocina caliente',
  'Activar base VIP para segundo turno',
];

const quejas = [
  { l:'Demora en comida', n:4 },
  { l:'Cócteles lentos',   n:3 },
  { l:'Mesa no lista',     n:2 },
  { l:'Servicio lento',    n:2 },
  { l:'Cuenta demorada',   n:1 },
];

const mix = [
  { l:'Comida',   p:39, c:'#3dba6f' },
  { l:'Bebidas',  p:28, c:'#4a8fd4' },
  { l:'Postres',  p:15, c:'#f0a050' },
  { l:'Cócteles', p:14, c:'#c66de8' },
];

const ayer = [
  { l:'Venta ayer',         v:'$58.4M', sub:'9% sobre meta' },
  { l:'Ticket promedio',    v:'$179K' },
  { l:'Personas atendidas', v:'286' },
  { l:'Ocupación',          v:'88%' },
  { l:'Satisfacción',       v:'92%' },
  { l:'Número de quejas',   v:'6' },
  { l:'Cuello de botella',  v:'cocina caliente' },
  { l:'Mejor empleado',     v:'Laura M.' },
];

const topEmp = [
  { n:'Laura',   s:96 },
  { n:'Andrés',  s:93 },
  { n:'Camila',  s:91 },
];
const alertaEmp = [
  { n:'Pedro',   s:58, m:'Errores' },
  { n:'María',   s:61, m:'Bajo ticket' },
  { n:'Carlos',  s:64, m:'Quejas' },
];
const topPlatos = [
  { n:'Dumplings Trufados', v:48 },
  { n:'Tiradito Hamachi',   v:36 },
  { n:'Robata Lobster',     v:29 },
];
const topBebidas = [
  { n:'Negroni Sakura', v:41 },
  { n:'Lychee Martini', v:37 },
  { n:'Spritz Yuzu',    v:30 },
];

function PieMix({ data }:{ data:{l:string,p:number,c:string}[] }){
  let acc = 0;
  const stops = data.map(d=>{ const from=acc; acc+=d.p; return `${d.c} ${from}% ${acc}%`; }).join(', ');
  return <div className="w-[110px] h-[110px] rounded-full" style={{background:`conic-gradient(${stops})`, boxShadow:'inset 0 0 0 2px #0a0e1a'}}/>;
}

function Card({ children, className='' }:{ children:React.ReactNode, className?:string }){
  return <div className={`rounded-2xl bg-[#0e1424] border border-[#1a2030] p-4 ${className}`}>{children}</div>;
}

function Bar({ pct, color }:{ pct:number, color:string }){
  return <div className="h-1.5 rounded-full bg-[#1a2030] overflow-hidden"><div className="h-full rounded-full" style={{width:`${pct}%`, background:color}}/></div>;
}

const CommandModule: React.FC<CommandModuleProps> = () => {
  const [active, setActive] = useState('inicio');

  return (
    <div className="-m-6 bg-[#06080f] text-white min-h-[calc(100vh-64px)] flex" style={{fontFamily:'Inter, system-ui, sans-serif'}}>
      {/* ═══ SIDEBAR ═══ */}
      <aside className="w-[90px] shrink-0 bg-[#0a0e1a] border-r border-[#141b2c] flex flex-col items-center py-4">
        <div className="text-center mb-6">
          <div className="text-[10px] font-black tracking-[0.15em]">NEXUM</div>
          <div className="text-[8px] tracking-[0.3em] text-[#5a6478]">COMMAND</div>
        </div>
        <div className="flex-1 flex flex-col gap-1 w-full px-2">
          {SIDE.map(item=>{
            const Icon = item.icon; const isActive = active===item.id;
            return (
              <button key={item.id} onClick={()=>setActive(item.id)}
                className={`flex flex-col items-center gap-1 py-3 rounded-lg transition-all ${isActive ? 'bg-[#142a4a] text-[#4a9fff]' : 'text-[#5a6478] hover:text-[#a0a9bd]'}`}>
                <Icon size={18}/>
                <span className="text-[8px] font-bold tracking-wider">{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 w-9 h-9 rounded-lg bg-[#142a4a] text-[#4a9fff] flex items-center justify-center font-black text-[14px]">N</div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className="flex-1 p-5 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[18px] font-black tracking-tight">NEXUM COMMAND CENTER</h1>
            <div className="flex items-center gap-2 text-[11px] text-[#7a8499]">
              <span>Robata 114</span>
              <span>·</span>
              <span className="flex items-center gap-1">En vivo <span className="w-1.5 h-1.5 rounded-full bg-[#3dba6f] inline-block animate-pulse"/></span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div>
              <div className="text-[13px] font-bold">8:28 p.m.</div>
              <div className="text-[10px] text-[#7a8499]">24 de mayo, 2025</div>
            </div>
            <button className="w-8 h-8 rounded-full bg-[#0e1424] border border-[#1a2030] flex items-center justify-center text-[#7a8499]"><Bell size={14}/></button>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0e1424] border border-[#1a2030]">
              <div className="w-6 h-6 rounded-full bg-[#4a9fff] flex items-center justify-center text-[10px] font-black text-black">GM</div>
              <ChevronRight size={12} className="text-[#5a6478] rotate-90"/>
            </div>
          </div>
        </div>

        {/* ═══ 5 KPI CARDS ═══ */}
        <div className="grid grid-cols-5 gap-3 mb-3">
          <Card>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[9px] tracking-[0.15em] text-[#7a8499] font-bold">VENTA HOY</div>
              <div className="w-7 h-7 rounded-full bg-[#3dba6f]/15 flex items-center justify-center"><DollarSign size={14} className="text-[#3dba6f]"/></div>
            </div>
            <div className="text-[28px] font-black tracking-tight leading-none mb-2">$42.5M</div>
            <div className="space-y-0.5 text-[10px] text-[#7a8499]">
              <div>● Meta: $50M</div>
              <div>● Cumplimiento: 85%</div>
              <div>● Costo día: 32% · $13.8M</div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[9px] tracking-[0.15em] text-[#7a8499] font-bold">VENTA MES</div>
              <div className="w-7 h-7 rounded-full bg-[#3dba6f]/15 flex items-center justify-center"><TrendingUp size={14} className="text-[#3dba6f]"/></div>
            </div>
            <div className="text-[28px] font-black tracking-tight leading-none mb-2">$780M</div>
            <div className="space-y-0.5 text-[10px] text-[#7a8499]">
              <div>● Meta: $1.2B</div>
              <div>● Cumplimiento: 85%</div>
              <div>● Costo mes: 31.8% · $248M</div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[9px] tracking-[0.15em] text-[#7a8499] font-bold">TICKET PROMEDIO</div>
              <div className="w-7 h-7 rounded-full bg-[#c66de8]/15 flex items-center justify-center"><Receipt size={14} className="text-[#c66de8]"/></div>
            </div>
            <div className="text-[28px] font-black tracking-tight leading-none mb-2">$185K</div>
            <div className="text-[10px] text-[#7a8499]">Mes: $172K</div>
          </Card>
          <Card>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[9px] tracking-[0.15em] text-[#7a8499] font-bold">COMENSALES</div>
              <div className="w-7 h-7 rounded-full bg-[#f0a050]/15 flex items-center justify-center"><Users size={14} className="text-[#f0a050]"/></div>
            </div>
            <div className="text-[28px] font-black tracking-tight leading-none mb-2 text-[#f0a050]">238</div>
            <div className="space-y-0.5 text-[10px] text-[#7a8499]">
              <div>Mes: 6,820</div>
              <div>Esperados hoy: 310</div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[9px] tracking-[0.15em] text-[#7a8499] font-bold">HEALTH SCORE</div>
              <div className="w-7 h-7 rounded-full bg-[#3dba6f]/15 flex items-center justify-center"><Heart size={14} className="text-[#3dba6f]"/></div>
            </div>
            <div className="text-[28px] font-black tracking-tight leading-none mb-1">87/100</div>
            <div className="text-[10px] text-[#f0a050] mb-1.5">Sano, revisar cocina</div>
            <div className="flex gap-2 text-[9px] text-[#7a8499] flex-wrap">
              <span>Ventas:<span className="text-white font-bold">88</span></span>
              <span>Clientes:<span className="text-white font-bold">84</span></span>
              <span>Op:<span className="text-white font-bold">81</span></span>
              <span>Equipo:<span className="text-white font-bold">89</span></span>
            </div>
          </Card>
        </div>

        {/* ═══ ROW 2: GUEST PULSE · OPERATION FLOW · NEXUM BRAIN ═══ */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-[#4a9fff]"/>
              <div className="text-[11px] font-black tracking-[0.15em] text-[#4a9fff]">GUEST PULSE</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[9px] text-[#7a8499] mb-1">OCUPACIÓN</div>
                <div className="text-[26px] font-black text-[#3dba6f] leading-none mb-2">82%</div>
                <div className="space-y-0.5 text-[10px] text-[#7a8499]">
                  <div>Hora pico: 8:30 pm</div>
                  <div>Mesas libres: 6</div>
                  <div>Reservas pendientes: 12</div>
                  <div>Rotación mesas: 1.8x</div>
                </div>
              </div>
              <div>
                <div className="text-[9px] text-[#7a8499] mb-1">SATISFACCIÓN CLIENTE</div>
                <div className="text-[26px] font-black text-[#3dba6f] leading-none mb-2">94%</div>
                <div className="space-y-0.5 text-[10px] text-[#7a8499]">
                  <div>hoy / actual</div>
                  <div>Mes: 91%</div>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-[#4a9fff]"/>
              <div className="text-[11px] font-black tracking-[0.15em] text-[#4a9fff]">OPERATION FLOW</div>
            </div>
            <div className="text-[9px] text-[#7a8499] mb-1.5 font-bold tracking-wider">EFICIENCIA COCINA</div>
            <div className="space-y-1.5 mb-2">
              {cocina.map(r=>(
                <div key={r.l}>
                  <div className="flex justify-between text-[10px] mb-0.5"><span>{r.l}</span><span className="text-[#a0a9bd] font-bold">{r.v}%</span></div>
                  <Bar pct={r.v} color={r.c}/>
                </div>
              ))}
            </div>
            <div className="text-[9px] text-[#7a8499] mb-2">Primer plato: <span className="text-white">18 min</span> · Pedidos atrasados: <span className="text-[#e05050]">6</span></div>
            <div className="text-[9px] text-[#7a8499] mb-1.5 font-bold tracking-wider">EFICIENCIA BARRA</div>
            <div className="space-y-1.5 mb-2">
              {barra.map(r=>(
                <div key={r.l}>
                  <div className="flex justify-between text-[10px] mb-0.5"><span>{r.l}</span><span className="text-[#a0a9bd] font-bold">{r.v}%</span></div>
                  <Bar pct={r.v} color={r.c}/>
                </div>
              ))}
            </div>
            <div className="text-[9px] text-[#7a8499]">Primera bebida: <span className="text-white">7 min</span> · Bebidas atrasadas: <span className="text-[#e05050]">4</span></div>
          </Card>

          <div className="rounded-2xl p-4 relative overflow-hidden" style={{background:'linear-gradient(135deg, #1f2454 0%, #3a2a6e 50%, #5a3a7e 100%)', border:'1px solid #4a3a78'}}>
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full" style={{background:'radial-gradient(circle, rgba(150,100,220,0.3), transparent)'}}/>
            <div className="flex items-center gap-2 mb-2 relative">
              <Zap size={16} className="text-[#c0a8ff]"/>
              <div className="text-[12px] font-black tracking-[0.15em] text-white">NEXUM BRAIN</div>
            </div>
            <div className="text-[10px] text-[#c0b8e8] tracking-wider mb-3 font-bold">QUÉ HACER AHORA</div>
            <ol className="space-y-1.5 mb-4 relative">
              {acciones.map((a,i)=>(
                <li key={i} className="flex items-start gap-2 text-[11px] text-white/95">
                  <span className="w-4 h-4 rounded-full bg-white/15 flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">{i+1}</span>
                  <span>{a}</span>
                </li>
              ))}
            </ol>
            <button className="w-full py-2 rounded-lg text-[11px] font-black text-white relative" style={{background:'linear-gradient(90deg, #4a4ae8, #6a4ad8)'}}>VER PLAN</button>
          </div>
        </div>

        {/* ═══ ROW 3 ═══ */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Card>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-black tracking-[0.15em] text-[#e05050] mb-2">PRINCIPALES QUEJAS HOY</div>
                <ul className="space-y-1.5">
                  {quejas.map((q,i)=>(
                    <li key={i} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#e05050]"/>{q.l}</span>
                      <span className="text-[#a0a9bd] font-bold">{q.n}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[10px] font-black tracking-[0.15em] text-[#7a8499] mb-2">MIX VENTAS HOY</div>
                <div className="flex items-center gap-3">
                  <PieMix data={mix}/>
                  <ul className="space-y-1">
                    {mix.map(m=>(
                      <li key={m.l} className="flex items-center gap-1.5 text-[10px]">
                        <span className="w-2 h-2 rounded-sm" style={{background:m.c}}/>
                        <span className="text-[#a0a9bd]">{m.l}</span>
                        <span className="text-white font-bold">{m.p}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="text-[10px] font-black tracking-[0.15em] text-[#7a8499] mb-2">QUÉ PASÓ AYER</div>
            <ul className="space-y-1">
              {ayer.map((a,i)=>(
                <li key={i} className="flex justify-between text-[11px]">
                  <span className="text-[#a0a9bd]">{a.l}</span>
                  <span className="text-white font-bold">{a.v}{a.sub?<span className="text-[#3dba6f] ml-1 font-normal">{a.sub}</span>:null}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 pt-2 border-t border-[#1a2030] text-[10px] text-[#f0a050]">
              ⚑ Recomendación hoy: <span className="italic">reforzar cocina caliente 8:00–9:30 p.m.</span>
            </div>
          </Card>
        </div>

        {/* ═══ ROW 4 ═══ */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <div className="text-[10px] font-black tracking-[0.15em] text-[#3dba6f] mb-2">TOP EMPLEADOS</div>
            <ul className="space-y-1.5">
              {topEmp.map((e,i)=>(
                <li key={e.n} className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-2"><span className="w-4 text-[#7a8499] text-[10px]">{i+1}</span>{e.n}</span>
                  <span className="font-black text-[#3dba6f]">{e.s}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <div className="text-[10px] font-black tracking-[0.15em] text-[#e05050] mb-2">TALENTO EN ALERTA</div>
            <ul className="space-y-1.5">
              {alertaEmp.map((e,i)=>(
                <li key={e.n} className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-2"><span className="w-4 text-[#7a8499] text-[10px]">{i+1}</span>{e.n}</span>
                  <span className="flex items-center gap-2"><span className="font-black text-[#e05050]">{e.s}</span><span className="text-[10px] text-[#7a8499]">{e.m}</span></span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <div className="text-[10px] font-black tracking-[0.15em] text-[#7a8499] mb-2">TOP VENTAS HOY</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[9px] text-[#7a8499] mb-1 tracking-wider font-bold">TOP 3 PLATOS</div>
                <ul className="space-y-1">
                  {topPlatos.map((p,i)=>(
                    <li key={p.n} className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1.5 truncate"><span className="text-[#7a8499]">{i+1}</span>{p.n}</span>
                      <span className="font-black text-white">{p.v}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[9px] text-[#7a8499] mb-1 tracking-wider font-bold">TOP 3 BEBIDAS</div>
                <ul className="space-y-1">
                  {topBebidas.map((p,i)=>(
                    <li key={p.n} className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1.5 truncate"><span className="text-[#7a8499]">{i+1}</span>{p.n}</span>
                      <span className="font-black text-white">{p.v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default CommandModule;
