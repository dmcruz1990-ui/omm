// ============================================================
// NEXUM — ContabilidadModule.tsx
// Módulo de Contabilidad, P&G, Inventario y Reportes
// src/components/ContabilidadModule.tsx
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ── Tema Nexum ───────────────────────────────────────────────
const S = {
  bg:    '#0a0a0a', bg2: '#141414', bg3: '#1c1c1c',
  border:'#2a2a2a', text1:'#f0f0f0', text2:'#a0a0a0', text3:'#606060',
  gold:  '#d4943a', goldL:'#f0b45a', green:'#3dba6f',
  red:   '#e05050', blue: '#4a8fd4', purple:'#9b72ff',
};

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n);

const PCT = (n: number) => `${n.toFixed(1)}%`;

// ── Tipos ────────────────────────────────────────────────────
type Tab = 'cierre' | 'pyg' | 'inventario' | 'propinas' | 'facturas';

// ── Datos mock — en producción vienen de Supabase ────────────
const MOCK_CIERRE = {
  fecha: new Date().toLocaleDateString('es-CO'),
  metodos: [
    { label:'💳 Datafono',       bruto:1850000, descuentos:120000, propinas:185000, iva:296000 },
    { label:'💵 Efectivo',        bruto:980000,  descuentos:50000,  propinas:98000,  iva:156800 },
    { label:'🏦 Transferencia',   bruto:650000,  descuentos:0,      propinas:65000,  iva:104000 },
    { label:'📱 QR Occidente',    bruto:420000,  descuentos:0,      propinas:42000,  iva:67200  },
    { label:'🍎 Apple Pay',       bruto:180000,  descuentos:0,      propinas:18000,  iva:28800  },
    { label:'💰 Anticipo Evento', bruto:500000,  descuentos:0,      propinas:0,      iva:80000  },
    { label:'👤 Cuenta Empleado', bruto:85000,   descuentos:85000,  propinas:0,      iva:0      },
    { label:'🎁 Bono / Regalo',   bruto:75000,   descuentos:75000,  propinas:0,      iva:0      },
  ],
  descCateg: [
    { label:'📰 Prensa / Influencer', monto:120000, obs:'Mesa Influencer @seratta_omm' },
    { label:'🙏 Reivindicación',       monto:45000,  obs:'Demora cocina mesa 8' },
    { label:'⭐ Fidelización',          monto:60000,  obs:'Cliente VIP Sr. López 20%' },
    { label:'🏠 Consumo Interno',      monto:85000,  obs:'Reunión dirección restaurante' },
    { label:'👤 Descuento Empleado',   monto:85000,  obs:'Descuento colaborador nómina' },
    { label:'🤝 Descuento Socio',      monto:35000,  obs:'Socio estratégico evento' },
  ],
};

const MOCK_PYG = {
  ingresos: { alimentos:8500000, bebidas:4200000, cocteles:2800000, otros:450000 },
  costos:   { alimentos:2550000, bebidas:1260000 },
  gastos:   { nomina:3800000, arriendo:2200000, servicios:650000, marketing:480000, tecnologia:200000, aseo:320000, otros:280000 },
  iva_recaudado: 1558400,
  retenciones: 380000,
};

const MOCK_INVENTARIO = [
  { nombre:'Salmón fresco',    unidad:'kg',  teorico:20, real:18, costo:45000, categoria:'ALIMENTOS' },
  { nombre:'Arroz japonés',    unidad:'kg',  teorico:15, real:15, costo:8500,  categoria:'ALIMENTOS' },
  { nombre:'Camarón tigre',    unidad:'kg',  teorico:10, real:8,  costo:38000, categoria:'ALIMENTOS' },
  { nombre:'Pulpo',            unidad:'kg',  teorico:8,  real:9,  costo:52000, categoria:'ALIMENTOS' },
  { nombre:'Entraña Angus',    unidad:'kg',  teorico:8,  real:6,  costo:48000, categoria:'ALIMENTOS' },
  { nombre:'Sake Momokawa',    unidad:'bot', teorico:24, real:22, costo:85000, categoria:'BEBIDAS'   },
  { nombre:'Heineken caja 24', unidad:'caja',teorico:10, real:10, costo:72000, categoria:'BEBIDAS'   },
  { nombre:'Aceite sésamo',    unidad:'lt',  teorico:5,  real:4,  costo:28000, categoria:'INSUMOS'   },
  { nombre:'Salsa soja',       unidad:'lt',  teorico:8,  real:8,  costo:18000, categoria:'INSUMOS'   },
];

