// ============================================================
// NEXUM — ContabilidadModule.tsx  v2
// Módulo contable completo: cuadre de caja, dashboard vivo,
// alertas IA, motor de promociones, captura gastos OCR
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const S = {
  bg:'#0a0a0a', bg2:'#141414', bg3:'#1c1c1c',
  border:'#2a2a2a', text1:'#f0f0f0', text2:'#a0a0a0', text3:'#606060',
  gold:'#d4943a', goldL:'#f0b45a', green:'#3dba6f',
  red:'#e05050', blue:'#4a8fd4', purple:'#9b72ff',
};

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n);
const PCT = (n: number) => `${n.toFixed(1)}%`;

type Tab = 'dashboard' | 'caja' | 'pyg' | 'gastos' | 'inventario' | 'propinas' | 'promociones' | 'facturas';

const MOCK_VENTAS = {
  metaMes:85000000, ventasMes:62400000,
  metaTurno:4500000, ventasTurno:3240000,
  mesas_activas:8, ticket_promedio:185000,
  food_cost_objetivo:28, food_cost_real:31.4,
};

const MOCK_ALERTAS = [
  { tipo:'warning', msg:'Food cost hoy en 31.4% — supera objetivo en 3.4%', tiempo:'hace 12 min' },
  { tipo:'danger',  msg:'Mesa 12 lleva 18 min sin atención desde pedido',     tiempo:'hace 4 min'  },
  { tipo:'info',    msg:'Promoción Happy Hour activa — 22 cocteles vendidos', tiempo:'en curso'    },
  { tipo:'success', msg:'Meta del almuerzo alcanzada — $1.8M facturados',     tiempo:'hace 1h'     },
  { tipo:'warning', msg:'Stock salmón por debajo del mínimo (8 kg)',          tiempo:'hace 35 min' },
];

const MOCK_METODOS = [
  { label:'💳 Datafono',       bruto:1850000, desc:120000, prop:185000, iva:296000 },
  { label:'💵 Efectivo',        bruto:980000,  desc:50000,  prop:98000,  iva:156800 },
  { label:'🏦 Transferencia',   bruto:650000,  desc:0,      prop:65000,  iva:104000 },
  { label:'📱 QR Occidente',    bruto:420000,  desc:0,      prop:42000,  iva:67200  },
  { label:'🍎 Apple Pay',       bruto:180000,  desc:0,      prop:18000,  iva:28800  },
  { label:'💰 Anticipo Evento', bruto:500000,  desc:0,      prop:0,      iva:80000  },
  { label:'👤 Cuenta Empleado', bruto:85000,   desc:85000,  prop:0,      iva:0      },
  { label:'🎁 Bono / Regalo',   bruto:75000,   desc:75000,  prop:0,      iva:0      },
];

const MOCK_DESC = [
  { label:'📰 Prensa / Influencer', monto:120000, obs:'Mesa Influencer @seratta_omm' },
  { label:'🙏 Reivindicación',       monto:45000,  obs:'Demora cocina mesa 8' },
  { label:'⭐ Fidelización',          monto:60000,  obs:'Cliente VIP Sr. López 20%' },
  { label:'🏠 Consumo Interno',      monto:85000,  obs:'Reunión dirección restaurante' },
  { label:'👤 Descuento Empleado',   monto:85000,  obs:'Descuento colaborador nómina' },
  { label:'🤝 Descuento Socio',      monto:35000,  obs:'Socio estratégico evento' },
];

const MOCK_PYG = {
  ingresos:{ alimentos:8500000, bebidas:4200000, cocteles:2800000, otros:450000 },
  costos:  { alimentos:2550000, bebidas:1260000 },
  gastos:  { nomina:3800000, arriendo:2200000, servicios:650000, marketing:480000, tecnologia:200000, aseo:320000, otros:280000 },
  iva:1558400, ret:380000,
};

const MOCK_INVENTARIO = [
  { nombre:'Salmón fresco',    unidad:'kg',  teorico:20, real:8,  costo:45000, cat:'ALIMENTOS' },
  { nombre:'Arroz japonés',    unidad:'kg',  teorico:15, real:15, costo:8500,  cat:'ALIMENTOS' },
  { nombre:'Camarón tigre',    unidad:'kg',  teorico:10, real:8,  costo:38000, cat:'ALIMENTOS' },
  { nombre:'Pulpo',            unidad:'kg',  teorico:8,  real:9,  costo:52000, cat:'ALIMENTOS' },
  { nombre:'Entraña Angus',    unidad:'kg',  teorico:8,  real:6,  costo:48000, cat:'ALIMENTOS' },
  { nombre:'Sake Momokawa',    unidad:'bot', teorico:24, real:22, costo:85000, cat:'BEBIDAS'   },
  { nombre:'Heineken x24',     unidad:'caja',teorico:10, real:10, costo:72000, cat:'BEBIDAS'   },
  { nombre:'Aceite sésamo',    unidad:'lt',  teorico:5,  real:4,  costo:28000, cat:'INSUMOS'   },
];

const MOCK_PROPINAS = [
  { nombre:'Juan García',    cedula:'10234567', mesas:24, propina:285000 },
  { nombre:'María López',    cedula:'52198432', mesas:18, propina:210000 },
  { nombre:'Carlos Ruiz',    cedula:'80145623', mesas:21, propina:248000 },
  { nombre:'Ana Martínez',   cedula:'43876210', mesas:16, propina:192000 },
  { nombre:'Luis Hernández', cedula:'19345678', mesas:19, propina:228000 },
];

const MOCK_GASTOS = [
  { id:'1', proveedor:'Pescadería La Marina', concepto:'Salmón y mariscos', monto:850000, fecha:'08/04/2026', categoria:'Costo alimentos',   estado:'causado'  },
  { id:'2', proveedor:'Distribuidora Sake',   concepto:'Sake importado x12', monto:420000, fecha:'08/04/2026', categoria:'Costo bebidas',    estado:'causado'  },
  { id:'3', proveedor:'Gas Natural Bogotá',   concepto:'Servicio marzo',     monto:280000, fecha:'07/04/2026', categoria:'Servicios públicos', estado:'pendiente' },
  { id:'4', proveedor:'Aseo Express',         concepto:'Insumos limpieza',   monto:95000,  fecha:'07/04/2026', categoria:'Aseo y mtto',       estado:'pendiente' },
];

