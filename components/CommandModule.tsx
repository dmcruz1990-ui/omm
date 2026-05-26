import React, { useState } from 'react';
import {
  Home, TrendingUp, Users, Zap, Wine, UserCheck, CalendarDays, Settings,
  DollarSign, Receipt, Heart, Bell, ChevronRight, Star, Cake, AlertTriangle,
  Coffee, Utensils, Clock, CheckCircle2, XCircle, Package, ShieldCheck,
  Crown, UserPlus, UserX, Flame, Award,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   NEXUM COMANDANTE — Centro de mando con 8 vistas
   ────────────────────────────────────────────────────────────────────────── */

interface CommandModuleProps { onSimulateEvent?: (type: 'hand'|'task'|'finance'|'reserve') => void; }

type ViewId = 'inicio'|'ventas'|'clientes'|'operaciones'|'barra'|'equipo'|'reservas'|'config';

const SIDE: { id:ViewId, label:string, icon:any }[] = [
  { id:'inicio',       label:'INICIO',         icon: Home },
  { id:'ventas',       label:'VENTAS',         icon: TrendingUp },
  { id:'clientes',     label:'CLIENTES',       icon: Users },
  { id:'operaciones',  label:'OPERACIONES',    icon: Zap },
  { id:'barra',        label:'BARRA',          icon: Wine },
  { id:'equipo',       label:'EQUIPO',         icon: UserCheck },
  { id:'reservas',     label:'RESERVAS',       icon: CalendarDays },
  { id:'config',       label:'CONFIGURACIÓN',  icon: Settings },
];

/* ═══ Helpers ═══ */
function Card({ children, className='' }:{ children:React.ReactNode, className?:string }){
  return <div className={`rounded-2xl bg-[#0e1424] border border-[#1a2030] p-4 ${className}`}>{children}</div>;
}
function Bar({ pct, color }:{ pct:number, color:string }){
  return <div className="h-1.5 rounded-full bg-[#1a2030] overflow-hidden"><div className="h-full rounded-full" style={{width:`${Math.min(100,pct)}%`, background:color}}/></div>;
}
function PieMix({ data }:{ data:{l:string,p:number,c:string}[] }){
  let acc=0; const stops=data.map(d=>{ const from=acc; acc+=d.p; return `${d.c} ${from}% ${acc}%`; }).join(', ');
  return <div className="w-[110px] h-[110px] rounded-full" style={{background:`conic-gradient(${stops})`, boxShadow:'inset 0 0 0 2px #0a0e1a'}}/>;
}
function Section({ title, color='#7a8499', icon:Icon, children, className='' }:{ title:string, color?:string, icon?:any, children:React.ReactNode, className?:string }){
  return (
    <Card className={className}>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon size={13} style={{color}}/>}
        <div className="text-[10px] font-black tracking-[0.15em]" style={{color}}>{title}</div>
      </div>
      {children}
    </Card>
  );
}
function KPI({ label, value, sub, color='#fff', icon:Icon, iconColor='#3dba6f' }:{ label:string, value:string, sub?:React.ReactNode, color?:string, icon?:any, iconColor?:string }){
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[9px] tracking-[0.15em] text-[#7a8499] font-bold">{label}</div>
        {Icon && <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{background:`${iconColor}26`}}><Icon size={14} style={{color:iconColor}}/></div>}
      </div>
      <div className="text-[26px] font-black tracking-tight leading-none mb-1" style={{color}}>{value}</div>
      {sub && <div className="text-[10px] text-[#7a8499] space-y-0.5">{sub}</div>}
    </Card>
  );
}

/* ═══ Datasets demo (consistentes con la marca) ═══ */
const cocina = [
  { l:'Robata',v:85,c:'#4a8fd4' },{ l:'Sushi',v:92,c:'#3dba6f' },{ l:'Caliente',v:74,c:'#f0a050' },{ l:'Postres',v:89,c:'#3dba6f' },
];
const barra = [
  { l:'Coctelería',v:78,c:'#f0a050' },{ l:'Vinos',v:95,c:'#3dba6f' },
];
const accionesAI = [
  'Reforzar barra de autor',
  'Confirmar 12 reservas de 8:30 p.m.',
  'Empujar productos foco',
  'Revisar demoras en cocina caliente',
  'Activar base VIP para segundo turno',
];
const quejas = [
  { l:'Demora en comida', n:4 },{ l:'Cócteles lentos', n:3 },{ l:'Mesa no lista', n:2 },{ l:'Servicio lento', n:2 },{ l:'Cuenta demorada', n:1 },
];
const mix = [
  { l:'Comida',p:39,c:'#3dba6f' },{ l:'Bebidas',p:28,c:'#4a8fd4' },{ l:'Postres',p:15,c:'#f0a050' },{ l:'Cócteles',p:14,c:'#c66de8' },
];
const ayer = [
  { l:'Venta ayer',v:'$58.4M',sub:'9% sobre meta' },{ l:'Ticket promedio',v:'$179K' },{ l:'Personas atendidas',v:'286' },{ l:'Ocupación',v:'88%' },{ l:'Satisfacción',v:'92%' },{ l:'Número de quejas',v:'6' },{ l:'Cuello de botella',v:'cocina caliente' },{ l:'Mejor empleado',v:'Laura M.' },
];
const topEmp = [{ n:'Laura',s:96 },{ n:'Andrés',s:93 },{ n:'Camila',s:91 }];
const alertaEmp = [{ n:'Pedro',s:58,m:'Errores' },{ n:'María',s:61,m:'Bajo ticket' },{ n:'Carlos',s:64,m:'Quejas' }];
const topPlatos = [{ n:'Dumplings Trufados',v:48 },{ n:'Tiradito Hamachi',v:36 },{ n:'Robata Lobster',v:29 }];
const topBebidas = [{ n:'Negroni Sakura',v:41 },{ n:'Lychee Martini',v:37 },{ n:'Spritz Yuzu',v:30 }];

// VENTAS
const ventasHora = [
  { h:'12:00',v:1.2 },{ h:'13:00',v:2.8 },{ h:'14:00',v:3.6 },{ h:'15:00',v:2.1 },{ h:'16:00',v:1.4 },{ h:'17:00',v:2.0 },
  { h:'18:00',v:3.2 },{ h:'19:00',v:5.1 },{ h:'20:00',v:7.4 },{ h:'21:00',v:8.6 },{ h:'22:00',v:5.1 },
];
const metodosPago = [
  { l:'Tarjeta crédito', p:48, c:'#4a8fd4' },
  { l:'Datáfono débito', p:24, c:'#3dba6f' },
  { l:'Efectivo',        p:14, c:'#f0a050' },
  { l:'Transferencia',   p:9,  c:'#c66de8' },
  { l:'PSE/Bancolombia', p:5,  c:'#e05050' },
];
const ventasCat = [
  { l:'Robata',     v:'$14.2M', pct:33 },
  { l:'Sushi',      v:'$10.8M', pct:25 },
  { l:'Cócteles',   v:'$8.1M',  pct:19 },
  { l:'Vinos',      v:'$5.4M',  pct:13 },
  { l:'Postres',    v:'$2.6M',  pct:6  },
  { l:'Otros',      v:'$1.4M',  pct:4  },
];