const MOCK_PROPINAS = [
  { nombre:'Juan García',    cedula:'10234567', mesas:24, propina:285000 },
  { nombre:'María López',    cedula:'52198432', mesas:18, propina:210000 },
  { nombre:'Carlos Ruiz',    cedula:'80145623', mesas:21, propina:248000 },
  { nombre:'Ana Martínez',   cedula:'43876210', mesas:16, propina:192000 },
  { nombre:'Luis Hernández', cedula:'19345678', mesas:19, propina:228000 },
];

// ── Componente principal ─────────────────────────────────────
export default function ContabilidadModule() {
  const [tab, setTab] = useState<Tab>('cierre');
  const [toast, setToast] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('hoy');
  const [loadingExport, setLoadingExport] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const exportarExcel = async () => {
    setLoadingExport(true);
    setTimeout(() => {
      showToast('✓ Reporte Excel generado — revisa tus descargas');
      setLoadingExport(false);
    }, 1500);
  };

  // Cálculos cierre
  const totalBruto     = MOCK_CIERRE.metodos.reduce((a, m) => a + m.bruto, 0);
  const totalDesc      = MOCK_CIERRE.metodos.reduce((a, m) => a + m.descuentos, 0);
  const totalPropinas  = MOCK_CIERRE.metodos.reduce((a, m) => a + m.propinas, 0);
  const totalIVA       = MOCK_CIERRE.metodos.reduce((a, m) => a + m.iva, 0);
  const totalNeto      = totalBruto - totalDesc;

  // Cálculos P&G
  const ingresosTotal = Object.values(MOCK_PYG.ingresos).reduce((a,b) => a+b, 0);
  const costosTotal   = Object.values(MOCK_PYG.costos).reduce((a,b) => a+b, 0);
  const gastosTotal   = Object.values(MOCK_PYG.gastos).reduce((a,b) => a+b, 0);
  const utilBruta     = ingresosTotal - costosTotal;
  const ebitda        = utilBruta - gastosTotal;
  const utilNeta      = ebitda - (ebitda * 0.33);
  const margenBruto   = (utilBruta / ingresosTotal) * 100;
  const margenNeto    = (utilNeta / ingresosTotal) * 100;

  // Cálculos inventario
  const totalVarianza = MOCK_INVENTARIO.reduce((a, i) => a + ((i.teorico - i.real) * i.costo), 0);
  const itemsCriticos = MOCK_INVENTARIO.filter(i => i.real < i.teorico).length;

  // Cálculos propinas
  const totalPropMes  = MOCK_PROPINAS.reduce((a, p) => a + p.propina, 0);

  const inp = {
    background: S.bg2, border: `1px solid ${S.border}`, borderRadius: 8,
    padding: '6px 12px', color: S.text1, fontSize: 12, outline: 'none',
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:S.bg, color:S.text1, fontFamily:"'DM Sans', sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#222', border:`1px solid ${S.border}`, color:S.text1, padding:'10px 20px', borderRadius:10, fontSize:13, zIndex:9999 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'16px 24px', borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg, ${S.gold}, #b07820)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>📊</div>
          <div>
            <div style={{ fontFamily:"'Syne', sans-serif", fontSize:16, fontWeight:900 }}>CONTABILIDAD</div>
            <div style={{ fontSize:11, color:S.text3 }}>OMM Restaurante · PUC Colombia</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <select value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)} style={{ ...inp }}>
            <option value="hoy">Hoy</option>
            <option value="semana">Esta semana</option>
            <option value="mes">Este mes</option>
            <option value="trimestre">Trimestre</option>
          </select>
          <button onClick={exportarExcel} disabled={loadingExport}
            style={{ background:S.gold, color:'#000', border:'none', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {loadingExport ? '⏳ Generando...' : '⬇️ Exportar Excel'}
          </button>
        </div>
      </div>

      {/* KPIs rápidos */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, padding:'12px 16px', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
        {[
          { label:'Ventas netas',    value:COP(totalNeto),       color:S.goldL  },
          { label:'Utilidad bruta',  value:PCT(margenBruto),     color:S.green  },
          { label:'EBITDA',          value:COP(ebitda),          color:S.gold   },
          { label:'Total propinas',  value:COP(totalPropinas),   color:S.blue   },
          { label:'Varianza stock',  value:COP(totalVarianza),   color:totalVarianza > 0 ? S.red : S.green },
        ].map(kpi => (
          <div key={kpi.label} style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, padding:'12px 14px' }}>
            <div style={{ fontSize:10, color:S.text3, marginBottom:4 }}>{kpi.label}</div>
            <div style={{ fontSize:16, fontWeight:900, color:kpi.color, fontFamily:"'Syne', sans-serif" }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
        {([
          { id:'cierre',    icon:'🔒', label:'Cierre del día'  },
          { id:'pyg',       icon:'📈', label:'P&G'             },
          { id:'inventario',icon:'📦', label:'Inventario'      },
          { id:'propinas',  icon:'💚', label:'Propinas'        },
          { id:'facturas',  icon:'🧾', label:'Facturas'        },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, padding:'11px 6px', background:'none', border:'none', cursor:'pointer', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color: tab === t.id ? S.gold : S.text3, borderBottom:`2px solid ${tab === t.id ? S.gold : 'transparent'}`, transition:'all 0.15s' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:16 }}>

        {/* ── CIERRE DEL DÍA ── */}
        {tab === 'cierre' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Ventas por método */}
            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${S.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:12, fontWeight:700, color:S.goldL }}>VENTAS POR MÉTODO DE PAGO</div>
                <div style={{ fontSize:11, color:S.text3 }}>{MOCK_CIERRE.fecha}</div>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:S.bg3 }}>
                    {['Método','Bruto','Descuentos','Propinas','IVA','Neto'].map(h => (
                      <th key={h} style={{ padding:'8px 14px', textAlign: h==='Método' ? 'left' : 'right', color:S.text3, fontWeight:700, fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_CIERRE.metodos.map((m, i) => {
                    const neto = m.bruto - m.descuentos;
                    return (
                      <tr key={i} style={{ borderTop:`1px solid ${S.border}` }}>
                        <td style={{ padding:'10px 14px', color:S.text1 }}>{m.label}</td>
                        <td style={{ padding:'10px 14px', textAlign:'right', color:S.goldL }}>{COP(m.bruto)}</td>
                        <td style={{ padding:'10px 14px', textAlign:'right', color: m.descuentos > 0 ? S.red : S.text3 }}>{m.descuentos > 0 ? COP(m.descuentos) : '—'}</td>
                        <td style={{ padding:'10px 14px', textAlign:'right', color:S.green }}>{m.propinas > 0 ? COP(m.propinas) : '—'}</td>
                        <td style={{ padding:'10px 14px', textAlign:'right', color:S.blue }}>{m.iva > 0 ? COP(m.iva) : '—'}</td>
                        <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:700, color:S.goldL }}>{COP(neto)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background:S.bg3, borderTop:`2px solid ${S.border}` }}>
                    <td style={{ padding:'12px 14px', fontWeight:700, color:S.gold }}>TOTAL</td>
                    <td style={{ padding:'12px 14px', textAlign:'right', fontWeight:700, color:S.goldL }}>{COP(totalBruto)}</td>
                    <td style={{ padding:'12px 14px', textAlign:'right', fontWeight:700, color:S.red }}>{COP(totalDesc)}</td>
                    <td style={{ padding:'12px 14px', textAlign:'right', fontWeight:700, color:S.green }}>{COP(totalPropinas)}</td>
                    <td style={{ padding:'12px 14px', textAlign:'right', fontWeight:700, color:S.blue }}>{COP(totalIVA)}</td>
                    <td style={{ padding:'12px 14px', textAlign:'right', fontWeight:900, color:S.gold, fontSize:14 }}>{COP(totalNeto)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Descuentos por categoría */}
            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${S.border}` }}>
                <div style={{ fontSize:12, fontWeight:700, color:S.red }}>DESCUENTOS POR CATEGORÍA</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {MOCK_CIERRE.descCateg.map((d, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', borderBottom:`1px solid ${S.border}` }}>
                    <div>
                      <div style={{ fontSize:12, color:S.text1 }}>{d.label}</div>
                      <div style={{ fontSize:10, color:S.text3, marginTop:2 }}>{d.obs}</div>
                    </div>
                    <div style={{ fontSize:13, fontWeight:700, color:S.red }}>{COP(d.monto)}</div>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 16px', background:S.bg3 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:S.red }}>TOTAL DESCUENTOS</div>
                  <div style={{ fontSize:14, fontWeight:900, color:S.red }}>{COP(MOCK_CIERRE.descCateg.reduce((a,d) => a + d.monto, 0))}</div>
                </div>
              </div>
            </div>

            {/* Resumen sincronización contable */}
            <div style={{ background:`${S.green}10`, border:`1px solid ${S.green}30`, borderRadius:14, padding:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:S.green, marginBottom:10 }}>✓ SINCRONIZACIÓN CONTABLE</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { label:'Ventas brutas del día',  value:COP(totalBruto),    color:S.goldL },
                  { label:'Total descuentos',        value:COP(totalDesc),     color:S.red   },
                  { label:'Total propinas',          value:COP(totalPropinas), color:S.green },
                  { label:'IVA recaudado',           value:COP(totalIVA),      color:S.blue  },
                  { label:'VENTAS NETAS DEL DÍA',   value:COP(totalNeto),     color:S.gold  },
                  { label:'Pendiente de cierre',     value:'$0',               color:S.green },
                ].map(r => (
                  <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:S.bg2, borderRadius:8 }}>
                    <span style={{ fontSize:11, color:S.text2 }}>{r.label}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:r.color }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── P&G ── */}
        {tab === 'pyg' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* KPIs P&G */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {[
                { label:'Ingresos totales',  value:COP(ingresosTotal), color:S.goldL },
                { label:'Margen bruto',      value:PCT(margenBruto),   color:S.green },
                { label:'EBITDA',            value:COP(ebitda),        color:S.gold  },
                { label:'Margen neto',       value:PCT(margenNeto),    color:margenNeto > 15 ? S.green : S.red },
              ].map(kpi => (
                <div key={kpi.label} style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, padding:14 }}>
                  <div style={{ fontSize:10, color:S.text3, marginBottom:4 }}>{kpi.label}</div>
                  <div style={{ fontSize:20, fontWeight:900, color:kpi.color, fontFamily:"'Syne', sans-serif" }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            {/* Tabla P&G */}
            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${S.border}` }}>
                <div style={{ fontSize:12, fontWeight:700, color:S.goldL }}>ESTADO DE RESULTADOS — PUC COLOMBIA</div>
              </div>

              {/* INGRESOS */}
              <PYGSection titulo="INGRESOS OPERACIONALES" color={S.goldL} items={[
                { puc:'4135', label:'Ventas de alimentos',  valor:MOCK_PYG.ingresos.alimentos  },
                { puc:'4135', label:'Ventas de bebidas',    valor:MOCK_PYG.ingresos.bebidas    },
                { puc:'4135', label:'Ventas de cocteles',   valor:MOCK_PYG.ingresos.cocteles   },
                { puc:'4295', label:'Otros ingresos',       valor:MOCK_PYG.ingresos.otros      },
              ]} total={ingresosTotal} />

              {/* COSTOS */}
              <PYGSection titulo="COSTOS DE VENTAS" color={S.red} items={[
                { puc:'6135', label:'Costo de alimentos', valor:MOCK_PYG.costos.alimentos },
                { puc:'6135', label:'Costo de bebidas',   valor:MOCK_PYG.costos.bebidas   },
              ]} total={costosTotal} />

              {/* UTILIDAD BRUTA */}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 16px', background:S.bg3, borderTop:`2px solid ${S.green}40` }}>
                <div style={{ fontSize:13, fontWeight:900, color:S.green }}>UTILIDAD BRUTA</div>
                <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                  <span style={{ fontSize:11, color:S.text3 }}>Margen: {PCT(margenBruto)}</span>
                  <span style={{ fontSize:14, fontWeight:900, color:S.green }}>{COP(utilBruta)}</span>
                </div>
              </div>

              {/* GASTOS */}
              <PYGSection titulo="GASTOS OPERACIONALES" color={S.purple} items={[
                { puc:'5105', label:'Nómina y prestaciones',   valor:MOCK_PYG.gastos.nomina     },
                { puc:'5120', label:'Arriendo',                valor:MOCK_PYG.gastos.arriendo   },
                { puc:'5115', label:'Servicios públicos',      valor:MOCK_PYG.gastos.servicios  },
                { puc:'5145', label:'Marketing y publicidad',  valor:MOCK_PYG.gastos.marketing  },
                { puc:'5195', label:'Tecnología (Nexum)',      valor:MOCK_PYG.gastos.tecnologia },
                { puc:'5140', label:'Aseo y mantenimiento',    valor:MOCK_PYG.gastos.aseo       },
                { puc:'5295', label:'Otros gastos',            valor:MOCK_PYG.gastos.otros      },
              ]} total={gastosTotal} />

              {/* EBITDA */}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'14px 16px', background:S.bg3, borderTop:`2px solid ${S.gold}40` }}>
                <div style={{ fontSize:14, fontWeight:900, color:S.gold }}>EBITDA</div>
                <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                  <span style={{ fontSize:11, color:S.text3 }}>{PCT((ebitda/ingresosTotal)*100)} margen</span>
                  <span style={{ fontSize:15, fontWeight:900, color:S.gold }}>{COP(ebitda)}</span>
                </div>
              </div>

              {/* IVA y retenciones */}
              <PYGSection titulo="IMPUESTOS Y RETENCIONES" color={S.blue} items={[
                { puc:'2408', label:'IVA recaudado',  valor:MOCK_PYG.iva_recaudado },
                { puc:'2365', label:'Retenciones',    valor:MOCK_PYG.retenciones  },
              ]} total={MOCK_PYG.iva_recaudado + MOCK_PYG.retenciones} />

              {/* Impuesto renta */}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 16px', borderTop:`1px solid ${S.border}` }}>
                <span style={{ fontSize:11, color:S.text2 }}>  5512  Impuesto de renta (33%)</span>
                <span style={{ fontSize:12, color:S.red }}>({COP(ebitda * 0.33)})</span>
              </div>

              {/* UTILIDAD NETA */}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'16px', background:`${S.green}10`, borderTop:`2px solid ${S.green}40` }}>
                <div style={{ fontSize:15, fontWeight:900, color:S.green }}>UTILIDAD NETA</div>
                <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                  <span style={{ fontSize:11, color:S.text3 }}>Margen neto: {PCT(margenNeto)}</span>
                  <span style={{ fontSize:16, fontWeight:900, color:S.green }}>{COP(utilNeta)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── INVENTARIO ── */}
        {tab === 'inventario' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              {[
                { label:'Items con faltante',  value:`${itemsCriticos}`,         color:S.red   },
                { label:'Varianza en pesos',   value:COP(totalVarianza),         color:totalVarianza > 0 ? S.red : S.green },
                { label:'Items en inventario', value:`${MOCK_INVENTARIO.length}`,color:S.text2 },
              ].map(kpi => (
                <div key={kpi.label} style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, padding:14 }}>
                  <div style={{ fontSize:10, color:S.text3, marginBottom:4 }}>{kpi.label}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:kpi.color }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:S.bg3 }}>
                    {['Producto','Cat.','Unidad','Teórico','Real','Diferencia','Varianza $','Estado'].map(h => (
                      <th key={h} style={{ padding:'10px 12px', textAlign: h==='Producto'||h==='Cat.' ? 'left':'right', color:S.text3, fontWeight:700, fontSize:10, textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_INVENTARIO.map((item, i) => {
                    const diff = item.real - item.teorico;
                    const varianza = diff * item.costo;
                    const estado = diff < 0 ? { label:'⚠ Faltante', color:S.red } : diff > 0 ? { label:'↑ Sobrante', color:S.blue } : { label:'✓ OK', color:S.green };
                    return (
                      <tr key={i} style={{ borderTop:`1px solid ${S.border}`, background: diff < 0 ? `${S.red}08` : 'transparent' }}>
                        <td style={{ padding:'10px 12px', color:S.text1 }}>{item.nombre}</td>
                        <td style={{ padding:'10px 12px', color:S.text3, fontSize:10 }}>{item.categoria}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', color:S.text2 }}>{item.unidad}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', color:S.blue }}>{item.teorico}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', color:S.green }}>{item.real}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color: diff < 0 ? S.red : diff > 0 ? S.blue : S.green }}>{diff > 0 ? '+' : ''}{diff}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color: varianza < 0 ? S.red : S.green }}>{COP(Math.abs(varianza))}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', fontSize:11, fontWeight:700, color:estado.color }}>{estado.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background:S.bg3, borderTop:`2px solid ${S.border}` }}>
                    <td colSpan={6} style={{ padding:'12px', fontWeight:700, color:S.gold }}>TOTAL VARIANZA</td>
                    <td style={{ padding:'12px', textAlign:'right', fontWeight:900, color: totalVarianza > 0 ? S.red : S.green, fontSize:14 }}>{COP(Math.abs(totalVarianza))}</td>
                    <td style={{ padding:'12px', textAlign:'right', fontSize:11, color: itemsCriticos > 0 ? S.red : S.green }}>{itemsCriticos} faltantes</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── PROPINAS ── */}
        {tab === 'propinas' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              {[
                { label:'Total propinas mes',       value:COP(totalPropMes),                                                color:S.green },
                { label:'Promedio por colaborador', value:COP(totalPropMes / MOCK_PROPINAS.length),                        color:S.blue  },
                { label:'Propina promedio por mesa', value:COP(totalPropMes / MOCK_PROPINAS.reduce((a,p)=>a+p.mesas,0)),   color:S.gold  },
              ].map(kpi => (
                <div key={kpi.label} style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, padding:14 }}>
                  <div style={{ fontSize:10, color:S.text3, marginBottom:4 }}>{kpi.label}</div>
                  <div style={{ fontSize:18, fontWeight:900, color:kpi.color }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${S.border}` }}>
                <div style={{ fontSize:12, fontWeight:700, color:S.green }}>DETALLE POR COLABORADOR · {new Date().toLocaleDateString('es-CO',{month:'long',year:'numeric'}).toUpperCase()}</div>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:S.bg3 }}>
                    {['Colaborador','Cédula','Mesas','Propina recibida','Promedio/mesa','% del total'].map(h => (
                      <th key={h} style={{ padding:'10px 12px', textAlign: h==='Colaborador'||h==='Cédula' ? 'left':'right', color:S.text3, fontWeight:700, fontSize:10, textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_PROPINAS.sort((a,b) => b.propina - a.propina).map((p, i) => (
                    <tr key={i} style={{ borderTop:`1px solid ${S.border}` }}>
                      <td style={{ padding:'12px', color:S.text1, fontWeight: i===0 ? 700 : 400 }}>
                        {i===0 && '🏆 '}{p.nombre}
                      </td>
                      <td style={{ padding:'12px', color:S.text3 }}>{p.cedula}</td>
                      <td style={{ padding:'12px', textAlign:'right', color:S.blue }}>{p.mesas}</td>
                      <td style={{ padding:'12px', textAlign:'right', fontWeight:700, color:S.green }}>{COP(p.propina)}</td>
                      <td style={{ padding:'12px', textAlign:'right', color:S.gold }}>{COP(Math.round(p.propina/p.mesas))}</td>
                      <td style={{ padding:'12px', textAlign:'right', color:S.text2 }}>{PCT((p.propina/totalPropMes)*100)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:S.bg3, borderTop:`2px solid ${S.border}` }}>
                    <td style={{ padding:'12px', fontWeight:700, color:S.green }}>TOTAL</td>
                    <td></td>
                    <td style={{ padding:'12px', textAlign:'right', fontWeight:700, color:S.blue }}>{MOCK_PROPINAS.reduce((a,p)=>a+p.mesas,0)}</td>
                    <td style={{ padding:'12px', textAlign:'right', fontWeight:900, color:S.green, fontSize:14 }}>{COP(totalPropMes)}</td>
                    <td style={{ padding:'12px', textAlign:'right', fontWeight:700, color:S.gold }}>{COP(Math.round(totalPropMes/MOCK_PROPINAS.reduce((a,p)=>a+p.mesas,0)))}</td>
                    <td style={{ padding:'12px', textAlign:'right', color:S.text3 }}>100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── FACTURAS CAUSADAS ── */}
        {tab === 'facturas' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ padding:16, background:`${S.blue}10`, border:`1px solid ${S.blue}30`, borderRadius:12, fontSize:12, color:S.blue }}>
              📋 Las facturas electrónicas emitidas desde el módulo DIAN aparecen aquí automáticamente para causación contable.
            </div>
            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${S.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:12, fontWeight:700, color:S.goldL }}>FACTURAS ELECTRÓNICAS — CAUSACIÓN</div>
                <div style={{ display:'flex', gap:8 }}>
                  <button style={{ background:S.bg3, border:`1px solid ${S.border}`, color:S.text2, padding:'5px 10px', borderRadius:8, fontSize:11, cursor:'pointer' }}>Emitidas</button>
                  <button style={{ background:S.bg3, border:`1px solid ${S.border}`, color:S.text2, padding:'5px 10px', borderRadius:8, fontSize:11, cursor:'pointer' }}>Recibidas</button>
                </div>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:S.bg3 }}>
                    {['#','Cliente / Proveedor','NIT','Fecha','Subtotal','IVA','Retención','Total','Estado'].map(h => (
                      <th key={h} style={{ padding:'10px 10px', textAlign: h==='#'||h==='Cliente / Proveedor'||h==='NIT'||h==='Fecha'||h==='Estado' ? 'left':'right', color:S.text3, fontWeight:700, fontSize:10, textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { num:'FE-1201', cliente:'Andrés López', nit:'10234567', fecha:'08/04/2026', sub:285000, iva:54150, ret:7125,  estado:'APROBADA' },
                    { num:'FE-1202', cliente:'Patricia García', nit:'52198432', fecha:'08/04/2026', sub:420000, iva:79800, ret:10500, estado:'APROBADA' },
                    { num:'FE-1203', cliente:'Empresa ABC SAS', nit:'900123456', fecha:'08/04/2026', sub:850000, iva:161500, ret:21250, estado:'PROCESANDO' },
                    { num:'FE-1204', cliente:'Cliente Final', nit:'222333444', fecha:'08/04/2026', sub:165000, iva:31350, ret:4125, estado:'APROBADA' },
                  ].map((f, i) => {
                    const total = f.sub + f.iva - f.ret;
                    const estadoColor = f.estado === 'APROBADA' ? S.green : f.estado === 'PROCESANDO' ? S.gold : S.red;
                    return (
                      <tr key={i} style={{ borderTop:`1px solid ${S.border}` }}>
                        <td style={{ padding:'10px', color:S.goldL }}>{f.num}</td>
                        <td style={{ padding:'10px', color:S.text1 }}>{f.cliente}</td>
                        <td style={{ padding:'10px', color:S.text3, fontSize:10 }}>{f.nit}</td>
                        <td style={{ padding:'10px', color:S.text3 }}>{f.fecha}</td>
                        <td style={{ padding:'10px', textAlign:'right', color:S.text1 }}>{COP(f.sub)}</td>
                        <td style={{ padding:'10px', textAlign:'right', color:S.blue }}>{COP(f.iva)}</td>
                        <td style={{ padding:'10px', textAlign:'right', color:S.red }}>({COP(f.ret)})</td>
                        <td style={{ padding:'10px', textAlign:'right', fontWeight:700, color:S.green }}>{COP(total)}</td>
                        <td style={{ padding:'10px' }}>
                          <span style={{ background:`${estadoColor}20`, color:estadoColor, padding:'3px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>{f.estado}</span>
                        </td>
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

// ── Sub-componente P&G Section ───────────────────────────────
function PYGSection({ titulo, color, items, total }: {
  titulo: string; color: string;
  items: { puc: string; label: string; valor: number }[];
  total: number;
}) {
  return (
    <div style={{ borderTop:`1px solid #2a2a2a` }}>
      <div style={{ padding:'10px 16px', background:'#1c1c1c' }}>
        <span style={{ fontSize:10, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.08em' }}>{titulo}</span>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 16px', borderTop:'1px solid #1c1c1c' }}>
          <span style={{ fontSize:11, color:'#606060' }}>  {item.puc}  <span style={{ color:'#a0a0a0' }}>{item.label}</span></span>
          <span style={{ fontSize:12, color:'#f0f0f0' }}>{new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(item.valor)}</span>
        </div>
      ))}
      <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 16px', background:'#1a1a1a', borderTop:`1px solid ${color}30` }}>
        <span style={{ fontSize:11, fontWeight:700, color }}>TOTAL {titulo.split(' ')[0]}</span>
        <span style={{ fontSize:13, fontWeight:700, color }}>{new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(total)}</span>
      </div>
    </div>
  );
}