const MOCK_PROMO = [
  { id:'1', nombre:'Happy Hour Cocteles',  tipo:'2x1',     aplica:'Cocteles · Lun-Vie 5-7pm', desc:50,  activa:true,  usos:22, color:'#9b72ff' },
  { id:'2', nombre:'Gourmand Society 20%', tipo:'%',       aplica:'Toda la carta · Siempre',   desc:20,  activa:true,  usos:8,  color:'#d4943a' },
  { id:'3', nombre:'Martes Makis',         tipo:'%',       aplica:'Makis · Martes',             desc:15,  activa:false, usos:0,  color:'#4a8fd4' },
  { id:'4', nombre:'Cumpleañero gratis',   tipo:'cortesia',aplica:'Postre especial',             desc:100, activa:true,  usos:3,  color:'#3dba6f' },
];

interface Turno { responsable:string; hora_apertura:string; monto_apertura:number; estado:'abierta'|'cerrada'; hora_cierre?:string; diferencia?:number; }

export default function ContabilidadModule() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [toast, setToast] = useState('');
  const [turno, setTurno] = useState<Turno|null>(null);
  const [showAbrir, setShowAbrir] = useState(false);
  const [showCerrar, setShowCerrar] = useState(false);
  const [montoA, setMontoA] = useState('');
  const [montoC, setMontoC] = useState('');
  const [resp, setResp] = useState('');
  const [showOCR, setShowOCR] = useState(false);
  const [ocrProc, setOcrProc] = useState(false);
  const [ocrRes, setOcrRes] = useState<any>(null);
  const [ventas, setVentas] = useState(MOCK_VENTAS);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''),3000); };

  const abrirCaja = () => {
    if (!resp || !montoA) { showToast('⚠️ Completa todos los campos'); return; }
    setTurno({ responsable:resp, hora_apertura:new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}), monto_apertura:parseInt(montoA), estado:'abierta' });
    setShowAbrir(false); setMontoA(''); setResp('');
    showToast(`✓ Caja abierta — turno de ${resp}`); setTab('caja');
  };

  const cerrarCaja = () => {
    if (!montoC || !turno) return;
    const totalNeto = MOCK_METODOS.reduce((a,m)=>a+m.bruto-m.desc,0);
    const esperado = turno.monto_apertura + totalNeto;
    const real = parseInt(montoC);
    const diff = real - esperado;
    setTurno(p=>p?{...p,estado:'cerrada',hora_cierre:new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}),diferencia:diff}:null);
    setShowCerrar(false); setMontoC('');
    showToast(diff===0?'✓ Caja cuadrada perfectamente':`⚠️ Diferencia de ${COP(Math.abs(diff))}`);
  };

  const simOCR = () => {
    setOcrProc(true);
    setTimeout(()=>{ setOcrRes({ proveedor:'Pescadería La Marina', nit:'900456789-1', fecha:new Date().toLocaleDateString('es-CO'), total:1240000, iva:235600, categoria:'Costo alimentos', confianza:94 }); setOcrProc(false); }, 2000);
  };

  const totalBruto = MOCK_METODOS.reduce((a,m)=>a+m.bruto,0);
  const totalDesc  = MOCK_METODOS.reduce((a,m)=>a+m.desc,0);
  const totalProp  = MOCK_METODOS.reduce((a,m)=>a+m.prop,0);
  const totalIVA   = MOCK_METODOS.reduce((a,m)=>a+m.iva,0);
  const totalNeto  = totalBruto - totalDesc;
  const ingTotal   = Object.values(MOCK_PYG.ingresos).reduce((a,b)=>a+b,0);
  const cosTotal   = Object.values(MOCK_PYG.costos).reduce((a,b)=>a+b,0);
  const gasTotal   = Object.values(MOCK_PYG.gastos).reduce((a,b)=>a+b,0);
  const utilBruta  = ingTotal - cosTotal;
  const ebitda     = utilBruta - gasTotal;
  const utilNeta   = ebitda * 0.67;
  const propTotal  = MOCK_PROPINAS.reduce((a,p)=>a+p.propina,0);
  const pctTurno   = (ventas.ventasTurno/ventas.metaTurno)*100;
  const pctMes     = (ventas.ventasMes/ventas.metaMes)*100;

  const inp = { background:S.bg2, border:`1px solid ${S.border}`, borderRadius:8, padding:'9px 14px', color:S.text1, fontSize:12, outline:'none', width:'100%' };

  const TABS: {id:Tab;label:string}[] = [
    {id:'dashboard',  label:'📊 Dashboard'},
    {id:'caja',       label:'🔒 Caja'},
    {id:'pyg',        label:'📈 P&G'},
    {id:'gastos',     label:'📸 Gastos'},
    {id:'inventario', label:'📦 Inventario'},
    {id:'propinas',   label:'💚 Propinas'},
    {id:'promociones',label:'🎯 Promociones'},
    {id:'facturas',   label:'🧾 Facturas'},
  ];

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:S.bg,color:S.text1,fontFamily:"'DM Sans',sans-serif"}}>

      {toast && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'#222',border:`1px solid ${S.border}`,color:S.text1,padding:'10px 20px',borderRadius:10,fontSize:13,zIndex:9999,whiteSpace:'nowrap'}}>{toast}</div>}

      {/* Modal apertura */}
      {showAbrir && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:S.bg3,border:`1px solid ${S.green}40`,borderRadius:16,padding:28,maxWidth:380,width:'100%'}}>
            <div style={{fontSize:20,marginBottom:6}}>🔓</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:4}}>Apertura de caja</div>
            <div style={{fontSize:12,color:S.text3,marginBottom:20}}>Registra el monto inicial y el responsable del turno</div>
            <div style={{fontSize:10,color:S.text3,marginBottom:6,fontWeight:700,textTransform:'uppercase' as const}}>Responsable</div>
            <input style={{...inp,marginBottom:12}} placeholder="Nombre del cajero" value={resp} onChange={e=>setResp(e.target.value)} />
            <div style={{fontSize:10,color:S.text3,marginBottom:6,fontWeight:700,textTransform:'uppercase' as const}}>Monto inicial en caja ($)</div>
            <input style={{...inp,marginBottom:20}} type="number" placeholder="Ej: 200000" value={montoA} onChange={e=>setMontoA(e.target.value)} />
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setShowAbrir(false)} style={{flex:1,padding:12,borderRadius:10,border:`1px solid ${S.border}`,background:'none',color:S.text2,fontSize:12,cursor:'pointer'}}>Cancelar</button>
              <button onClick={abrirCaja} style={{flex:2,padding:12,borderRadius:10,border:'none',background:S.green,color:'#fff',fontSize:12,fontWeight:900,cursor:'pointer'}}>✓ Abrir turno</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cierre */}
      {showCerrar && turno && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:S.bg3,border:`1px solid ${S.red}40`,borderRadius:16,padding:28,maxWidth:440,width:'100%'}}>
            <div style={{fontSize:20,marginBottom:6}}>🔒</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:4}}>Cierre de turno</div>
            <div style={{fontSize:12,color:S.text3,marginBottom:16}}>Turno de {turno.responsable} — apertura {turno.hora_apertura}</div>
            <div style={{background:S.bg2,borderRadius:12,padding:14,marginBottom:16}}>
              {MOCK_METODOS.map((m,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:i<MOCK_METODOS.length-1?`1px solid ${S.border}`:'none',fontSize:12}}>
                  <span style={{color:S.text2}}>{m.label}</span>
                  <span style={{color:S.goldL,fontWeight:700}}>{COP(m.bruto-m.desc)}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0 0',fontSize:13,fontWeight:700}}>
                <span>Total esperado</span>
                <span style={{color:S.gold}}>{COP(turno.monto_apertura + totalNeto)}</span>
              </div>
            </div>
            <div style={{fontSize:10,color:S.text3,marginBottom:6,fontWeight:700,textTransform:'uppercase' as const}}>Monto real contado en caja</div>
            <input style={{...inp,marginBottom:20}} type="number" placeholder="Conteo físico de la caja" value={montoC} onChange={e=>setMontoC(e.target.value)} />
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setShowCerrar(false)} style={{flex:1,padding:12,borderRadius:10,border:`1px solid ${S.border}`,background:'none',color:S.text2,fontSize:12,cursor:'pointer'}}>Cancelar</button>
              <button onClick={cerrarCaja} style={{flex:2,padding:12,borderRadius:10,border:'none',background:S.red,color:'#fff',fontSize:12,fontWeight:900,cursor:'pointer'}}>🔒 Cerrar turno</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal OCR */}
      {showOCR && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:S.bg3,border:`1px solid ${S.purple}40`,borderRadius:16,padding:28,maxWidth:460,width:'100%'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:4}}>📸 Captura de gasto con IA</div>
            <div style={{fontSize:12,color:S.text3,marginBottom:20}}>Toma foto del comprobante — la IA extrae los datos automáticamente</div>
            {!ocrRes ? (
              <>
                <div onClick={()=>fileRef.current?.click()} style={{border:`2px dashed ${S.border}`,borderRadius:12,padding:40,textAlign:'center',cursor:'pointer',marginBottom:16}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=S.purple}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=S.border}>
                  <div style={{fontSize:40,marginBottom:8}}>📷</div>
                  <div style={{fontSize:13,fontWeight:700,color:S.text2,marginBottom:4}}>Toca para subir foto</div>
                  <div style={{fontSize:11,color:S.text3}}>JPG, PNG, PDF · max 10MB</div>
                </div>
                <input ref={fileRef} type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={simOCR} />
                {ocrProc && <div style={{textAlign:'center',padding:16,color:S.purple,fontSize:13}}>✨ Analizando con IA...</div>}
                <button onClick={simOCR} style={{width:'100%',padding:12,borderRadius:10,border:`1px solid ${S.purple}40`,background:`${S.purple}15`,color:S.purple,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                  Demo — simular escaneo IA
                </button>
              </>
            ) : (
              <>
                <div style={{background:`${S.green}10`,border:`1px solid ${S.green}30`,borderRadius:10,padding:14,marginBottom:16}}>
                  <div style={{fontSize:11,color:S.green,fontWeight:700,marginBottom:8}}>✓ Datos extraídos con {ocrRes.confianza}% de confianza</div>
                  {[['Proveedor',ocrRes.proveedor],['NIT',ocrRes.nit],['Fecha',ocrRes.fecha],['Total',COP(ocrRes.total)],['IVA',COP(ocrRes.iva)],['Categoría',ocrRes.categoria]].map(([k,v])=>(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0',borderBottom:`1px solid ${S.border}`}}>
                      <span style={{color:S.text3}}>{k}</span><span style={{color:S.text1,fontWeight:600}}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:10}}>
                  <button onClick={()=>setOcrRes(null)} style={{flex:1,padding:12,borderRadius:10,border:`1px solid ${S.border}`,background:'none',color:S.text2,fontSize:12,cursor:'pointer'}}>↩ Nueva foto</button>
                  <button onClick={()=>{setShowOCR(false);setOcrRes(null);showToast('✓ Gasto registrado y causado');}} style={{flex:2,padding:12,borderRadius:10,border:'none',background:S.green,color:'#fff',fontSize:12,fontWeight:900,cursor:'pointer'}}>✓ Registrar gasto</button>
                </div>
              </>
            )}
            <button onClick={()=>{setShowOCR(false);setOcrRes(null);setOcrProc(false);}} style={{width:'100%',marginTop:10,padding:10,borderRadius:10,border:`1px solid ${S.border}`,background:'none',color:S.text3,fontSize:11,cursor:'pointer'}}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{padding:'14px 20px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${S.gold},#b07820)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📊</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900}}>CONTABILIDAD</div>
            <div style={{fontSize:11,color:S.text3}}>OMM · en vivo</div>
          </div>
          <div style={{marginLeft:8,display:'flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:20,background:turno?.estado==='abierta'?`${S.green}15`:S.border,border:`1px solid ${turno?.estado==='abierta'?S.green+'40':S.border}`}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:turno?.estado==='abierta'?S.green:S.text3}}/>
            <span style={{fontSize:11,fontWeight:700,color:turno?.estado==='abierta'?S.green:S.text3}}>
              {turno?.estado==='abierta'?`Caja abierta · ${turno.responsable}`:'Caja cerrada'}
            </span>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>showToast('⬇️ Excel generado')} style={{background:S.bg3,border:`1px solid ${S.border}`,color:S.text2,padding:'7px 14px',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer'}}>⬇️ Excel</button>
          <button onClick={()=>showToast('⬇️ PDF generado')} style={{background:S.bg3,border:`1px solid ${S.border}`,color:S.text2,padding:'7px 14px',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer'}}>⬇️ PDF</button>
          {!turno||turno.estado==='cerrada'
            ? <button onClick={()=>setShowAbrir(true)} style={{background:S.green,color:'#fff',border:'none',padding:'7px 14px',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer'}}>🔓 Abrir caja</button>
            : <button onClick={()=>setShowCerrar(true)} style={{background:S.red,color:'#fff',border:'none',padding:'7px 14px',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer'}}>🔒 Cerrar turno</button>
          }
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,flexShrink:0,overflowX:'auto'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:'10px 14px',background:'none',border:'none',cursor:'pointer',fontSize:11,fontWeight:700,whiteSpace:'nowrap',color:tab===t.id?S.gold:S.text3,borderBottom:`2px solid ${tab===t.id?S.gold:'transparent'}`,transition:'all .15s'}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:'auto',padding:16}}>

        {/* DASHBOARD */}
        {tab==='dashboard' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
              {[
                {label:'Ventas turno',value:COP(ventas.ventasTurno),sub:`Meta: ${COP(ventas.metaTurno)}`,color:S.goldL,pct:pctTurno},
                {label:'Ventas mes',  value:COP(ventas.ventasMes),  sub:`Meta: ${COP(ventas.metaMes)}`,  color:S.blue, pct:pctMes},
                {label:'Mesas activas',  value:String(ventas.mesas_activas), sub:'en este momento', color:S.green, pct:null},
                {label:'Ticket promedio',value:COP(ventas.ticket_promedio),  sub:'por mesa hoy',    color:S.purple,pct:null},
              ].map(kpi=>(
                <div key={kpi.label} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:12,padding:14}}>
                  <div style={{fontSize:10,color:S.text3,marginBottom:4}}>{kpi.label}</div>
                  <div style={{fontSize:18,fontWeight:900,color:kpi.color,fontFamily:"'Syne',sans-serif"}}>{kpi.value}</div>
                  <div style={{fontSize:10,color:S.text3,marginTop:3}}>{kpi.sub}</div>
                  {kpi.pct!==null&&(
                    <div style={{marginTop:8}}>
                      <div style={{height:4,background:S.bg3,borderRadius:4,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${Math.min(kpi.pct,100)}%`,background:kpi.pct>=100?S.green:kpi.pct>=70?S.gold:S.red,borderRadius:4}}/>
                      </div>
                      <div style={{fontSize:10,color:kpi.pct>=100?S.green:kpi.pct>=70?S.gold:S.red,marginTop:3,fontWeight:700}}>{PCT(kpi.pct)} meta</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{background:ventas.food_cost_real>ventas.food_cost_objetivo?`${S.red}10`:`${S.green}10`,border:`1px solid ${ventas.food_cost_real>ventas.food_cost_objetivo?S.red:S.green}30`,borderRadius:12,padding:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:ventas.food_cost_real>ventas.food_cost_objetivo?S.red:S.green}}>
                  {ventas.food_cost_real>ventas.food_cost_objetivo?'⚠️ Food cost por encima del objetivo':'✓ Food cost bajo control'}
                </div>
                <div style={{fontSize:11,color:S.text3,marginTop:3}}>Objetivo: {ventas.food_cost_objetivo}% · Real hoy: {ventas.food_cost_real}%</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:22,fontWeight:900,color:ventas.food_cost_real>ventas.food_cost_objetivo?S.red:S.green}}>{ventas.food_cost_real}%</div>
                <div style={{fontSize:10,color:S.text3}}>food cost</div>
              </div>
            </div>

            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
              <div style={{padding:'12px 16px',borderBottom:`1px solid ${S.border}`,display:'flex',justifyContent:'space-between'}}>
                <div style={{fontSize:12,fontWeight:700,color:S.purple}}>✨ ALERTAS IA</div>
                <span style={{fontSize:10,color:S.text3}}>{MOCK_ALERTAS.length} activas</span>
              </div>
              {MOCK_ALERTAS.map((a,i)=>{
                const colors:Record<string,string>={warning:S.gold,danger:S.red,info:S.blue,success:S.green};
                return (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px',borderBottom:i<MOCK_ALERTAS.length-1?`1px solid ${S.border}`:'none'}}>
                    <div style={{display:'flex',gap:10,alignItems:'center'}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:colors[a.tipo],flexShrink:0}}/>
                      <span style={{fontSize:12,color:S.text1}}>{a.msg}</span>
                    </div>
                    <span style={{fontSize:10,color:S.text3,flexShrink:0,marginLeft:12}}>{a.tiempo}</span>
                  </div>
                );
              })}
            </div>

            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
              <div style={{fontSize:12,fontWeight:700,color:S.goldL,marginBottom:12}}>VENTAS DEL DÍA POR MÉTODO</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                {MOCK_METODOS.filter(m=>m.bruto>0).map((m,i)=>(
                  <div key={i} style={{background:S.bg3,borderRadius:10,padding:'10px 12px'}}>
                    <div style={{fontSize:11,color:S.text2,marginBottom:4}}>{m.label}</div>
                    <div style={{fontSize:14,fontWeight:700,color:S.goldL}}>{COP(m.bruto-m.desc)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CAJA */}
        {tab==='caja' && (
          <div style={{display:'flex',flexDirection:'column',gap:14,maxWidth:700}}>
            {!turno ? (
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:40,textAlign:'center'}}>
                <div style={{fontSize:48,marginBottom:16}}>🔒</div>
                <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>No hay turno activo</div>
                <div style={{fontSize:13,color:S.text3,marginBottom:24}}>Abre la caja para comenzar el registro del turno</div>
                <button onClick={()=>setShowAbrir(true)} style={{background:S.green,color:'#fff',border:'none',padding:'12px 28px',borderRadius:10,fontSize:13,fontWeight:900,cursor:'pointer'}}>🔓 Abrir caja ahora</button>
              </div>
            ) : (
              <>
                <div style={{background:turno.estado==='cerrada'?`${S.red}08`:`${S.green}08`,border:`1px solid ${turno.estado==='cerrada'?S.red:S.green}30`,borderRadius:14,padding:20}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                    <div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,color:turno.estado==='cerrada'?S.red:S.green}}>
                        {turno.estado==='cerrada'?'🔒 Turno cerrado':'🔓 Turno activo'}
                      </div>
                      <div style={{fontSize:12,color:S.text3,marginTop:4}}>Responsable: {turno.responsable} · Apertura: {turno.hora_apertura}</div>
                    </div>
                    {turno.estado==='abierta'&&<button onClick={()=>setShowCerrar(true)} style={{background:S.red,color:'#fff',border:'none',padding:'8px 16px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>🔒 Cerrar turno</button>}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                    {[
                      {label:'Monto apertura',value:COP(turno.monto_apertura),color:S.blue},
                      {label:'Ventas del turno',value:COP(totalNeto),color:S.goldL},
                      turno.estado==='cerrada'
                        ?{label:'Diferencia',value:(turno.diferencia||0)===0?'✓ Cuadrada':COP(turno.diferencia||0),color:(turno.diferencia||0)===0?S.green:S.red}
                        :{label:'Total esperado',value:COP(turno.monto_apertura+totalNeto),color:S.gold},
                    ].map(kpi=>(
                      <div key={kpi.label} style={{background:S.bg2,borderRadius:10,padding:12}}>
                        <div style={{fontSize:10,color:S.text3,marginBottom:4}}>{kpi.label}</div>
                        <div style={{fontSize:15,fontWeight:700,color:kpi.color}}>{kpi.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
                  <div style={{padding:'12px 16px',borderBottom:`1px solid ${S.border}`}}><div style={{fontSize:12,fontWeight:700,color:S.goldL}}>DETALLE POR MÉTODO DE PAGO</div></div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead><tr style={{background:S.bg3}}>
                      {['Método','Bruto','Descuentos','Propinas','IVA','Neto'].map(h=>(
                        <th key={h} style={{padding:'8px 14px',textAlign:h==='Método'?'left':'right',color:S.text3,fontWeight:700,fontSize:10,textTransform:'uppercase' as const}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {MOCK_METODOS.map((m,i)=>(
                        <tr key={i} style={{borderTop:`1px solid ${S.border}`}}>
                          <td style={{padding:'10px 14px'}}>{m.label}</td>
                          <td style={{padding:'10px 14px',textAlign:'right',color:S.goldL}}>{COP(m.bruto)}</td>
                          <td style={{padding:'10px 14px',textAlign:'right',color:m.desc>0?S.red:S.text3}}>{m.desc>0?COP(m.desc):'—'}</td>
                          <td style={{padding:'10px 14px',textAlign:'right',color:S.green}}>{m.prop>0?COP(m.prop):'—'}</td>
                          <td style={{padding:'10px 14px',textAlign:'right',color:S.blue}}>{m.iva>0?COP(m.iva):'—'}</td>
                          <td style={{padding:'10px 14px',textAlign:'right',fontWeight:700,color:S.goldL}}>{COP(m.bruto-m.desc)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr style={{background:S.bg3,borderTop:`2px solid ${S.border}`}}>
                      <td style={{padding:'12px 14px',fontWeight:700,color:S.gold}}>TOTAL</td>
                      <td style={{padding:'12px 14px',textAlign:'right',fontWeight:700,color:S.goldL}}>{COP(totalBruto)}</td>
                      <td style={{padding:'12px 14px',textAlign:'right',fontWeight:700,color:S.red}}>{COP(totalDesc)}</td>
                      <td style={{padding:'12px 14px',textAlign:'right',fontWeight:700,color:S.green}}>{COP(totalProp)}</td>
                      <td style={{padding:'12px 14px',textAlign:'right',fontWeight:700,color:S.blue}}>{COP(totalIVA)}</td>
                      <td style={{padding:'12px 14px',textAlign:'right',fontWeight:900,color:S.gold,fontSize:14}}>{COP(totalNeto)}</td>
                    </tr></tfoot>
                  </table>
                </div>

                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
                  <div style={{padding:'12px 16px',borderBottom:`1px solid ${S.border}`}}><div style={{fontSize:12,fontWeight:700,color:S.red}}>DESCUENTOS POR CATEGORÍA</div></div>
                  {MOCK_DESC.map((d,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px',borderBottom:i<MOCK_DESC.length-1?`1px solid ${S.border}`:'none'}}>
                      <div>
                        <div style={{fontSize:12,color:S.text1}}>{d.label}</div>
                        <div style={{fontSize:10,color:S.text3,marginTop:2}}>{d.obs}</div>
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color:S.red}}>{COP(d.monto)}</div>
                    </div>
                  ))}
                  <div style={{display:'flex',justifyContent:'space-between',padding:'12px 16px',background:S.bg3}}>
                    <span style={{fontSize:12,fontWeight:700,color:S.red}}>TOTAL DESCUENTOS</span>
                    <span style={{fontSize:14,fontWeight:900,color:S.red}}>{COP(MOCK_DESC.reduce((a,d)=>a+d.monto,0))}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* P&G */}
        {tab==='pyg' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
              {[
                {label:'Ingresos totales',value:COP(ingTotal),color:S.goldL},
                {label:'Margen bruto',value:PCT((utilBruta/ingTotal)*100),color:S.green},
                {label:'EBITDA',value:COP(ebitda),color:S.gold},
                {label:'Utilidad neta',value:COP(utilNeta),color:utilNeta>0?S.green:S.red},
              ].map(kpi=>(
                <div key={kpi.label} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:12,padding:14}}>
                  <div style={{fontSize:10,color:S.text3,marginBottom:4}}>{kpi.label}</div>
                  <div style={{fontSize:18,fontWeight:900,color:kpi.color,fontFamily:"'Syne',sans-serif"}}>{kpi.value}</div>
                </div>
              ))}
            </div>
            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
              {[
                {titulo:'INGRESOS OPERACIONALES',color:S.goldL,items:[{puc:'4135',label:'Ventas de alimentos',valor:MOCK_PYG.ingresos.alimentos},{puc:'4135',label:'Ventas de bebidas',valor:MOCK_PYG.ingresos.bebidas},{puc:'4135',label:'Ventas de cocteles',valor:MOCK_PYG.ingresos.cocteles},{puc:'4295',label:'Otros ingresos',valor:MOCK_PYG.ingresos.otros}],total:ingTotal},
                {titulo:'COSTOS DE VENTAS',color:S.red,items:[{puc:'6135',label:'Costo de alimentos',valor:MOCK_PYG.costos.alimentos},{puc:'6135',label:'Costo de bebidas',valor:MOCK_PYG.costos.bebidas}],total:cosTotal},
                {titulo:'GASTOS OPERACIONALES',color:S.purple,items:[{puc:'5105',label:'Nómina y prestaciones',valor:MOCK_PYG.gastos.nomina},{puc:'5120',label:'Arriendo',valor:MOCK_PYG.gastos.arriendo},{puc:'5115',label:'Servicios públicos',valor:MOCK_PYG.gastos.servicios},{puc:'5145',label:'Marketing',valor:MOCK_PYG.gastos.marketing},{puc:'5195',label:'Tecnología (Nexum)',valor:MOCK_PYG.gastos.tecnologia},{puc:'5140',label:'Aseo y mtto',valor:MOCK_PYG.gastos.aseo},{puc:'5295',label:'Otros',valor:MOCK_PYG.gastos.otros}],total:gasTotal},
              ].map(sec=>(
                <div key={sec.titulo} style={{borderTop:`1px solid ${S.border}`}}>
                  <div style={{padding:'10px 16px',background:S.bg3}}><span style={{fontSize:10,fontWeight:700,color:sec.color,textTransform:'uppercase' as const,letterSpacing:'.08em'}}>{sec.titulo}</span></div>
                  {sec.items.map((item,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 16px',borderTop:`1px solid ${S.bg3}`}}>
                      <span style={{fontSize:11,color:S.text3}}>{item.puc}  <span style={{color:S.text2}}>{item.label}</span></span>
                      <span style={{fontSize:12,color:S.text1}}>{COP(item.valor)}</span>
                    </div>
                  ))}
                  <div style={{display:'flex',justifyContent:'space-between',padding:'10px 16px',background:'#1a1a1a',borderTop:`1px solid ${sec.color}30`}}>
                    <span style={{fontSize:11,fontWeight:700,color:sec.color}}>TOTAL {sec.titulo.split(' ')[0]}</span>
                    <span style={{fontSize:13,fontWeight:700,color:sec.color}}>{COP(sec.total)}</span>
                  </div>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',padding:'14px 16px',background:S.bg3,borderTop:`2px solid ${S.gold}40`}}>
                <span style={{fontSize:14,fontWeight:900,color:S.gold}}>EBITDA</span>
                <div style={{display:'flex',gap:16,alignItems:'center'}}>
                  <span style={{fontSize:11,color:S.text3}}>{PCT((ebitda/ingTotal)*100)} margen</span>
                  <span style={{fontSize:15,fontWeight:900,color:S.gold}}>{COP(ebitda)}</span>
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'10px 16px',borderTop:`1px solid ${S.border}`}}>
                <span style={{fontSize:11,color:S.text2}}>2512  Impuesto de renta (33%)</span>
                <span style={{fontSize:12,color:S.red}}>({COP(ebitda*0.33)})</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'16px',background:`${S.green}10`,borderTop:`2px solid ${S.green}40`}}>
                <span style={{fontSize:15,fontWeight:900,color:S.green}}>UTILIDAD NETA</span>
                <div style={{display:'flex',gap:16,alignItems:'center'}}>
                  <span style={{fontSize:11,color:S.text3}}>Margen: {PCT((utilNeta/ingTotal)*100)}</span>
                  <span style={{fontSize:16,fontWeight:900,color:S.green}}>{COP(utilNeta)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GASTOS OCR */}
        {tab==='gastos' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:12,fontWeight:700,color:S.goldL}}>REGISTRO DE GASTOS Y COMPRAS</div>
              <button onClick={()=>setShowOCR(true)} style={{background:`${S.purple}15`,border:`1px solid ${S.purple}40`,color:S.purple,padding:'8px 16px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                📸 Capturar desde foto
              </button>
            </div>
            <div style={{padding:14,background:`${S.purple}10`,border:`1px solid ${S.purple}30`,borderRadius:12,fontSize:12,color:S.purple}}>
              ✨ IA activa — toma foto del tiquete o factura del proveedor y Nexum extrae proveedor, NIT, monto, IVA y categoriza automáticamente.
            </div>
            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:S.bg3}}>
                  {['Proveedor','Concepto','Categoría','Fecha','Monto','Estado'].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:h==='Monto'?'right':'left',color:S.text3,fontWeight:700,fontSize:10,textTransform:'uppercase' as const}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {MOCK_GASTOS.map((g,i)=>(
                    <tr key={i} style={{borderTop:`1px solid ${S.border}`}}>
                      <td style={{padding:'10px 12px',color:S.text1,fontWeight:600}}>{g.proveedor}</td>
                      <td style={{padding:'10px 12px',color:S.text2}}>{g.concepto}</td>
                      <td style={{padding:'10px 12px',color:S.text3,fontSize:11}}>{g.categoria}</td>
                      <td style={{padding:'10px 12px',color:S.text3}}>{g.fecha}</td>
                      <td style={{padding:'10px 12px',textAlign:'right',fontWeight:700,color:S.goldL}}>{COP(g.monto)}</td>
                      <td style={{padding:'10px 12px'}}>
                        <span style={{background:g.estado==='causado'?`${S.green}20`:`${S.gold}20`,color:g.estado==='causado'?S.green:S.gold,padding:'3px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>
                          {g.estado==='causado'?'✓ Causado':'⏳ Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{background:S.bg3,borderTop:`2px solid ${S.border}`}}>
                  <td colSpan={4} style={{padding:'12px',fontWeight:700,color:S.gold}}>TOTAL GASTOS</td>
                  <td style={{padding:'12px',textAlign:'right',fontWeight:900,color:S.red,fontSize:14}}>{COP(MOCK_GASTOS.reduce((a,g)=>a+g.monto,0))}</td>
                  <td/>
                </tr></tfoot>
              </table>
            </div>
          </div>
        )}

        {/* INVENTARIO */}
        {tab==='inventario' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
              {[
                {label:'Items con faltante',value:String(MOCK_INVENTARIO.filter(i=>i.real<i.teorico).length),color:S.red},
                {label:'Varianza en pesos',value:COP(MOCK_INVENTARIO.reduce((a,i)=>a+((i.teorico-i.real)*i.costo),0)),color:S.red},
                {label:'Items en inventario',value:String(MOCK_INVENTARIO.length),color:S.text2},
              ].map(kpi=>(
                <div key={kpi.label} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:12,padding:14}}>
                  <div style={{fontSize:10,color:S.text3,marginBottom:4}}>{kpi.label}</div>
                  <div style={{fontSize:22,fontWeight:900,color:kpi.color}}>{kpi.value}</div>
                </div>
              ))}
            </div>
            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:S.bg3}}>
                  {['Producto','Cat.','Und.','Teórico','Real','Diff','Varianza $','Estado'].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:['Teórico','Real','Diff','Varianza $'].includes(h)?'right':'left',color:S.text3,fontWeight:700,fontSize:10,textTransform:'uppercase' as const}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {MOCK_INVENTARIO.map((item,i)=>{
                    const diff=item.real-item.teorico;
                    const v=diff*item.costo;
                    const est=diff<0?{label:'⚠ Faltante',color:S.red}:diff>0?{label:'↑ Sobrante',color:S.blue}:{label:'✓ OK',color:S.green};
                    return (
                      <tr key={i} style={{borderTop:`1px solid ${S.border}`,background:diff<0?`${S.red}08`:'transparent'}}>
                        <td style={{padding:'10px 12px',color:S.text1}}>{item.nombre}</td>
                        <td style={{padding:'10px 12px',color:S.text3,fontSize:10}}>{item.cat}</td>
                        <td style={{padding:'10px 12px',textAlign:'right',color:S.text2}}>{item.unidad}</td>
                        <td style={{padding:'10px 12px',textAlign:'right',color:S.blue}}>{item.teorico}</td>
                        <td style={{padding:'10px 12px',textAlign:'right',color:S.green}}>{item.real}</td>
                        <td style={{padding:'10px 12px',textAlign:'right',fontWeight:700,color:diff<0?S.red:diff>0?S.blue:S.green}}>{diff>0?'+':''}{diff}</td>
                        <td style={{padding:'10px 12px',textAlign:'right',fontWeight:700,color:v<0?S.red:S.green}}>{COP(Math.abs(v))}</td>
                        <td style={{padding:'10px 12px',textAlign:'right',fontSize:11,fontWeight:700,color:est.color}}>{est.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PROPINAS */}
        {tab==='propinas' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
              {[
                {label:'Total propinas mes',value:COP(propTotal),color:S.green},
                {label:'Promedio colaborador',value:COP(propTotal/MOCK_PROPINAS.length),color:S.blue},
                {label:'Promedio por mesa',value:COP(propTotal/MOCK_PROPINAS.reduce((a,p)=>a+p.mesas,0)),color:S.gold},
              ].map(kpi=>(
                <div key={kpi.label} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:12,padding:14}}>
                  <div style={{fontSize:10,color:S.text3,marginBottom:4}}>{kpi.label}</div>
                  <div style={{fontSize:18,fontWeight:900,color:kpi.color}}>{kpi.value}</div>
                </div>
              ))}
            </div>
            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:S.bg3}}>
                  {['Colaborador','Cédula','Mesas','Propina recibida','Promedio/mesa','% del total'].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:['Mesas','Propina recibida','Promedio/mesa','% del total'].includes(h)?'right':'left',color:S.text3,fontWeight:700,fontSize:10,textTransform:'uppercase' as const}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {[...MOCK_PROPINAS].sort((a,b)=>b.propina-a.propina).map((p,i)=>(
                    <tr key={i} style={{borderTop:`1px solid ${S.border}`}}>
                      <td style={{padding:'12px',color:S.text1,fontWeight:i===0?700:400}}>{i===0&&'🏆 '}{p.nombre}</td>
                      <td style={{padding:'12px',color:S.text3}}>{p.cedula}</td>
                      <td style={{padding:'12px',textAlign:'right',color:S.blue}}>{p.mesas}</td>
                      <td style={{padding:'12px',textAlign:'right',fontWeight:700,color:S.green}}>{COP(p.propina)}</td>
                      <td style={{padding:'12px',textAlign:'right',color:S.gold}}>{COP(Math.round(p.propina/p.mesas))}</td>
                      <td style={{padding:'12px',textAlign:'right',color:S.text2}}>{PCT((p.propina/propTotal)*100)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{background:S.bg3,borderTop:`2px solid ${S.border}`}}>
                  <td style={{padding:'12px',fontWeight:700,color:S.green}}>TOTAL</td><td/>
                  <td style={{padding:'12px',textAlign:'right',fontWeight:700,color:S.blue}}>{MOCK_PROPINAS.reduce((a,p)=>a+p.mesas,0)}</td>
                  <td style={{padding:'12px',textAlign:'right',fontWeight:900,color:S.green,fontSize:14}}>{COP(propTotal)}</td>
                  <td style={{padding:'12px',textAlign:'right',fontWeight:700,color:S.gold}}>{COP(Math.round(propTotal/MOCK_PROPINAS.reduce((a,p)=>a+p.mesas,0)))}</td>
                  <td style={{padding:'12px',textAlign:'right',color:S.text3}}>100%</td>
                </tr></tfoot>
              </table>
            </div>
          </div>
        )}

        {/* PROMOCIONES */}
        {tab==='promociones' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:12,fontWeight:700,color:S.goldL}}>MOTOR DE PROMOCIONES</div>
              <button onClick={()=>showToast('Próximamente: crear nueva promoción')} style={{background:S.gold,color:'#000',border:'none',padding:'8px 16px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>+ Nueva promoción</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
              {MOCK_PROMO.map(promo=>(
                <div key={promo.id} style={{background:S.bg2,border:`1px solid ${promo.activa?promo.color+'30':S.border}`,borderRadius:14,padding:18,opacity:promo.activa?1:0.6}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:S.text1}}>{promo.nombre}</div>
                      <div style={{fontSize:11,color:S.text3,marginTop:3}}>{promo.aplica}</div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{background:`${promo.color}20`,color:promo.color,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>
                        {promo.tipo==='2x1'?'2x1':promo.tipo==='cortesia'?'Cortesía':`${promo.desc}% OFF`}
                      </span>
                      <div style={{width:36,height:20,borderRadius:10,background:promo.activa?S.green:S.border,position:'relative',cursor:'pointer',transition:'background .2s'}}
                        onClick={()=>showToast(`Promoción ${promo.activa?'desactivada':'activada'}`)}>
                        <div style={{position:'absolute',top:2,left:promo.activa?18:2,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'left .2s'}}/>
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{fontSize:11,color:S.text3}}>Usos hoy: <span style={{color:promo.color,fontWeight:700}}>{promo.usos}</span></div>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>showToast('Editar promoción')} style={{background:S.bg3,border:`1px solid ${S.border}`,color:S.text2,padding:'4px 10px',borderRadius:6,fontSize:10,cursor:'pointer'}}>✏️ Editar</button>
                      <button onClick={()=>showToast('Ver historial')} style={{background:S.bg3,border:`1px solid ${S.border}`,color:S.text2,padding:'4px 10px',borderRadius:6,fontSize:10,cursor:'pointer'}}>📊 Stats</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{background:`${S.gold}10`,border:`1px solid ${S.gold}30`,borderRadius:12,padding:14}}>
              <div style={{fontSize:12,fontWeight:700,color:S.goldL,marginBottom:10}}>⚡ REGLAS ACTIVAS AHORA</div>
              <div style={{fontSize:12,color:S.text2,lineHeight:2}}>
                ✓ Happy Hour activo — cocteles 2x1 hasta las 7pm<br/>
                ✓ Gourmand Society — 20% en toda la carta<br/>
                ✓ Cumpleañeros — postre gratis con verificación
              </div>
            </div>
          </div>
        )}

        {/* FACTURAS */}
        {tab==='facturas' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{padding:14,background:`${S.blue}10`,border:`1px solid ${S.blue}30`,borderRadius:12,fontSize:12,color:S.blue}}>
              📋 Las facturas electrónicas emitidas desde el módulo DIAN aparecen aquí automáticamente para causación contable.
            </div>
            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:S.bg3}}>
                  {['#','Cliente','NIT','Fecha','Subtotal','IVA','Retención','Total','Estado'].map(h=>(
                    <th key={h} style={{padding:'10px 10px',textAlign:['Subtotal','IVA','Retención','Total'].includes(h)?'right':'left',color:S.text3,fontWeight:700,fontSize:10,textTransform:'uppercase' as const}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {[
                    {num:'FE-1201',cliente:'Andrés López',    nit:'10234567',  fecha:'08/04/2026',sub:285000,iva:54150, ret:7125, estado:'APROBADA'},
                    {num:'FE-1202',cliente:'Patricia García', nit:'52198432',  fecha:'08/04/2026',sub:420000,iva:79800, ret:10500,estado:'APROBADA'},
                    {num:'FE-1203',cliente:'Empresa ABC SAS', nit:'900123456', fecha:'08/04/2026',sub:850000,iva:161500,ret:21250,estado:'PROCESANDO'},
                    {num:'FE-1204',cliente:'Cliente Final',   nit:'222333444', fecha:'08/04/2026',sub:165000,iva:31350, ret:4125, estado:'APROBADA'},
                  ].map((f,i)=>{
                    const total=f.sub+f.iva-f.ret;
                    const ec=f.estado==='APROBADA'?S.green:S.gold;
                    return (
                      <tr key={i} style={{borderTop:`1px solid ${S.border}`}}>
                        <td style={{padding:'10px',color:S.goldL}}>{f.num}</td>
                        <td style={{padding:'10px',color:S.text1}}>{f.cliente}</td>
                        <td style={{padding:'10px',color:S.text3,fontSize:10}}>{f.nit}</td>
                        <td style={{padding:'10px',color:S.text3}}>{f.fecha}</td>
                        <td style={{padding:'10px',textAlign:'right',color:S.text1}}>{COP(f.sub)}</td>
                        <td style={{padding:'10px',textAlign:'right',color:S.blue}}>{COP(f.iva)}</td>
                        <td style={{padding:'10px',textAlign:'right',color:S.red}}>({COP(f.ret)})</td>
                        <td style={{padding:'10px',textAlign:'right',fontWeight:700,color:S.green}}>{COP(total)}</td>
                        <td style={{padding:'10px'}}><span style={{background:`${ec}20`,color:ec,padding:'3px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>{f.estado}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