// CLIENTES
const segmentos = [
  { l:'Champion',         n:84,  pct:18, c:'#d4943a' },
  { l:'Loyal',            n:142, pct:30, c:'#3dba6f' },
  { l:'Potential',        n:96,  pct:21, c:'#4a8fd4' },
  { l:'New',              n:62,  pct:13, c:'#c66de8' },
  { l:'At risk',          n:48,  pct:10, c:'#f0a050' },
  { l:'About to sleep',   n:36,  pct:8,  c:'#e05050' },
];
const topVIP = [
  { n:'Carolina Mejía',     v:'$3.8M', visitas:14, badge:'Champion' },
  { n:'Ricardo Vélez',      v:'$3.1M', visitas:11, badge:'Champion' },
  { n:'Sofía Hernández',    v:'$2.6M', visitas:9,  badge:'Loyal' },
  { n:'Andrés Restrepo',    v:'$2.2M', visitas:8,  badge:'Loyal' },
  { n:'Valeria Cortés',     v:'$1.9M', visitas:7,  badge:'Loyal' },
];
const cumples = [
  { n:'Daniel Ortega',  d:'26 may' }, { n:'Lina Pardo',  d:'27 may' }, { n:'Mateo Castaño', d:'29 may' }, { n:'Jimena Soto',  d:'31 may' },
];
const enRiesgo = [
  { n:'Felipe Acosta',     u:'45 días sin visitar', t:'-$1.4M' },
  { n:'Camila Restrepo',   u:'52 días sin visitar', t:'-$980K' },
  { n:'José Manuel Pérez', u:'68 días sin visitar', t:'-$760K' },
];

// OPERACIONES
const estaciones = [
  { l:'Pase frío',     tprom:8,   target:10, status:'ok' },
  { l:'Pase caliente', tprom:18,  target:14, status:'alert' },
  { l:'Robata',        tprom:12,  target:14, status:'ok' },
  { l:'Sushi',         tprom:9,   target:12, status:'ok' },
  { l:'Postres',       tprom:7,   target:10, status:'ok' },
  { l:'Barra',         tprom:7,   target:8,  status:'ok' },
];
const tiemposMomento = [
  { l:'Greeting',       t:'1.8 min',  target:'< 2 min',  ok:true },
  { l:'Toma de orden',  t:'5.4 min',  target:'< 6 min',  ok:true },
  { l:'Primera bebida', t:'7.2 min',  target:'< 8 min',  ok:true },
  { l:'Primer plato',   t:'18 min',   target:'< 16 min', ok:false },
  { l:'Postre',         t:'9 min',    target:'< 10 min', ok:true },
  { l:'Cuenta',         t:'4.1 min',  target:'< 5 min',  ok:true },
];
const lista86 = [
  { n:'Ostras Kumamoto', m:'Sin stock proveedor' },
  { n:'Wagyu A5',        m:'Agotado · vuelve viernes' },
  { n:'Erizo Hokkaido',  m:'Calidad rechazada' },
  { n:'Botella Krug 2008', m:'Última botella vendida' },
];

// BARRA
const cocteles = [
  { n:'Negroni Sakura',  v:41, margen:'72%' },
  { n:'Lychee Martini',  v:37, margen:'68%' },
  { n:'Spritz Yuzu',     v:30, margen:'70%' },
  { n:'Mezcal Smoked',   v:24, margen:'74%' },
  { n:'Old Fashioned',   v:22, margen:'76%' },
];
const vinos = [
  { n:'Catena Malbec',         v:18, copas:24 },
  { n:'Prosecco DOC',          v:15, copas:0  },
  { n:'Sauvignon Blanc Casas', v:14, copas:18 },
  { n:'Chateau Beychevelle',   v:6,  copas:0  },
];
const licoresCriticos = [
  { n:'Gin Hendricks',     stock:'2 botellas',   alerta:'crítico' },
  { n:'Mezcal Del Maguey', stock:'1 botella',    alerta:'crítico' },
  { n:'Vermouth Carpano',  stock:'4 botellas',   alerta:'medio' },
  { n:'Tequila Clase Azul',stock:'3 botellas',   alerta:'medio' },
];

// EQUIPO
const equipoHoy = [
  { n:'Laura Villalobos', r:'Maître',    turno:'17:00–23:00', estado:'presente',  score:96 },
  { n:'Andrés Felipe Mora', r:'Mesero',  turno:'17:00–23:00', estado:'presente',  score:93 },
  { n:'Camila Rodríguez', r:'Bartender', turno:'18:00–01:00', estado:'tarde 12m', score:91 },
  { n:'Mateo Herrera',    r:'Mesero Sr', turno:'17:00–23:00', estado:'presente',  score:88 },
  { n:'Esteban Salazar',  r:'Sommelier', turno:'17:00–23:00', estado:'presente',  score:96 },
  { n:'Carlos Méndez',    r:'Cocinero',  turno:'11:00–18:00', estado:'incapacidad',score:68 },
];
const cumplesEquipo = [
  { n:'Diego Ramírez',  d:'27 may' },
  { n:'Valentina Pardo',d:'02 jun' },
  { n:'Santiago León',  d:'06 jun' },
];

// RESERVAS
const reservasHoy = [
  { h:'19:00', n:'Carolina Mejía',  pax:4, mesa:'M12', vip:true,  estado:'confirmada' },
  { h:'19:30', n:'Andrés Restrepo', pax:2, mesa:'M07', vip:false, estado:'confirmada' },
  { h:'20:00', n:'Sofía Hernández', pax:6, mesa:'M21', vip:true,  estado:'confirmada' },
  { h:'20:30', n:'Ricardo Vélez',   pax:2, mesa:'M03', vip:true,  estado:'pendiente'  },
  { h:'21:00', n:'Daniel Ortega',   pax:8, mesa:'M30', vip:false, estado:'pendiente'  },
  { h:'21:30', n:'Lina Pardo',      pax:2, mesa:'M05', vip:false, estado:'confirmada' },
  { h:'22:00', n:'Mateo Castaño',   pax:4, mesa:'M16', vip:false, estado:'walk-in?'   },
];
const proximas7 = [
  { d:'mar 26', n:32 }, { d:'mié 27', n:28 }, { d:'jue 28', n:35 }, { d:'vie 29', n:58 }, { d:'sáb 30', n:64 }, { d:'dom 31', n:42 },
];

// CONFIG
const restauranteInfo = [
  { l:'Nombre',         v:'Robata 114' },
  { l:'Marca',          v:'Seratta Group' },
  { l:'Ciudad',         v:'Bogotá, Colombia' },
  { l:'Aforo',          v:'120 cubiertos' },
  { l:'Mesas',          v:'34 (servicio) · 12 (terraza)' },
  { l:'Zona horaria',   v:'America/Bogotá (UTC-5)' },
  { l:'Cuenta NEXUM',   v:'Cliente Premium · v2026.05' },
];
const horarios = [
  { d:'Lunes',     a:'12:00–15:30', c:'18:00–23:00' },
  { d:'Martes',    a:'12:00–15:30', c:'18:00–23:00' },
  { d:'Miércoles', a:'12:00–15:30', c:'18:00–23:00' },
  { d:'Jueves',    a:'12:00–15:30', c:'18:00–00:00' },
  { d:'Viernes',   a:'12:00–15:30', c:'18:00–01:00' },
  { d:'Sábado',    a:'12:00–16:00', c:'18:00–01:00' },
  { d:'Domingo',   a:'12:00–17:00', c:'cerrado' },
];
const integraciones = [
  { n:'POS NEXUM',         estado:'conectado', color:'#3dba6f' },
  { n:'DIAN · UBL 2.1',    estado:'conectado', color:'#3dba6f' },
  { n:'Bancolombia API',   estado:'conectado', color:'#3dba6f' },
  { n:'Datáfono Redeban',  estado:'conectado', color:'#3dba6f' },
  { n:'WhatsApp Business', estado:'conectado', color:'#3dba6f' },
  { n:'Bookings sync',     estado:'pendiente', color:'#f0a050' },
  { n:'Mailing Mailchimp', estado:'desconect.',color:'#e05050' },
];
const roles = [
  { r:'Administrador',  n:2 }, { r:'Gerencia',  n:4 }, { r:'Maître',  n:1 }, { r:'Meseros',  n:9 }, { r:'Cocina',  n:7 }, { r:'Barra',  n:3 }, { r:'Caja',  n:2 },
];

const CommandModule: React.FC<CommandModuleProps> = () => {
  const [active, setActive] = useState<ViewId>('inicio');

  const titulo: Record<ViewId,string> = {
    inicio:'NEXUM COMANDANTE',
    ventas:'VENTAS · Análisis comercial',
    clientes:'CLIENTES · CRM operativo',
    operaciones:'OPERACIONES · Tiempos y servicio',
    barra:'BARRA · Coctelería · Vinos · Inventario',
    equipo:'EQUIPO · Roster del día',
    reservas:'RESERVAS · Hoy y próximos días',
    config:'CONFIGURACIÓN · Restaurante y sistema',
  };

  return (
    <div className="-m-6 bg-[#06080f] text-white min-h-[calc(100vh-64px)] flex" style={{fontFamily:'Inter, system-ui, sans-serif'}}>
      {/* ═══ SIDEBAR ═══ */}
      <aside className="w-[90px] shrink-0 bg-[#0a0e1a] border-r border-[#141b2c] flex flex-col items-center py-4">
        <div className="text-center mb-6">
          <div className="text-[10px] font-black tracking-[0.15em]">NEXUM</div>
          <div className="text-[8px] tracking-[0.3em] text-[#5a6478]">COMANDANTE</div>
        </div>
        <div className="flex-1 flex flex-col gap-1 w-full px-2">
          {SIDE.map(item=>{
            const Icon=item.icon; const isActive=active===item.id;
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
            <h1 className="text-[18px] font-black tracking-tight">{titulo[active]}</h1>
            <div className="flex items-center gap-2 text-[11px] text-[#7a8499]">
              <span>Robata 114</span><span>·</span>
              <span className="flex items-center gap-1">En vivo <span className="w-1.5 h-1.5 rounded-full bg-[#3dba6f] inline-block animate-pulse"/></span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div><div className="text-[13px] font-bold">8:28 p.m.</div><div className="text-[10px] text-[#7a8499]">24 de mayo, 2025</div></div>
            <button className="w-8 h-8 rounded-full bg-[#0e1424] border border-[#1a2030] flex items-center justify-center text-[#7a8499]"><Bell size={14}/></button>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0e1424] border border-[#1a2030]">
              <div className="w-6 h-6 rounded-full bg-[#4a9fff] flex items-center justify-center text-[10px] font-black text-black">GM</div>
              <ChevronRight size={12} className="text-[#5a6478] rotate-90"/>
            </div>
          </div>
        </div>

        {/* ═══════════════ INICIO ═══════════════ */}
        {active==='inicio' && (<>
          <div className="grid grid-cols-5 gap-3 mb-3">
            <KPI label="VENTA HOY"       value="$42.5M" icon={DollarSign}  iconColor="#3dba6f" sub={<><div>● Meta: $50M</div><div>● Cumplimiento: 85%</div><div>● Costo día: 32% · $13.8M</div></>}/>
            <KPI label="VENTA MES"       value="$780M"  icon={TrendingUp}  iconColor="#3dba6f" sub={<><div>● Meta: $1.2B</div><div>● Cumplimiento: 85%</div><div>● Costo mes: 31.8% · $248M</div></>}/>
            <KPI label="TICKET PROMEDIO" value="$185K"  icon={Receipt}     iconColor="#c66de8" sub={<div>Mes: $172K</div>}/>
            <KPI label="COMENSALES"      value="238"    color="#f0a050"    icon={Users}        iconColor="#f0a050" sub={<><div>Mes: 6,820</div><div>Esperados hoy: 310</div></>}/>
            <KPI label="HEALTH SCORE"    value="87/100" icon={Heart}       iconColor="#3dba6f"
                 sub={<><div className="text-[#f0a050]">Sano, revisar cocina</div><div className="flex gap-2 flex-wrap text-[9px]"><span>Ventas:<span className="text-white font-bold">88</span></span><span>Clientes:<span className="text-white font-bold">84</span></span><span>Op:<span className="text-white font-bold">81</span></span><span>Equipo:<span className="text-white font-bold">89</span></span></div></>}/>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <Section title="GUEST PULSE" color="#4a9fff" icon={Users}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[9px] text-[#7a8499] mb-1">OCUPACIÓN</div>
                  <div className="text-[26px] font-black text-[#3dba6f] leading-none mb-2">82%</div>
                  <div className="space-y-0.5 text-[10px] text-[#7a8499]"><div>Hora pico: 8:30 pm</div><div>Mesas libres: 6</div><div>Reservas pendientes: 12</div><div>Rotación mesas: 1.8x</div></div>
                </div>
                <div>
                  <div className="text-[9px] text-[#7a8499] mb-1">SATISFACCIÓN CLIENTE</div>
                  <div className="text-[26px] font-black text-[#3dba6f] leading-none mb-2">94%</div>
                  <div className="space-y-0.5 text-[10px] text-[#7a8499]"><div>hoy / actual</div><div>Mes: 91%</div></div>
                </div>
              </div>
            </Section>
            <Section title="OPERATION FLOW" color="#4a9fff" icon={Zap}>
              <div className="text-[9px] text-[#7a8499] mb-1.5 font-bold tracking-wider">EFICIENCIA COCINA</div>
              <div className="space-y-1.5 mb-2">{cocina.map(r=>(<div key={r.l}><div className="flex justify-between text-[10px] mb-0.5"><span>{r.l}</span><span className="text-[#a0a9bd] font-bold">{r.v}%</span></div><Bar pct={r.v} color={r.c}/></div>))}</div>
              <div className="text-[9px] text-[#7a8499] mb-2">Primer plato: <span className="text-white">18 min</span> · Pedidos atrasados: <span className="text-[#e05050]">6</span></div>
              <div className="text-[9px] text-[#7a8499] mb-1.5 font-bold tracking-wider">EFICIENCIA BARRA</div>
              <div className="space-y-1.5 mb-2">{barra.map(r=>(<div key={r.l}><div className="flex justify-between text-[10px] mb-0.5"><span>{r.l}</span><span className="text-[#a0a9bd] font-bold">{r.v}%</span></div><Bar pct={r.v} color={r.c}/></div>))}</div>
              <div className="text-[9px] text-[#7a8499]">Primera bebida: <span className="text-white">7 min</span> · Bebidas atrasadas: <span className="text-[#e05050]">4</span></div>
            </Section>
            <div className="rounded-2xl p-4 relative overflow-hidden" style={{background:'linear-gradient(135deg, #1f2454 0%, #3a2a6e 50%, #5a3a7e 100%)', border:'1px solid #4a3a78'}}>
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full" style={{background:'radial-gradient(circle, rgba(150,100,220,0.3), transparent)'}}/>
              <div className="flex items-center gap-2 mb-2 relative"><Zap size={16} className="text-[#c0a8ff]"/><div className="text-[12px] font-black tracking-[0.15em] text-white">NEXUM BRAIN</div></div>
              <div className="text-[10px] text-[#c0b8e8] tracking-wider mb-3 font-bold">QUÉ HACER AHORA</div>
              <ol className="space-y-1.5 mb-4 relative">{accionesAI.map((a,i)=>(<li key={i} className="flex items-start gap-2 text-[11px] text-white/95"><span className="w-4 h-4 rounded-full bg-white/15 flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">{i+1}</span><span>{a}</span></li>))}</ol>
              <button className="w-full py-2 rounded-lg text-[11px] font-black text-white relative" style={{background:'linear-gradient(90deg, #4a4ae8, #6a4ad8)'}}>VER PLAN</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <Card>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-black tracking-[0.15em] text-[#e05050] mb-2">PRINCIPALES QUEJAS HOY</div>
                  <ul className="space-y-1.5">{quejas.map((q,i)=>(<li key={i} className="flex items-center justify-between text-[11px]"><span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#e05050]"/>{q.l}</span><span className="text-[#a0a9bd] font-bold">{q.n}</span></li>))}</ul>
                </div>
                <div>
                  <div className="text-[10px] font-black tracking-[0.15em] text-[#7a8499] mb-2">MIX VENTAS HOY</div>
                  <div className="flex items-center gap-3">
                    <PieMix data={mix}/>
                    <ul className="space-y-1">{mix.map(m=>(<li key={m.l} className="flex items-center gap-1.5 text-[10px]"><span className="w-2 h-2 rounded-sm" style={{background:m.c}}/><span className="text-[#a0a9bd]">{m.l}</span><span className="text-white font-bold">{m.p}%</span></li>))}</ul>
                  </div>
                </div>
              </div>
            </Card>
            <Card>
              <div className="text-[10px] font-black tracking-[0.15em] text-[#7a8499] mb-2">QUÉ PASÓ AYER</div>
              <ul className="space-y-1">{ayer.map((a,i)=>(<li key={i} className="flex justify-between text-[11px]"><span className="text-[#a0a9bd]">{a.l}</span><span className="text-white font-bold">{a.v}{a.sub?<span className="text-[#3dba6f] ml-1 font-normal">{a.sub}</span>:null}</span></li>))}</ul>
              <div className="mt-2 pt-2 border-t border-[#1a2030] text-[10px] text-[#f0a050]">⚑ Recomendación hoy: <span className="italic">reforzar cocina caliente 8:00–9:30 p.m.</span></div>
            </Card>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Section title="TOP EMPLEADOS" color="#3dba6f" icon={Award}>
              <ul className="space-y-1.5">{topEmp.map((e,i)=>(<li key={e.n} className="flex items-center justify-between text-[12px]"><span className="flex items-center gap-2"><span className="w-4 text-[#7a8499] text-[10px]">{i+1}</span>{e.n}</span><span className="font-black text-[#3dba6f]">{e.s}</span></li>))}</ul>
            </Section>
            <Section title="TALENTO EN ALERTA" color="#e05050" icon={AlertTriangle}>
              <ul className="space-y-1.5">{alertaEmp.map((e,i)=>(<li key={e.n} className="flex items-center justify-between text-[12px]"><span className="flex items-center gap-2"><span className="w-4 text-[#7a8499] text-[10px]">{i+1}</span>{e.n}</span><span className="flex items-center gap-2"><span className="font-black text-[#e05050]">{e.s}</span><span className="text-[10px] text-[#7a8499]">{e.m}</span></span></li>))}</ul>
            </Section>
            <Section title="TOP VENTAS HOY" color="#7a8499">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[9px] text-[#7a8499] mb-1 tracking-wider font-bold">TOP 3 PLATOS</div>
                  <ul className="space-y-1">{topPlatos.map((p,i)=>(<li key={p.n} className="flex items-center justify-between text-[10px]"><span className="flex items-center gap-1.5 truncate"><span className="text-[#7a8499]">{i+1}</span>{p.n}</span><span className="font-black text-white">{p.v}</span></li>))}</ul>
                </div>
                <div>
                  <div className="text-[9px] text-[#7a8499] mb-1 tracking-wider font-bold">TOP 3 BEBIDAS</div>
                  <ul className="space-y-1">{topBebidas.map((p,i)=>(<li key={p.n} className="flex items-center justify-between text-[10px]"><span className="flex items-center gap-1.5 truncate"><span className="text-[#7a8499]">{i+1}</span>{p.n}</span><span className="font-black text-white">{p.v}</span></li>))}</ul>
                </div>
              </div>
            </Section>
          </div>
        </>)}

        {/* ═══════════════ VENTAS ═══════════════ */}
        {active==='ventas' && (<>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <KPI label="VENTA HOY"        value="$42.5M" icon={DollarSign} iconColor="#3dba6f" sub={<><div>vs ayer: <span className="text-[#3dba6f]">+8.4%</span></div><div>Meta: $50M · 85%</div></>}/>
            <KPI label="VENTA SEMANA"     value="$214M"  icon={TrendingUp} iconColor="#3dba6f" sub={<><div>vs sem. anterior: <span className="text-[#3dba6f]">+12%</span></div><div>Meta: $260M · 82%</div></>}/>
            <KPI label="VENTA MES"        value="$780M"  icon={TrendingUp} iconColor="#3dba6f" sub={<><div>Día 24/31</div><div>Proyección: $980M</div></>}/>
            <KPI label="TICKET PROMEDIO"  value="$185K"  icon={Receipt}    iconColor="#c66de8" sub={<><div>Mes: $172K · <span className="text-[#3dba6f]">+7.5%</span></div><div>Top: $480K (M21)</div></>}/>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Section title="VENTAS POR HORA · HOY" color="#4a9fff" icon={Clock} className="col-span-2">
              <div className="flex items-end gap-2 h-32 mt-2">
                {ventasHora.map(v=>{
                  const maxV = Math.max(...ventasHora.map(x=>x.v));
                  const h = (v.v/maxV)*100;
                  return (
                    <div key={v.h} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-[8px] text-[#a0a9bd] font-bold">${v.v}M</div>
                      <div className="w-full rounded-t-md transition-all" style={{height:`${h}%`, background:'linear-gradient(180deg, #4a9fff, #2a5fbb)', minHeight:6}}/>
                      <div className="text-[8px] text-[#5a6478]">{v.h}</div>
                    </div>
                  );
                })}
              </div>
            </Section>
            <Section title="MÉTODOS DE PAGO" color="#7a8499" icon={DollarSign}>
              <ul className="space-y-2">{metodosPago.map(m=>(
                <li key={m.l}>
                  <div className="flex justify-between text-[10px] mb-0.5"><span className="text-[#a0a9bd]">{m.l}</span><span className="text-white font-bold">{m.p}%</span></div>
                  <Bar pct={m.p*2} color={m.c}/>
                </li>
              ))}</ul>
            </Section>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Section title="VENTAS POR CATEGORÍA · MES" color="#7a8499">
              <ul className="space-y-2">{ventasCat.map(c=>(
                <li key={c.l}>
                  <div className="flex justify-between text-[11px] mb-0.5"><span>{c.l}</span><span className="text-white font-bold">{c.v} <span className="text-[#7a8499] text-[10px]">· {c.pct}%</span></span></div>
                  <Bar pct={c.pct*2.5} color="#4a9fff"/>
                </li>
              ))}</ul>
            </Section>
            <Section title="TOP 10 PLATOS · MES" color="#7a8499" icon={Utensils}>
              <ul className="space-y-1">
                {[
                  { n:'Dumplings Trufados',  v:'$8.2M', u:412 },{ n:'Tiradito Hamachi',  v:'$6.4M', u:284 },
                  { n:'Robata Lobster',      v:'$5.8M', u:148 },{ n:'Wagyu A5 Tataki',   v:'$5.2M', u:96  },
                  { n:'Sashimi Premium',     v:'$4.6M', u:188 },{ n:'Ramen Tonkotsu',    v:'$3.4M', u:312 },
                  { n:'Tartar de Atún',      v:'$2.8M', u:206 },{ n:'Pulpo Robata',      v:'$2.4M', u:144 },
                  { n:'Maki Rainbow',        v:'$2.0M', u:182 },{ n:'Pad Thai',          v:'$1.8M', u:198 },
                ].map((p,i)=>(
                  <li key={p.n} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-2 truncate"><span className="text-[#7a8499] text-[10px] w-4">{i+1}</span>{p.n}</span>
                    <span><span className="text-white font-bold">{p.v}</span> <span className="text-[10px] text-[#7a8499]">{p.u}u</span></span>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
          <Card>
            <div className="text-[10px] font-black tracking-[0.15em] text-[#3dba6f] mb-2">PROYECCIÓN CIERRE HOY</div>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div><div className="text-[10px] text-[#7a8499]">Actual</div><div className="text-[20px] font-black">$42.5M</div></div>
              <div><div className="text-[10px] text-[#7a8499]">Forecast cierre</div><div className="text-[20px] font-black text-[#3dba6f]">$54.2M</div></div>
              <div><div className="text-[10px] text-[#7a8499]">Meta</div><div className="text-[20px] font-black">$50M</div></div>
              <div><div className="text-[10px] text-[#7a8499]">Sobre meta</div><div className="text-[20px] font-black text-[#3dba6f]">+8.4%</div></div>
            </div>
          </Card>
        </>)}

        {/* ═══════════════ CLIENTES ═══════════════ */}
        {active==='clientes' && (<>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <KPI label="CLIENTES HOY"     value="238"  icon={Users}     iconColor="#3dba6f" sub={<><div>Únicos: 196</div><div>Recurrentes: 42 · <span className="text-[#3dba6f]">21%</span></div></>}/>
            <KPI label="NUEVOS HOY"       value="34"   icon={UserPlus}  iconColor="#4a9fff" sub={<><div>Capturados con celular</div><div>Mes: 412 nuevos</div></>}/>
            <KPI label="VIP ATENDIDOS"    value="18"   icon={Crown}     iconColor="#d4943a" sub={<><div>Champions: 6</div><div>Loyal: 12</div></>}/>
            <KPI label="NPS"              value="9.4"  icon={Heart}     iconColor="#3dba6f" sub={<><div>Mes: 9.1</div><div>Detractores: 2%</div></>}/>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Section title="SEGMENTACIÓN RFM" color="#4a9fff" icon={Users} className="col-span-1">
              <ul className="space-y-2">{segmentos.map(s=>(
                <li key={s.l}>
                  <div className="flex justify-between text-[11px] mb-0.5"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background:s.c}}/>{s.l}</span><span className="text-white font-bold">{s.n} · {s.pct}%</span></div>
                  <Bar pct={s.pct*3} color={s.c}/>
                </li>
              ))}</ul>
              <div className="mt-2 pt-2 border-t border-[#1a2030] text-[10px] text-[#7a8499]">Total CRM: <span className="text-white font-bold">468 clientes</span></div>
            </Section>
            <Section title="TOP VIP · MES" color="#d4943a" icon={Crown} className="col-span-2">
              <table className="w-full text-[11px]">
                <thead><tr className="text-[9px] text-[#7a8499]"><th className="text-left pb-1">#</th><th className="text-left pb-1">Cliente</th><th className="text-right pb-1">Gasto</th><th className="text-right pb-1">Visitas</th><th className="text-right pb-1">Segmento</th></tr></thead>
                <tbody>{topVIP.map((c,i)=>(
                  <tr key={c.n} className="border-t border-[#1a2030]"><td className="py-1.5 text-[#7a8499]">{i+1}</td><td className="py-1.5">{c.n}</td><td className="py-1.5 text-right font-bold">{c.v}</td><td className="py-1.5 text-right text-[#a0a9bd]">{c.visitas}</td><td className="py-1.5 text-right"><span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{background:c.badge==='Champion'?'#d4943a26':'#3dba6f26', color:c.badge==='Champion'?'#d4943a':'#3dba6f'}}>{c.badge}</span></td></tr>
                ))}</tbody>
              </table>
            </Section>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Section title="CUMPLEAÑOS ESTA SEMANA" color="#c66de8" icon={Cake}>
              <ul className="space-y-1.5">{cumples.map(c=>(
                <li key={c.n} className="flex items-center justify-between text-[12px]"><span className="flex items-center gap-2"><Cake size={14} className="text-[#c66de8]"/>{c.n}</span><span className="text-[#a0a9bd] text-[10px]">{c.d}</span></li>
              ))}</ul>
              <div className="mt-2 pt-2 border-t border-[#1a2030] text-[10px] text-[#7a8499]">Acción sugerida: <span className="text-white">enviar mensaje WhatsApp con cortesía</span></div>
            </Section>
            <Section title="CLIENTES EN RIESGO" color="#e05050" icon={UserX}>
              <ul className="space-y-1.5">{enRiesgo.map(c=>(
                <li key={c.n} className="flex items-center justify-between text-[12px]"><span><div>{c.n}</div><div className="text-[10px] text-[#7a8499]">{c.u}</div></span><span className="font-bold text-[#e05050]">{c.t}</span></li>
              ))}</ul>
              <div className="mt-2 pt-2 border-t border-[#1a2030] text-[10px] text-[#f0a050]">Acción: campaña reactivación · ofrecer mesa preferencial</div>
            </Section>
          </div>
        </>)}

        {/* ═══════════════ OPERACIONES ═══════════════ */}
        {active==='operaciones' && (<>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <KPI label="MESAS OCUPADAS"   value="28/34" color="#f0a050" icon={Utensils} iconColor="#f0a050" sub={<><div>Libres: 6</div><div>Rotación: 1.8x</div></>}/>
            <KPI label="TIEMPO PROM. PLATO" value="18 min" color="#e05050" icon={Clock} iconColor="#e05050" sub={<><div>Meta: &lt; 16 min</div><div className="text-[#e05050]">+12% sobre meta</div></>}/>
            <KPI label="PEDIDOS ATRASADOS" value="6" color="#e05050" icon={AlertTriangle} iconColor="#e05050" sub={<><div>Cocina caliente: 4</div><div>Barra: 2</div></>}/>
            <KPI label="QUEJAS DÍA"        value="5" icon={AlertTriangle} iconColor="#f0a050" sub={<><div>Resueltas: 3</div><div>Pendientes: 2</div></>}/>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Section title="EFICIENCIA POR ESTACIÓN" color="#4a9fff" icon={Flame}>
              <table className="w-full text-[11px]">
                <thead><tr className="text-[9px] text-[#7a8499]"><th className="text-left pb-1">Estación</th><th className="text-right pb-1">T. prom</th><th className="text-right pb-1">Target</th><th className="text-right pb-1">Estado</th></tr></thead>
                <tbody>{estaciones.map(e=>(
                  <tr key={e.l} className="border-t border-[#1a2030]"><td className="py-1.5">{e.l}</td><td className="py-1.5 text-right font-bold">{e.tprom} min</td><td className="py-1.5 text-right text-[#7a8499]">{e.target} min</td><td className="py-1.5 text-right"><span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{background:e.status==='ok'?'#3dba6f26':'#e0505026', color:e.status==='ok'?'#3dba6f':'#e05050'}}>{e.status==='ok'?'OK':'Alerta'}</span></td></tr>
                ))}</tbody>
              </table>
            </Section>
            <Section title="TIEMPOS POR MOMENTO" color="#4a9fff" icon={Clock}>
              <ul className="space-y-1.5">{tiemposMomento.map(t=>(
                <li key={t.l} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-2">{t.ok?<CheckCircle2 size={13} className="text-[#3dba6f]"/>:<XCircle size={13} className="text-[#e05050]"/>}{t.l}</span>
                  <span><span className="font-bold">{t.t}</span> <span className="text-[10px] text-[#7a8499]">· {t.target}</span></span>
                </li>
              ))}</ul>
            </Section>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Section title="LISTA 86 · NO OFRECER" color="#e05050" icon={Ban86}>
              <ul className="space-y-1.5">{lista86.map(i=>(
                <li key={i.n} className="flex items-center justify-between text-[11px] py-1.5 border-b border-[#1a2030] last:border-0"><div><div className="font-bold">{i.n}</div><div className="text-[10px] text-[#7a8499]">{i.m}</div></div></li>
              ))}</ul>
            </Section>
            <Section title="DETALLE QUEJAS HOY" color="#e05050" icon={AlertTriangle}>
              <ul className="space-y-1.5">{quejas.map((q,i)=>(
                <li key={i} className="flex items-center justify-between text-[11px]"><span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#e05050]"/>{q.l}</span><span className="text-white font-bold">{q.n}</span></li>
              ))}</ul>
              <div className="mt-3 pt-2 border-t border-[#1a2030] text-[10px] text-[#7a8499]">Total: <span className="text-white font-bold">12 quejas</span> · Resueltas: <span className="text-[#3dba6f] font-bold">9</span> · Pendientes: <span className="text-[#e05050] font-bold">3</span></div>
            </Section>
          </div>
        </>)}

        {/* ═══════════════ BARRA ═══════════════ */}
        {active==='barra' && (<>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <KPI label="VENTA BARRA HOY"  value="$12.6M" icon={Wine}        iconColor="#c66de8" sub={<><div>30% del total día</div><div>vs ayer: +14%</div></>}/>
            <KPI label="TICKETS BARRA"    value="142"    icon={Receipt}     iconColor="#c66de8" sub={<><div>Cócteles: 96</div><div>Vinos: 46</div></>}/>
            <KPI label="TICKET BARRA"     value="$88K"   icon={DollarSign}  iconColor="#3dba6f" sub={<><div>Mes: $79K</div><div className="text-[#3dba6f]">+11% vs mes</div></>}/>
            <KPI label="T. PROM BEBIDA"   value="7 min"  icon={Clock}       iconColor="#3dba6f" sub={<><div>Meta: &lt; 8 min</div><div className="text-[#3dba6f]">OK</div></>}/>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Section title="TOP CÓCTELES HOY" color="#c66de8" icon={Wine}>
              <table className="w-full text-[11px]">
                <thead><tr className="text-[9px] text-[#7a8499]"><th className="text-left pb-1">#</th><th className="text-left pb-1">Cóctel</th><th className="text-right pb-1">Vendidos</th><th className="text-right pb-1">Margen</th></tr></thead>
                <tbody>{cocteles.map((c,i)=>(
                  <tr key={c.n} className="border-t border-[#1a2030]"><td className="py-1.5 text-[#7a8499]">{i+1}</td><td className="py-1.5">{c.n}</td><td className="py-1.5 text-right font-bold">{c.v}</td><td className="py-1.5 text-right text-[#3dba6f] font-bold">{c.margen}</td></tr>
                ))}</tbody>
              </table>
            </Section>
            <Section title="TOP VINOS HOY" color="#d4943a" icon={Wine}>
              <ul className="space-y-1.5">{vinos.map(v=>(
                <li key={v.n} className="flex items-center justify-between text-[11px]"><span>{v.n}</span><span><span className="font-bold">{v.v} botellas</span>{v.copas?<span className="text-[10px] text-[#7a8499] ml-1">· {v.copas} copas</span>:null}</span></li>
              ))}</ul>
              <div className="mt-2 pt-2 border-t border-[#1a2030] text-[10px] text-[#7a8499]">Mes: 312 botellas · $48M en vinos</div>
            </Section>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Section title="EFICIENCIA BARRA" color="#4a9fff" icon={Zap}>
              <div className="space-y-2">{barra.map(r=>(
                <div key={r.l}><div className="flex justify-between text-[11px] mb-0.5"><span>{r.l}</span><span className="text-[#a0a9bd] font-bold">{r.v}%</span></div><Bar pct={r.v} color={r.c}/></div>
              ))}</div>
              <div className="mt-3 pt-2 border-t border-[#1a2030] text-[10px] text-[#7a8499]">Primera bebida: <span className="text-white">7 min</span> · Bebidas atrasadas: <span className="text-[#e05050]">4</span></div>
            </Section>
            <Section title="INVENTARIO CRÍTICO" color="#e05050" icon={Package}>
              <ul className="space-y-1.5">{licoresCriticos.map(l=>(
                <li key={l.n} className="flex items-center justify-between text-[11px]"><div><div>{l.n}</div><div className="text-[10px] text-[#7a8499]">{l.stock}</div></div><span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{background:l.alerta==='crítico'?'#e0505026':'#f0a05026', color:l.alerta==='crítico'?'#e05050':'#f0a050'}}>{l.alerta}</span></li>
              ))}</ul>
              <div className="mt-2 pt-2 border-t border-[#1a2030] text-[10px] text-[#f0a050]">⚑ Acción: solicitar pedido a Supply hoy mismo</div>
            </Section>
          </div>
        </>)}

        {/* ═══════════════ EQUIPO ═══════════════ */}
        {active==='equipo' && (<>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <KPI label="ACTIVOS HOY"       value="18/21" icon={UserCheck}    iconColor="#3dba6f" sub={<><div>Presentes: 16</div><div>Tarde: 2 · Ausentes: 3</div></>}/>
            <KPI label="ASISTENCIA"        value="86%"   icon={CheckCircle2} iconColor="#3dba6f" sub={<><div>Mes: 92%</div><div>Meta: 95%</div></>}/>
            <KPI label="SCORE PROMEDIO"    value="83"    icon={Award}        iconColor="#d4943a" sub={<><div>Top: 96 (Laura)</div><div>Bottom: 58 (Pedro)</div></>}/>
            <KPI label="EN ALERTA"         value="3"     icon={AlertTriangle} iconColor="#e05050" sub={<><div>Memorandos activos: 4</div><div>Bajo rendimiento: 2</div></>}/>
          </div>
          <Card className="mb-3">
            <div className="text-[10px] font-black tracking-[0.15em] text-[#4a9fff] mb-2">ROSTER DE HOY</div>
            <table className="w-full text-[11px]">
              <thead><tr className="text-[9px] text-[#7a8499]"><th className="text-left pb-1">Empleado</th><th className="text-left pb-1">Rol</th><th className="text-left pb-1">Turno</th><th className="text-left pb-1">Estado</th><th className="text-right pb-1">Score</th></tr></thead>
              <tbody>{equipoHoy.map(e=>{
                const eColor = e.estado==='presente'?'#3dba6f' : e.estado.includes('tarde')?'#f0a050' : e.estado==='incapacidad'?'#c66de8' : '#e05050';
                return (
                  <tr key={e.n} className="border-t border-[#1a2030]">
                    <td className="py-1.5 font-bold">{e.n}</td><td className="py-1.5 text-[#a0a9bd]">{e.r}</td><td className="py-1.5 text-[#7a8499]">{e.turno}</td>
                    <td className="py-1.5"><span className="text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold" style={{background:`${eColor}26`,color:eColor}}>{e.estado}</span></td>
                    <td className="py-1.5 text-right font-black" style={{color:e.score>=85?'#3dba6f':e.score>=70?'#f0a050':'#e05050'}}>{e.score}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </Card>
          <div className="grid grid-cols-3 gap-3">
            <Section title="TOP EMPLEADOS" color="#3dba6f" icon={Award}><ul className="space-y-1.5">{topEmp.map((e,i)=>(<li key={e.n} className="flex items-center justify-between text-[12px]"><span className="flex items-center gap-2"><span className="w-4 text-[#7a8499] text-[10px]">{i+1}</span>{e.n}</span><span className="font-black text-[#3dba6f]">{e.s}</span></li>))}</ul></Section>
            <Section title="TALENTO EN ALERTA" color="#e05050" icon={AlertTriangle}><ul className="space-y-1.5">{alertaEmp.map((e,i)=>(<li key={e.n} className="flex items-center justify-between text-[12px]"><span className="flex items-center gap-2"><span className="w-4 text-[#7a8499] text-[10px]">{i+1}</span>{e.n}</span><span className="flex items-center gap-2"><span className="font-black text-[#e05050]">{e.s}</span><span className="text-[10px] text-[#7a8499]">{e.m}</span></span></li>))}</ul></Section>
            <Section title="CUMPLEAÑOS EQUIPO" color="#c66de8" icon={Cake}><ul className="space-y-1.5">{cumplesEquipo.map(c=>(<li key={c.n} className="flex items-center justify-between text-[12px]"><span>{c.n}</span><span className="text-[10px] text-[#7a8499]">{c.d}</span></li>))}</ul></Section>
          </div>
        </>)}

        {/* ═══════════════ RESERVAS ═══════════════ */}
        {active==='reservas' && (<>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <KPI label="RESERVAS HOY"      value="42"  icon={CalendarDays} iconColor="#4a9fff" sub={<><div>Confirmadas: 36</div><div>Pendientes: 6</div></>}/>
            <KPI label="COMENSALES HOY"    value="186" icon={Users}        iconColor="#3dba6f" sub={<><div>Avg pax: 4.4</div><div>Walk-in esperado: 52</div></>}/>
            <KPI label="RESERVAS SEMANA"   value="259" icon={CalendarDays} iconColor="#4a9fff" sub={<><div>Promedio: 37/día</div><div className="text-[#3dba6f]">+18% vs sem. ant.</div></>}/>
            <KPI label="NO-SHOW RATE"      value="3.2%" icon={XCircle}     iconColor="#e05050" sub={<><div>Meta: &lt; 5%</div><div>Mes: 4.1%</div></>}/>
          </div>
          <Card className="mb-3">
            <div className="text-[10px] font-black tracking-[0.15em] text-[#4a9fff] mb-2">RESERVAS DE HOY</div>
            <table className="w-full text-[11px]">
              <thead><tr className="text-[9px] text-[#7a8499]"><th className="text-left pb-1">Hora</th><th className="text-left pb-1">Cliente</th><th className="text-right pb-1">Pax</th><th className="text-left pb-1 pl-3">Mesa</th><th className="text-left pb-1">VIP</th><th className="text-right pb-1">Estado</th></tr></thead>
              <tbody>{reservasHoy.map((r,i)=>{
                const eColor = r.estado==='confirmada'?'#3dba6f' : r.estado==='pendiente'?'#f0a050' : '#7a8499';
                return (
                  <tr key={i} className="border-t border-[#1a2030]">
                    <td className="py-1.5 font-bold">{r.h}</td>
                    <td className="py-1.5">{r.n}</td>
                    <td className="py-1.5 text-right text-[#a0a9bd]">{r.pax}</td>
                    <td className="py-1.5 pl-3 text-[#a0a9bd]">{r.mesa}</td>
                    <td className="py-1.5">{r.vip && <Crown size={12} className="text-[#d4943a]"/>}</td>
                    <td className="py-1.5 text-right"><span className="text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold" style={{background:`${eColor}26`,color:eColor}}>{r.estado}</span></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Section title="PRÓXIMOS 7 DÍAS" color="#4a9fff" icon={CalendarDays}>
              <div className="flex items-end gap-2 h-28">
                {proximas7.map(d=>{
                  const max = Math.max(...proximas7.map(x=>x.n));
                  const h = (d.n/max)*100;
                  return (
                    <div key={d.d} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-[10px] font-bold text-[#a0a9bd]">{d.n}</div>
                      <div className="w-full rounded-t-md" style={{height:`${h}%`, background:'linear-gradient(180deg, #4a9fff, #2a5fbb)', minHeight:6}}/>
                      <div className="text-[8px] text-[#5a6478]">{d.d}</div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-[#7a8499] mt-2">Total semana: <span className="text-white font-bold">259 reservas</span> · pico viernes/sábado</div>
            </Section>
            <Section title="VIP ESPERADOS HOY" color="#d4943a" icon={Crown}>
              <ul className="space-y-1.5">{reservasHoy.filter(r=>r.vip).map(r=>(
                <li key={r.h} className="flex items-center justify-between text-[12px]"><span className="flex items-center gap-2"><Crown size={12} className="text-[#d4943a]"/>{r.n}</span><span className="text-[10px] text-[#7a8499]">{r.h} · {r.pax} pax · {r.mesa}</span></li>
              ))}</ul>
              <div className="mt-2 pt-2 border-t border-[#1a2030] text-[10px] text-[#f0a050]">⚑ Preparar cortesía especial · activar protocolo VIP</div>
            </Section>
          </div>
        </>)}

        {/* ═══════════════ CONFIGURACIÓN ═══════════════ */}
        {active==='config' && (<>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Section title="INFORMACIÓN DEL RESTAURANTE" color="#4a9fff" icon={Settings}>
              <ul className="space-y-1.5">{restauranteInfo.map(r=>(
                <li key={r.l} className="flex justify-between text-[12px]"><span className="text-[#7a8499]">{r.l}</span><span className="text-white font-bold">{r.v}</span></li>
              ))}</ul>
            </Section>
            <Section title="HORARIOS DE OPERACIÓN" color="#4a9fff" icon={Clock}>
              <ul className="space-y-1">{horarios.map(h=>(
                <li key={h.d} className="flex justify-between text-[11px]"><span className="font-bold w-20">{h.d}</span><span className="text-[#a0a9bd]">{h.a}</span><span className="text-[#a0a9bd]">{h.c}</span></li>
              ))}</ul>
            </Section>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Section title="INTEGRACIONES" color="#3dba6f" icon={ShieldCheck}>
              <ul className="space-y-1.5">{integraciones.map(i=>(
                <li key={i.n} className="flex items-center justify-between text-[12px]"><span>{i.n}</span><span className="text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold" style={{background:`${i.color}26`, color:i.color}}>{i.estado}</span></li>
              ))}</ul>
              <div className="mt-2 pt-2 border-t border-[#1a2030] text-[10px] text-[#7a8499]">5 de 7 integraciones activas</div>
            </Section>
            <Section title="USUARIOS Y ROLES" color="#c66de8" icon={Users}>
              <ul className="space-y-1.5">{roles.map(r=>(
                <li key={r.r} className="flex items-center justify-between text-[12px]"><span>{r.r}</span><span className="font-bold">{r.n} usuario{r.n!==1?'s':''}</span></li>
              ))}</ul>
              <div className="mt-2 pt-2 border-t border-[#1a2030] text-[10px] text-[#7a8499]">Total: <span className="text-white font-bold">28 usuarios activos</span> · Política PIN: 4 dígitos · 2FA: gerencia</div>
            </Section>
          </div>
          <Card className="mt-3">
            <div className="text-[10px] font-black tracking-[0.15em] text-[#7a8499] mb-2">POLÍTICAS DEL SISTEMA</div>
            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <div><div className="text-[9px] text-[#7a8499] mb-1 uppercase tracking-wider">Propinas</div><div className="font-bold">9 pools · Policy Engine</div><div className="text-[10px] text-[#7a8499]">Policy: Autónomo · Score por contribución</div></div>
              <div><div className="text-[9px] text-[#7a8499] mb-1 uppercase tracking-wider">Nómina</div><div className="font-bold">Quincenal · DIAN UBL 2.1</div><div className="text-[10px] text-[#7a8499]">Cierre: días 15 y último</div></div>
              <div><div className="text-[9px] text-[#7a8499] mb-1 uppercase tracking-wider">Reservas</div><div className="font-bold">Hold 15 min · cancelar &lt; 4h</div><div className="text-[10px] text-[#7a8499]">No-show fee: $30K (VIP exento)</div></div>
            </div>
          </Card>
        </>)}
      </main>
    </div>
  );
};

// Icon helper (Ban86 = Ban icon stylized as 86)
function Ban86({ size=14 }:{ size?:number }) {
  return <span style={{fontSize:size, fontWeight:900, color:'#e05050'}}>86</span>;
}

export default CommandModule;
