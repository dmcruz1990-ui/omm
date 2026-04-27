import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';

const S = {
  bg:'#08080f', bg2:'#111118', bg3:'#18181f', bg4:'#22222a',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.12)',
  t1:'#FFFFFF', t2:'#A0A0B8', t3:'#50506A',
  gold:'#FFB547', goldD:'#d4943a',
  green:'#00E676', greenD:'#3dba6f',
  red:'#FF5252', blue:'#448AFF',
  purple:'#B388FF', cyan:'#22d3ee',
  orange:'#FF7043',
};

const C = {
  carnico:'#FF5252', pescado:'#448AFF', lacteo:'#B388FF',
  bebidas:'#22d3ee', licores:'#FFB547', abarrotes:'#00E676',
  frutas:'#FF7043', verduras:'#69F0AE', secos:'#d4943a',
  panaderia:'#f0b45a', limpieza:'#9b72ff', empaques:'#60a5fa',
};

type Tab = 'dashboard' | 'proveedores' | 'materias' | 'subpreps' | 'recetas' | 'compras' | 'alertas' | 'recepcion' | 'conteos';

const inp: React.CSSProperties = {
  background:'rgba(255,255,255,0.05)', border:`1px solid ${S.border2}`,
  borderRadius:8, padding:'9px 14px', color:S.t1, fontSize:13, outline:'none', width:'100%',
};
const fmt = (n:number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtKg = (n:number, u='gr') => n>=1000?`${(n/1000).toFixed(2)}kg`:n>=1?`${Math.round(n)}${u}`:`${n}${u}`;

interface Supplier { id:number; nombre:string; categoria:string; contacto_nombre?:string; contacto_telefono?:string; ciudad?:string; lead_time_dias:number; score_total:number; score_calidad:number; score_cumplimiento:number; score_precio:number; score_confiabilidad:number; activo:boolean; condiciones_pago?:string; dias_despacho?:string[]; }
interface MateriaPrima { id:number; nombre:string; categoria:string; unidad_compra:string; costo_unitario:number; rendimiento_pct:number; merma_pct:number; costo_real_post_merma:number; stock_actual:number; stock_minimo:number; stock_maximo:number; vida_util_dias:number; criticidad:string; alerta_stock:boolean; consumo_diario_promedio:number; proveedor_principal_id?:number; }
interface Subprep { id:number; nombre:string; tipo:string; rendimiento_total:number; unidad_rendimiento:string; costo_total:number; costo_por_unidad:number; vida_util_dias:number; stock_actual:number; stock_minimo:number; responsable?:string; }
interface PurchaseOrder { id:number; estado:string; tipo:string; total_estimado:number; generada_por:string; fecha_sugerida:string; fecha_entrega_esperada?:string; notas?:string; supplier_id:number; }

const CATS_MP = ['carnico','pescado','ave','lacteo','fruta','verdura','abarrote','seco','bebida','licor','bar','panaderia','pasteleria','empaque','limpieza','desechable'];
const TIPOS_SUBPREP = ['salsa','fondo','jarabe','vinagreta','pure','marinada','aceite','cordial','arroz','otro'];
const CRITICIDAD_CFG: Record<string,{c:string;l:string}> = { alta:{c:S.red,l:'Alta'}, media:{c:S.gold,l:'Media'}, baja:{c:S.green,l:'Baja'} };

export default function SupplyModule() {
  const [tab, setTab]                 = useState<Tab>('dashboard');
  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [materias, setMaterias]       = useState<MateriaPrima[]>([]);
  const [subpreps, setSubpreps]       = useState<Subprep[]>([]);
  const [orders, setOrders]           = useState<PurchaseOrder[]>([]);
  const [loading, setLoading]         = useState(true);
  const [toast, setToast]             = useState('');
  const [busqueda, setBusqueda]       = useState('');
  // Modales
  const [modalProveedor, setModalProveedor] = useState(false);
  const [modalMateria, setModalMateria]     = useState(false);
  const [modalSubprep, setModalSubprep]     = useState(false);
  const [editItem, setEditItem]             = useState<any>(null);
  // Forms
  const [fProv, setFProv] = useState<any>({ nombre:'', categoria:'carnico', ciudad:'Bogotá', lead_time_dias:2, condiciones_pago:'30 dias', score_calidad:80, score_cumplimiento:80, score_precio:80, score_confiabilidad:80 });
  const [fMP, setFMP]     = useState<any>({ nombre:'', categoria:'carnico', unidad_compra:'kg', costo_unitario:0, rendimiento_pct:100, merma_pct:0, stock_actual:0, stock_minimo:0, stock_maximo:100, vida_util_dias:7, criticidad:'media', consumo_diario_promedio:0 });
  const [fSP, setFSP]     = useState<any>({ nombre:'', tipo:'salsa', rendimiento_total:1000, unidad_rendimiento:'ml', costo_total:0, vida_util_dias:5, stock_actual:0, stock_minimo:0, responsable:'' });

  const showToast = useCallback((m:string)=>{ setToast(m); setTimeout(()=>setToast(''),3000); },[]);

  const fetchAll = async () => {
    const [{ data:s },{ data:m },{ data:sp },{ data:o }] = await Promise.all([
      supabase.from('suppliers').select('*').eq('restaurante_id',6).order('score_total',{ascending:false}),
      supabase.from('materias_primas').select('*').eq('restaurante_id',6).order('nombre'),
      supabase.from('subpreparaciones').select('*').eq('restaurante_id',6).order('nombre'),
      supabase.from('purchase_orders').select('*').eq('restaurante_id',6).order('created_at',{ascending:false}).limit(20),
    ]);
    if(s) setSuppliers(s); if(m) setMaterias(m); if(sp) setSubpreps(sp); if(o) setOrders(o);
    setLoading(false);
  };

  useEffect(()=>{ fetchAll(); },[]);

  // ── Guardar proveedor ──────────────────────────────────────────────────
  const guardarProveedor = async () => {
    if(!fProv.nombre){ showToast('⚠️ Nombre requerido'); return; }
    if(editItem){ await supabase.from('suppliers').update(fProv).eq('id',editItem.id); }
    else { await supabase.from('suppliers').insert({...fProv, restaurante_id:6, activo:true}); }
    showToast(`✓ Proveedor ${fProv.nombre} guardado`);
    setModalProveedor(false); setEditItem(null);
    setFProv({ nombre:'', categoria:'carnico', ciudad:'Bogotá', lead_time_dias:2, condiciones_pago:'30 dias', score_calidad:80, score_cumplimiento:80, score_precio:80, score_confiabilidad:80 });
    fetchAll();
  };

  // ── Guardar materia prima ──────────────────────────────────────────────
  const guardarMateria = async () => {
    if(!fMP.nombre){ showToast('⚠️ Nombre requerido'); return; }
    if(editItem){ await supabase.from('materias_primas').update(fMP).eq('id',editItem.id); }
    else { await supabase.from('materias_primas').insert({...fMP, restaurante_id:6, activo:true}); }
    showToast(`✓ ${fMP.nombre} guardado`);
    setModalMateria(false); setEditItem(null);
    setFMP({ nombre:'', categoria:'carnico', unidad_compra:'kg', costo_unitario:0, rendimiento_pct:100, merma_pct:0, stock_actual:0, stock_minimo:0, stock_maximo:100, vida_util_dias:7, criticidad:'media', consumo_diario_promedio:0 });
    fetchAll();
  };

  // ── Guardar subpreparación ─────────────────────────────────────────────
  const guardarSubprep = async () => {
    if(!fSP.nombre){ showToast('⚠️ Nombre requerido'); return; }
    const costoPorUnidad = fSP.rendimiento_total > 0 ? fSP.costo_total / fSP.rendimiento_total : 0;
    if(editItem){ await supabase.from('subpreparaciones').update({...fSP, costo_por_unidad:costoPorUnidad}).eq('id',editItem.id); }
    else { await supabase.from('subpreparaciones').insert({...fSP, costo_por_unidad:costoPorUnidad, restaurante_id:6, activo:true}); }
    showToast(`✓ ${fSP.nombre} guardada`);
    setModalSubprep(false); setEditItem(null);
    setFSP({ nombre:'', tipo:'salsa', rendimiento_total:1000, unidad_rendimiento:'ml', costo_total:0, vida_util_dias:5, stock_actual:0, stock_minimo:0, responsable:'' });
    fetchAll();
  };

  // ── Generar orden de compra IA ─────────────────────────────────────────
  const generarOrdenIA = async () => {
    const criticas = materias.filter(m => m.stock_actual <= m.stock_minimo);
    if(criticas.length===0){ showToast('✓ Sin materias por debajo del mínimo'); return; }
    const { data:order } = await supabase.from('purchase_orders').insert({
      restaurante_id:6, estado:'sugerida', tipo:'semanal', generada_por:'Nexum IA',
      total_estimado: criticas.reduce((a,m)=>a+(m.stock_minimo*2-m.stock_actual)*m.costo_real_post_merma,0),
      fecha_sugerida: new Date().toISOString().split('T')[0],
    }).select().single();
    if(order) {
      await supabase.from('purchase_order_items').insert(
        criticas.map(m=>({
          order_id:(order as any).id, materia_prima_id:m.id, nombre:m.nombre,
          stock_actual:m.stock_actual, stock_necesario:m.stock_minimo*2,
          cantidad_sugerida:Math.max(0,m.stock_minimo*2-m.stock_actual),
          unidad:m.unidad_compra, precio_unitario:m.costo_unitario,
          total:Math.max(0,m.stock_minimo*2-m.stock_actual)*m.costo_unitario,
        }))
      );
    }
    showToast(`✓ Orden IA generada — ${criticas.length} items`);
    setTab('compras'); fetchAll();
  };

  // ── KPIs ───────────────────────────────────────────────────────────────
  const alertas = materias.filter(m=>m.stock_actual<=m.stock_minimo);
  const proxVencer = materias.filter(m=>m.vida_util_dias<=3&&m.stock_actual>0);
  const kpis = [
    { l:'Proveedores',   v:suppliers.length,              c:S.blue   },
    { l:'Ingredientes',  v:materias.length,               c:S.green  },
    { l:'Subpreps',      v:subpreps.length,               c:S.purple },
    { l:'🔴 Alertas',    v:alertas.length,                c:S.red    },
    { l:'Órdenes IA',    v:orders.filter(o=>o.estado==='sugerida').length, c:S.gold },
  ];

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif"}}>

      {/* Toast */}
      {toast && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:S.bg3,border:`1px solid ${S.goldD}`,color:S.t1,padding:'10px 24px',borderRadius:50,fontSize:13,zIndex:9999,whiteSpace:'nowrap'}}>{toast}</div>}

      {/* ── Modal Proveedor ── */}
      {modalProveedor && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:16,backdropFilter:'blur(8px)'}}>
          <div style={{background:S.bg3,border:`1px solid ${S.border2}`,borderRadius:20,padding:24,width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:900,marginBottom:20}}>{editItem?'Editar':'Nuevo'} Proveedor</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[{k:'nombre',l:'Nombre *'},{k:'ciudad',l:'Ciudad'},{k:'contacto_nombre',l:'Contacto'},{k:'contacto_telefono',l:'Teléfono'},{k:'contacto_email',l:'Email'},{k:'condiciones_pago',l:'Condiciones pago'}].map(f=>(
                <div key={f.k}><div style={{fontSize:10,color:S.t3,marginBottom:4}}>{f.l}</div><input style={inp} value={fProv[f.k]||''} onChange={e=>setFProv((p:any)=>({...p,[f.k]:e.target.value}))}/></div>
              ))}
              <div><div style={{fontSize:10,color:S.t3,marginBottom:4}}>Categoría</div>
                <select style={inp} value={fProv.categoria} onChange={e=>setFProv((p:any)=>({...p,categoria:e.target.value}))}>
                  {['carnico','pescado','lacteo','bebidas','licores','abarrotes','frutas','verduras','panaderia','limpieza'].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div><div style={{fontSize:10,color:S.t3,marginBottom:4}}>Lead time (días)</div><input type="number" style={inp} value={fProv.lead_time_dias} onChange={e=>setFProv((p:any)=>({...p,lead_time_dias:parseInt(e.target.value)||1}))}/></div>
            </div>
            <div style={{marginTop:16}}>
              <div style={{fontSize:11,color:S.gold,fontWeight:700,marginBottom:10}}>Score IA (0-100)</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                {[{k:'score_calidad',l:'Calidad'},{k:'score_cumplimiento',l:'Cumplimiento'},{k:'score_precio',l:'Precio'},{k:'score_confiabilidad',l:'Confiabilidad'}].map(f=>(
                  <div key={f.k}>
                    <div style={{fontSize:10,color:S.t3,marginBottom:4}}>{f.l}</div>
                    <input type="number" min={0} max={100} style={inp} value={fProv[f.k]||80} onChange={e=>setFProv((p:any)=>({...p,[f.k]:parseInt(e.target.value)||0}))}/>
                    <div style={{height:4,background:S.bg4,borderRadius:2,marginTop:4,overflow:'hidden'}}>
                      <div style={{height:'100%',background:S.green,width:`${fProv[f.k]||80}%`,borderRadius:2}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:20}}>
              <button onClick={()=>{setModalProveedor(false);setEditItem(null);}} style={{flex:1,padding:11,borderRadius:10,border:`1px solid ${S.border2}`,background:'transparent',color:S.t3,cursor:'pointer',fontSize:13}}>Cancelar</button>
              <button onClick={guardarProveedor} style={{flex:2,padding:11,borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.goldD},#b07830)`,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700}}>✓ Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Materia Prima ── */}
      {modalMateria && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:16,backdropFilter:'blur(8px)'}}>
          <div style={{background:S.bg3,border:`1px solid ${S.border2}`,borderRadius:20,padding:24,width:'100%',maxWidth:600,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:900,marginBottom:20}}>{editItem?'Editar':'Nueva'} Materia Prima</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              <div style={{gridColumn:'1/-1'}}><div style={{fontSize:10,color:S.t3,marginBottom:4}}>Nombre *</div><input style={inp} value={fMP.nombre||''} onChange={e=>setFMP((p:any)=>({...p,nombre:e.target.value}))}/></div>
              <div><div style={{fontSize:10,color:S.t3,marginBottom:4}}>Categoría</div>
                <select style={inp} value={fMP.categoria} onChange={e=>setFMP((p:any)=>({...p,categoria:e.target.value}))}>
                  {CATS_MP.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div><div style={{fontSize:10,color:S.t3,marginBottom:4}}>Unidad de compra</div>
                <select style={inp} value={fMP.unidad_compra} onChange={e=>setFMP((p:any)=>({...p,unidad_compra:e.target.value}))}>
                  {['kg','lt','unidad','gr','ml','caja','bolsa'].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
              <div><div style={{fontSize:10,color:S.t3,marginBottom:4}}>Costo unitario ($)</div><input type="number" style={inp} value={fMP.costo_unitario||''} onChange={e=>setFMP((p:any)=>({...p,costo_unitario:parseFloat(e.target.value)||0}))}/></div>
              <div><div style={{fontSize:10,color:S.t3,marginBottom:4}}>Criticidad</div>
                <select style={inp} value={fMP.criticidad} onChange={e=>setFMP((p:any)=>({...p,criticidad:e.target.value}))}>
                  {['alta','media','baja'].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {/* Rendimiento y merma */}
            <div style={{background:`${S.orange}08`,border:`1px solid ${S.orange}25`,borderRadius:12,padding:14,marginBottom:14}}>
              <div style={{fontSize:11,color:S.orange,fontWeight:700,marginBottom:10}}>⚖️ Rendimiento y merma</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <div style={{fontSize:10,color:S.t3,marginBottom:4}}>Rendimiento real (%)</div>
                  <input type="number" min={0} max={100} style={inp} value={fMP.rendimiento_pct||100} onChange={e=>setFMP((p:any)=>({...p,rendimiento_pct:parseFloat(e.target.value)||100,merma_pct:100-(parseFloat(e.target.value)||100)}))}/>
                </div>
                <div>
                  <div style={{fontSize:10,color:S.t3,marginBottom:4}}>Merma (%)</div>
                  <input type="number" min={0} max={100} style={inp} value={fMP.merma_pct||0} onChange={e=>setFMP((p:any)=>({...p,merma_pct:parseFloat(e.target.value)||0,rendimiento_pct:100-(parseFloat(e.target.value)||0)}))}/>
                </div>
              </div>
              {fMP.costo_unitario>0 && (
                <div style={{marginTop:10,background:S.bg4,borderRadius:8,padding:'8px 12px',fontSize:12}}>
                  <span style={{color:S.t3}}>Costo post-merma: </span>
                  <span style={{color:S.orange,fontWeight:700}}>{fmt(fMP.costo_unitario/(fMP.rendimiento_pct/100||1))}</span>
                  <span style={{color:S.t3}}> / {fMP.unidad_compra}</span>
                </div>
              )}
            </div>
            {/* Stock */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
              {[{k:'stock_actual',l:'Stock actual'},{k:'stock_minimo',l:'Stock mínimo'},{k:'stock_maximo',l:'Stock máximo'},{k:'vida_util_dias',l:'Vida útil (días)'},{k:'consumo_diario_promedio',l:'Consumo diario'}].map(f=>(
                <div key={f.k}><div style={{fontSize:10,color:S.t3,marginBottom:4}}>{f.l}</div><input type="number" style={inp} value={(fMP as any)[f.k]||''} onChange={e=>setFMP((p:any)=>({...p,[f.k]:parseFloat(e.target.value)||0}))}/></div>
              ))}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{setModalMateria(false);setEditItem(null);}} style={{flex:1,padding:11,borderRadius:10,border:`1px solid ${S.border2}`,background:'transparent',color:S.t3,cursor:'pointer',fontSize:13}}>Cancelar</button>
              <button onClick={guardarMateria} style={{flex:2,padding:11,borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.green},#00b85a)`,color:'#000',cursor:'pointer',fontSize:13,fontWeight:700}}>✓ Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Subpreparación ── */}
      {modalSubprep && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:16,backdropFilter:'blur(8px)'}}>
          <div style={{background:S.bg3,border:`1px solid ${S.border2}`,borderRadius:20,padding:24,width:'100%',maxWidth:480}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:900,marginBottom:20}}>{editItem?'Editar':'Nueva'} Subpreparación</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              <div style={{gridColumn:'1/-1'}}><div style={{fontSize:10,color:S.t3,marginBottom:4}}>Nombre *</div><input style={inp} value={fSP.nombre||''} onChange={e=>setFSP((p:any)=>({...p,nombre:e.target.value}))}/></div>
              <div><div style={{fontSize:10,color:S.t3,marginBottom:4}}>Tipo</div>
                <select style={inp} value={fSP.tipo} onChange={e=>setFSP((p:any)=>({...p,tipo:e.target.value}))}>
                  {TIPOS_SUBPREP.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div><div style={{fontSize:10,color:S.t3,marginBottom:4}}>Responsable</div><input style={inp} value={fSP.responsable||''} onChange={e=>setFSP((p:any)=>({...p,responsable:e.target.value}))}/></div>
              <div><div style={{fontSize:10,color:S.t3,marginBottom:4}}>Rendimiento total</div>
                <div style={{display:'flex',gap:6}}>
                  <input type="number" style={{...inp,flex:1}} value={fSP.rendimiento_total||''} onChange={e=>setFSP((p:any)=>({...p,rendimiento_total:parseFloat(e.target.value)||0}))}/>
                  <select style={{...inp,width:70}} value={fSP.unidad_rendimiento} onChange={e=>setFSP((p:any)=>({...p,unidad_rendimiento:e.target.value}))}>
                    {['ml','gr','lt','kg','unidad'].map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div><div style={{fontSize:10,color:S.t3,marginBottom:4}}>Costo total ($)</div><input type="number" style={inp} value={fSP.costo_total||''} onChange={e=>setFSP((p:any)=>({...p,costo_total:parseFloat(e.target.value)||0}))}/></div>
              <div><div style={{fontSize:10,color:S.t3,marginBottom:4}}>Vida útil (días)</div><input type="number" style={inp} value={fSP.vida_util_dias||''} onChange={e=>setFSP((p:any)=>({...p,vida_util_dias:parseInt(e.target.value)||0}))}/></div>
              <div><div style={{fontSize:10,color:S.t3,marginBottom:4}}>Stock actual</div><input type="number" style={inp} value={fSP.stock_actual||''} onChange={e=>setFSP((p:any)=>({...p,stock_actual:parseFloat(e.target.value)||0}))}/></div>
              <div><div style={{fontSize:10,color:S.t3,marginBottom:4}}>Stock mínimo</div><input type="number" style={inp} value={fSP.stock_minimo||''} onChange={e=>setFSP((p:any)=>({...p,stock_minimo:parseFloat(e.target.value)||0}))}/></div>
            </div>
            {fSP.costo_total>0&&fSP.rendimiento_total>0&&(
              <div style={{background:`${S.purple}10`,border:`1px solid ${S.purple}25`,borderRadius:8,padding:'8px 12px',marginBottom:14,fontSize:12}}>
                Costo por {fSP.unidad_rendimiento}: <span style={{color:S.purple,fontWeight:700}}>{fmt(fSP.costo_total/fSP.rendimiento_total)}</span>
              </div>
            )}
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{setModalSubprep(false);setEditItem(null);}} style={{flex:1,padding:11,borderRadius:10,border:`1px solid ${S.border2}`,background:'transparent',color:S.t3,cursor:'pointer',fontSize:13}}>Cancelar</button>
              <button onClick={guardarSubprep} style={{flex:2,padding:11,borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.purple},#7040d0)`,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700}}>✓ Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{padding:'12px 20px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,background:S.bg2,flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:40,height:40,borderRadius:12,background:`linear-gradient(135deg,${S.goldD},${S.green})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,boxShadow:`0 0 20px rgba(212,148,58,0.3)`}}>🏪</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,letterSpacing:'-0.02em'}}>SUPPLY IA</div>
            <div style={{fontSize:10,color:S.t3,textTransform:'uppercase' as const,letterSpacing:'.1em'}}>Abastecimiento inteligente — OMM</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <input placeholder="🔍 Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}
            style={{...inp,width:200,padding:'7px 14px',fontSize:12}}/>
          {tab==='proveedores'&&<button onClick={()=>{setEditItem(null);setModalProveedor(true);}} style={{padding:'8px 16px',borderRadius:10,border:'none',background:S.goldD,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>+ Proveedor</button>}
          {tab==='materias'&&<button onClick={()=>{setEditItem(null);setModalMateria(true);}} style={{padding:'8px 16px',borderRadius:10,border:'none',background:S.green,color:'#000',fontSize:12,fontWeight:700,cursor:'pointer'}}>+ Materia prima</button>}
          {tab==='subpreps'&&<button onClick={()=>{setEditItem(null);setModalSubprep(true);}} style={{padding:'8px 16px',borderRadius:10,border:'none',background:S.purple,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>+ Subprep</button>}
          {tab==='compras'&&<button onClick={generarOrdenIA} style={{padding:'8px 16px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.goldD},${S.green})`,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>🧠 Generar orden IA</button>}
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'flex',gap:0,borderBottom:`1px solid ${S.border}`,flexShrink:0,background:S.bg2}}>
        {kpis.map((k,i)=>(
          <div key={k.l} style={{flex:1,padding:'10px 16px',borderRight:i<kpis.length-1?`1px solid ${S.border}`:'none'}}>
            <div style={{fontSize:9,color:S.t3,textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:3}}>{k.l}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:k.c}}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,flexShrink:0,background:S.bg2,padding:'0 20px',overflowX:'auto'}}>
        {([
          {id:'dashboard', l:'📊 Dashboard'},
          {id:'proveedores',l:`🏭 Proveedores (${suppliers.length})`},
          {id:'materias',  l:`🥩 Materias (${materias.length})`},
          {id:'subpreps',  l:`🫙 Subpreps (${subpreps.length})`},
          {id:'recetas',   l:'📋 Recetas'},
          {id:'compras',   l:`🛒 Compras (${orders.filter(o=>o.estado==='sugerida').length})`},
          {id:'alertas',   l:`⚠️ Alertas (${alertas.length})`},
          {id:'recepcion', l:'📦 Recepción'},
          {id:'conteos',   l:'🔢 Conteos'},
        ] as const).map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:'10px 14px',background:'none',border:'none',borderBottom:`2px solid ${tab===t.id?S.goldD:'transparent'}`,color:tab===t.id?S.goldD:S.t3,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s'}}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:'auto',padding:16}}>

        {/* ══ DASHBOARD ══ */}
        {tab==='dashboard' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>

            {/* REGLA MADRE — responde las 10 preguntas */}
            <div style={{background:`linear-gradient(135deg,${S.bg3},${S.bg4})`,border:`1px solid ${S.goldD}30`,borderRadius:16,padding:20}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,marginBottom:4,display:'flex',alignItems:'center',gap:8}}>
                🧠 Nexum Supply IA — {new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}
              </div>
              <div style={{fontSize:12,color:S.t3,marginBottom:16,fontStyle:'italic'}}>
                "NEXUM no compra por intuición. Compra por demanda proyectada, inventario real, rendimientos, mermas, vida útil y rentabilidad."
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
                {[
                  {q:'¿Qué tengo?',     v:`${materias.length} items`, c:S.blue},
                  {q:'¿Qué falta?',     v:`${alertas.length} items`,  c:S.red},
                  {q:'¿Qué se vence?',  v:`${proxVencer.length} items`,c:S.orange},
                  {q:'¿Qué comprar?',   v:`${orders.filter(o=>o.estado==='sugerida').length} órdenes`, c:S.gold},
                  {q:'¿Qué producir?',  v:`${subpreps.filter(s=>s.stock_actual<=s.stock_minimo).length} subpreps`, c:S.purple},
                ].map(item=>(
                  <div key={item.q} style={{background:S.bg,borderRadius:10,padding:'10px 12px',textAlign:'center'}}>
                    <div style={{fontSize:9,color:S.t3,marginBottom:4}}>{item.q}</div>
                    <div style={{fontSize:14,fontWeight:900,color:item.c,fontFamily:"'Syne',sans-serif"}}>{item.v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,alignItems:'start'}}>

            {/* Alertas críticas */}
            <div style={{background:S.bg2,border:`1px solid ${S.red}30`,borderRadius:14,overflow:'hidden'}}>
              <div style={{padding:'12px 16px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:S.red,boxShadow:`0 0 8px ${S.red}`,animation:'pulse 1.5s infinite'}}/>
                <span style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900}}>Alertas de stock</span>
                <span style={{marginLeft:'auto',background:`${S.red}20`,color:S.red,fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20}}>{alertas.length}</span>
              </div>
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
              {alertas.length===0
                ? <div style={{padding:20,fontSize:12,color:S.t3,textAlign:'center'}}>✓ Todo en niveles correctos</div>
                : alertas.slice(0,8).map(m=>(
                  <div key={m.id} style={{padding:'10px 16px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700}}>{m.nombre}</div>
                      <div style={{fontSize:10,color:S.t3}}>{m.categoria} · mín: {m.stock_minimo} {m.unidad_compra}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:14,fontWeight:900,color:m.stock_actual===0?S.red:S.gold}}>{m.stock_actual===0?'86':fmtKg(m.stock_actual,m.unidad_compra)}</div>
                      <div style={{fontSize:9,color:S.red}}>BAJO MÍNIMO</div>
                    </div>
                  </div>
                ))
              }
            </div>

            {/* Ranking proveedores */}
            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
              <div style={{padding:'12px 16px',borderBottom:`1px solid ${S.border}`}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900}}>🏆 Ranking proveedores IA</div>
              </div>
              {suppliers.slice(0,5).map((s,i)=>(
                <div key={s.id} style={{padding:'10px 16px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:24,height:24,borderRadius:8,background:i===0?`${S.gold}20`:S.bg3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900,color:i===0?S.gold:S.t3,flexShrink:0}}>
                    {i+1}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:700}}>{s.nombre}</div>
                    <div style={{fontSize:10,color:S.t3}}>{s.categoria} · {s.ciudad}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:16,fontWeight:900,color:s.score_total>=85?S.green:s.score_total>=70?S.gold:S.red}}>{s.score_total}</div>
                    <div style={{fontSize:9,color:S.t3}}>SCORE</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Producción sugerida IA */}
            <div style={{background:S.bg2,border:`1px solid ${S.purple}30`,borderRadius:14,overflow:'hidden'}}>
              <div style={{padding:'12px 16px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:8}}>
                <span style={{color:S.purple,fontSize:16}}>🤖</span>
                <span style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900}}>Producción sugerida</span>
              </div>
              {subpreps.filter(s=>s.stock_actual<=s.stock_minimo).length===0
                ? <div style={{padding:20,fontSize:12,color:S.t3,textAlign:'center'}}>✓ Producción al día</div>
                : subpreps.filter(s=>s.stock_actual<=s.stock_minimo).map(s=>(
                  <div key={s.id} style={{padding:'10px 16px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700}}>{s.nombre}</div>
                      <div style={{fontSize:10,color:S.t3}}>{s.tipo} · stock: {s.stock_actual} {s.unidad_rendimiento}</div>
                    </div>
                    <div style={{fontSize:11,color:S.purple,fontWeight:700}}>Producir {s.stock_minimo*2} {s.unidad_rendimiento}</div>
                  </div>
                ))
              }
            </div>
          </div>
            </div>
          </div>
        )}

        {/* ══ PROVEEDORES ══ */}
        {tab==='proveedores' && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:12}}>
            {suppliers.filter(s=>!busqueda||s.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(s=>{
              const sc = s.score_total;
              return (
                <div key={s.id} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:16,padding:18,cursor:'pointer',transition:'all .2s'}}
                  onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor=S.goldD}
                  onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor=S.border}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
                    <div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900}}>{s.nombre}</div>
                      <div style={{fontSize:11,color:S.t3,marginTop:2}}>{s.categoria} · {s.ciudad} · Lead {s.lead_time_dias}d</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:sc>=85?S.green:sc>=70?S.gold:S.red}}>{sc}</div>
                      <div style={{fontSize:9,color:S.t3}}>SCORE</div>
                    </div>
                  </div>
                  {/* Score bars */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:12}}>
                    {[{l:'Calidad',v:s.score_calidad},{l:'Cumplimiento',v:s.score_cumplimiento},{l:'Precio',v:s.score_precio},{l:'Confiabilidad',v:s.score_confiabilidad}].map(m=>(
                      <div key={m.l}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:S.t3,marginBottom:2}}><span>{m.l}</span><span>{m.v}</span></div>
                        <div style={{height:3,background:S.bg4,borderRadius:2,overflow:'hidden'}}>
                          <div style={{height:'100%',background:m.v>=85?S.green:m.v>=70?S.gold:S.red,width:`${m.v}%`,borderRadius:2}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                  {s.contacto_nombre && <div style={{fontSize:11,color:S.t2,marginBottom:4}}>👤 {s.contacto_nombre}</div>}
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>{ setEditItem(s); setFProv(s); setModalProveedor(true); }} style={{flex:1,padding:'6px',borderRadius:8,border:`1px solid ${S.border}`,background:'transparent',color:S.t3,fontSize:11,cursor:'pointer'}}>✏️ Editar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══ MATERIAS PRIMAS ══ */}
        {tab==='materias' && (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
              <thead>
                <tr style={{background:S.bg3,position:'sticky',top:0}}>
                  {['Nombre','Cat.','Unidad','Costo','Rendimiento','Merma','Costo real','Stock','Mín','Máx','Vida útil','Criticidad',''].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:'left' as const,fontSize:10,color:S.t3,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.05em',whiteSpace:'nowrap',borderBottom:`1px solid ${S.border}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {materias.filter(m=>!busqueda||m.nombre.toLowerCase().includes(busqueda.toLowerCase())).map((m,i)=>{
                  const bajo = m.stock_actual<=m.stock_minimo;
                  const cc = CRITICIDAD_CFG[m.criticidad]||CRITICIDAD_CFG.media;
                  return (
                    <tr key={m.id} style={{background:i%2===0?S.bg:S.bg2,borderBottom:`1px solid ${S.border}`,cursor:'pointer'}}
                      onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background=`${S.goldD}08`}
                      onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=i%2===0?S.bg:S.bg2}>
                      <td style={{padding:'9px 12px',fontWeight:700}}>{m.nombre}</td>
                      <td style={{padding:'9px 12px'}}>
                        <span style={{fontSize:10,background:`${(C as any)[m.categoria]||S.blue}15`,color:(C as any)[m.categoria]||S.blue,padding:'2px 8px',borderRadius:20}}>{m.categoria}</span>
                      </td>
                      <td style={{padding:'9px 12px',color:S.t2}}>{m.unidad_compra}</td>
                      <td style={{padding:'9px 12px',color:S.gold,fontWeight:700}}>{fmt(m.costo_unitario)}</td>
                      <td style={{padding:'9px 12px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <div style={{width:40,height:4,background:S.bg4,borderRadius:2,overflow:'hidden'}}>
                            <div style={{height:'100%',background:S.green,width:`${m.rendimiento_pct}%`}}/>
                          </div>
                          <span style={{color:S.green,fontWeight:700}}>{m.rendimiento_pct}%</span>
                        </div>
                      </td>
                      <td style={{padding:'9px 12px',color:S.orange}}>{m.merma_pct}%</td>
                      <td style={{padding:'9px 12px',color:S.orange,fontWeight:700}}>{fmt(m.costo_real_post_merma)}</td>
                      <td style={{padding:'9px 12px'}}>
                        <span style={{color:bajo?S.red:S.green,fontWeight:700}}>{m.stock_actual}{m.unidad_compra}</span>
                        {bajo&&<span style={{marginLeft:4,fontSize:9,color:S.red}}>⚠️</span>}
                      </td>
                      <td style={{padding:'9px 12px',color:S.t3}}>{m.stock_minimo}</td>
                      <td style={{padding:'9px 12px',color:S.t3}}>{m.stock_maximo}</td>
                      <td style={{padding:'9px 12px',color:m.vida_util_dias<=3?S.red:S.t2}}>{m.vida_util_dias}d</td>
                      <td style={{padding:'9px 12px'}}>
                        <span style={{fontSize:10,background:`${cc.c}15`,color:cc.c,padding:'2px 8px',borderRadius:20,fontWeight:700}}>{cc.l}</span>
                      </td>
                      <td style={{padding:'9px 12px'}}>
                        <button onClick={()=>{ setEditItem(m); setFMP(m); setModalMateria(true); }} style={{padding:'4px 10px',borderRadius:8,border:`1px solid ${S.border}`,background:'transparent',color:S.t3,fontSize:10,cursor:'pointer'}}>✏️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ SUBPREPARACIONES ══ */}
        {tab==='subpreps' && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
            {subpreps.filter(s=>!busqueda||s.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(s=>{
              const bajo = s.stock_actual<=s.stock_minimo;
              return (
                <div key={s.id} style={{background:S.bg2,border:`1.5px solid ${bajo?S.red+'40':S.border}`,borderRadius:16,padding:16}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
                    <div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900}}>{s.nombre}</div>
                      <div style={{fontSize:10,color:S.t3,marginTop:2}}>{s.tipo} · {s.responsable||'Sin asignar'}</div>
                    </div>
                    <span style={{fontSize:10,background:`${S.purple}15`,color:S.purple,padding:'2px 8px',borderRadius:20}}>{s.tipo}</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:10}}>
                    {[
                      {l:'Rendimiento',  v:`${s.rendimiento_total}${s.unidad_rendimiento}`, c:S.blue},
                      {l:'Costo total',  v:fmt(s.costo_total),                              c:S.gold},
                      {l:'Costo/unidad', v:fmt(s.costo_por_unidad),                         c:S.orange},
                      {l:'Stock',        v:`${s.stock_actual}${s.unidad_rendimiento}`,      c:bajo?S.red:S.green},
                      {l:'Mínimo',       v:`${s.stock_minimo}${s.unidad_rendimiento}`,      c:S.t3},
                      {l:'Vida útil',    v:`${s.vida_util_dias}d`,                          c:s.vida_util_dias<=2?S.red:S.t2},
                    ].map(m=>(
                      <div key={m.l} style={{background:S.bg3,borderRadius:8,padding:'6px 8px'}}>
                        <div style={{fontSize:9,color:S.t3,marginBottom:2}}>{m.l}</div>
                        <div style={{fontSize:12,fontWeight:700,color:m.c}}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                  {bajo&&<div style={{fontSize:11,color:S.red,background:`${S.red}10`,borderRadius:8,padding:'6px 10px',marginBottom:8}}>⚠️ Stock bajo — producir {s.stock_minimo*2} {s.unidad_rendimiento}</div>}
                  <button onClick={()=>{ setEditItem(s); setFSP(s); setModalSubprep(true); }} style={{width:'100%',padding:'7px',borderRadius:10,border:`1px solid ${S.border}`,background:'transparent',color:S.t3,fontSize:11,cursor:'pointer'}}>✏️ Editar</button>
                </div>
              );
            })}
          </div>
        )}

        {/* ══ RECETAS ══ */}
        {tab==='recetas' && (
          <div>
            <div style={{background:`${S.blue}08`,border:`1px solid ${S.blue}20`,borderRadius:14,padding:20,marginBottom:16}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,marginBottom:8}}>📋 Recetas técnicas — Regla clave</div>
              <div style={{fontSize:12,color:S.t2,lineHeight:1.7}}>
                Cada plato debe tener receta técnica con: ingredientes directos, subpreparaciones, salsas, gramaje exacto, costo por componente, costo total, precio de venta, margen bruto y food cost %.
                <br/><br/>
                <span style={{color:S.gold,fontWeight:700}}>Si una receta no está completa, el sistema no permite análisis real de rentabilidad.</span>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
              {[
                {icon:'🥩',title:'Ingredientes directos',desc:'Materias primas con gramaje exacto y costo post-merma'},
                {icon:'🫙',title:'Subpreparaciones',desc:'Salsas, fondos, jarabes — costo por ml/gr'},
                {icon:'📊',title:'Food Cost %',desc:'Costo total / Precio venta × 100. Objetivo: < 30%'},
              ].map(item=>(
                <div key={item.title} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:12,padding:16}}>
                  <div style={{fontSize:24,marginBottom:8}}>{item.icon}</div>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>{item.title}</div>
                  <div style={{fontSize:11,color:S.t3}}>{item.desc}</div>
                </div>
              ))}
            </div>
            <div style={{textAlign:'center',padding:'30px 0'}}>
              <button onClick={()=>showToast('🔗 Vinculación con MenuModule — próxima sesión')} style={{padding:'12px 32px',borderRadius:50,border:`1px solid ${S.goldD}`,background:`${S.goldD}15`,color:S.goldD,fontSize:13,fontWeight:700,cursor:'pointer'}}>
                🔗 Vincular recetas con platos del menú
              </button>
              <div style={{fontSize:11,color:S.t3,marginTop:10}}>Conecta MenuModule ↔ SupplyModule para descuento automático de inventario</div>
            </div>
          </div>
        )}

        {/* ══ ÓRDENES DE COMPRA ══ */}
        {tab==='compras' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {orders.length===0&&(
              <div style={{textAlign:'center',padding:60,color:S.t3}}>
                <div style={{fontSize:40,marginBottom:12}}>🛒</div>
                <div style={{fontSize:14,fontWeight:700}}>Sin órdenes generadas</div>
                <div style={{fontSize:12,marginTop:6}}>Presiona "Generar orden IA" para crear una orden automática</div>
              </div>
            )}
            {orders.map(o=>{
              const ESTADO_CFG: Record<string,{c:string;l:string}> = {
                sugerida:{c:S.gold,l:'Sugerida IA'}, aprobada:{c:S.blue,l:'Aprobada'},
                enviada:{c:S.purple,l:'Enviada'}, recibida:{c:S.green,l:'Recibida'}, cancelada:{c:S.red,l:'Cancelada'},
              };
              const ec = ESTADO_CFG[o.estado]||ESTADO_CFG.sugerida;
              return (
                <div key={o.id} style={{background:S.bg2,border:`1px solid ${ec.c}30`,borderRadius:14,padding:18}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                    <div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900}}>Orden #{o.id} — {o.tipo}</div>
                      <div style={{fontSize:11,color:S.t3}}>Generada por {o.generada_por} · {o.fecha_sugerida}</div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:18,fontWeight:900,fontFamily:"'Syne',sans-serif",color:S.goldL}}>{fmt(o.total_estimado)}</span>
                      <span style={{background:`${ec.c}20`,color:ec.c,border:`1px solid ${ec.c}40`,padding:'4px 12px',borderRadius:50,fontSize:11,fontWeight:700}}>{ec.l}</span>
                    </div>
                  </div>
                  {o.estado==='sugerida'&&(
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={async()=>{ await supabase.from('purchase_orders').update({estado:'aprobada'}).eq('id',o.id); showToast('✓ Orden aprobada'); fetchAll(); }}
                        style={{flex:1,padding:'9px',borderRadius:10,border:'none',background:S.blue,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>✓ Aprobar</button>
                      <button onClick={async()=>{ await supabase.from('purchase_orders').update({estado:'cancelada'}).eq('id',o.id); showToast('Orden cancelada'); fetchAll(); }}
                        style={{flex:1,padding:'9px',borderRadius:10,border:`1px solid ${S.red}40`,background:`${S.red}08`,color:S.red,fontSize:12,fontWeight:700,cursor:'pointer'}}>✕ Cancelar</button>
                    </div>
                  )}
                  {o.notas&&<div style={{marginTop:10,fontSize:12,color:S.t2}}>📝 {o.notas}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ ALERTAS ══ */}
        {tab==='alertas' && (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {alertas.length===0&&proxVencer.length===0&&(
              <div style={{textAlign:'center',padding:60,color:S.t3}}>
                <div style={{fontSize:40,marginBottom:12}}>✅</div>
                <div style={{fontSize:14,fontWeight:700}}>Sin alertas activas</div>
              </div>
            )}
            {alertas.map(m=>(
              <div key={m.id} style={{background:S.bg2,border:`1px solid ${S.red}30`,borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:36,height:36,borderRadius:10,background:`${S.red}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>⚠️</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700}}>{m.nombre}</div>
                  <div style={{fontSize:11,color:S.t3}}>Stock: {m.stock_actual} {m.unidad_compra} — Mínimo: {m.stock_minimo} {m.unidad_compra}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:14,fontWeight:900,color:m.stock_actual===0?S.red:S.gold}}>{m.stock_actual===0?'86':fmtKg(m.stock_actual,m.unidad_compra)}</div>
                  <div style={{fontSize:10,fontWeight:700,color:m.criticidad==='alta'?S.red:S.gold}}>{CRITICIDAD_CFG[m.criticidad]?.l||'Media'}</div>
                </div>
              </div>
            ))}
            {proxVencer.map(m=>(
              <div key={`v${m.id}`} style={{background:S.bg2,border:`1px solid ${S.orange}30`,borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:36,height:36,borderRadius:10,background:`${S.orange}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>⏰</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700}}>{m.nombre}</div>
                  <div style={{fontSize:11,color:S.t3}}>Vida útil: {m.vida_util_dias} días · Stock: {m.stock_actual} {m.unidad_compra}</div>
                </div>
                <span style={{fontSize:11,color:S.orange,fontWeight:700}}>Próximo a vencer</span>
              </div>
            ))}
          </div>
        )}

        {/* ══ RECEPCIÓN DE MERCANCÍA ══ */}
        {tab==='recepcion' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{background:`${S.green}08`,border:`1px solid ${S.green}20`,borderRadius:14,padding:18}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,marginBottom:8}}>📦 Recepción de mercancía — Regla 27</div>
              <div style={{fontSize:12,color:S.t2,lineHeight:1.7,marginBottom:14}}>Al recibir, validar: cantidad pedida vs recibida, precio cotizado vs facturado, calidad, temperatura, fecha vencimiento, lote y responsable. Si hay diferencia → novedad automática.</div>
              <button onClick={async()=>{
                const { data } = await supabase.from('recepciones').insert({ restaurante_id:6, estado:'pendiente', responsable:'Staff', fecha:new Date().toISOString().split('T')[0] }).select().single();
                if(data) showToast('✓ Recepción creada — agrega los items recibidos');
                fetchAll();
              }} style={{padding:'10px 24px',borderRadius:10,border:'none',background:S.green,color:'#000',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                + Nueva recepción
              </button>
            </div>
            {/* Checklist de recepción */}
            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:18}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:14,color:S.green}}>✅ Checklist de recepción</div>
              {[
                {l:'Cantidad pedida vs recibida',     done:true},
                {l:'Precio cotizado vs facturado',    done:true},
                {l:'Estado y calidad del producto',   done:false},
                {l:'Temperatura (carnes/pescados)',    done:false},
                {l:'Fecha de vencimiento y lote',     done:false},
                {l:'Factura y documentos',            done:false},
                {l:'Responsable de recepción firmó',  done:false},
              ].map((item,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:`1px solid ${S.border}`}}>
                  <div style={{width:20,height:20,borderRadius:6,background:item.done?`${S.green}20`:S.bg3,border:`2px solid ${item.done?S.green:S.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {item.done&&<span style={{fontSize:12,color:S.green}}>✓</span>}
                  </div>
                  <span style={{fontSize:12,color:item.done?S.t1:S.t3}}>{item.l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ CONTEOS DE INVENTARIO ══ */}
        {tab==='conteos' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{background:`${S.purple}08`,border:`1px solid ${S.purple}20`,borderRadius:14,padding:18}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,marginBottom:8}}>🔢 Inventario teórico vs físico — Regla 11</div>
              <div style={{fontSize:12,color:S.t2,lineHeight:1.7}}>
                El sistema compara lo que <b style={{color:S.blue}}>debería haber</b> (según ventas + compras - mermas) vs lo que hay <b style={{color:S.green}}>físicamente</b>. Diferencias generan alerta: mala porcionación, robo, error de receta o merma no registrada.
              </div>
            </div>
            {/* Frecuencia de conteo según regla 31 */}
            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:18}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:14}}>📅 Frecuencia de conteo — Regla 31</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                {[
                  {freq:'Diario',    cats:['carnico','pescado','licores'],   c:S.red},
                  {freq:'Semanal',   cats:['lacteo','abarrotes','frutas'],   c:S.gold},
                  {freq:'Quincenal', cats:['limpieza','empaques','secos'],   c:S.blue},
                ].map(item=>(
                  <div key={item.freq} style={{background:S.bg3,borderRadius:10,padding:14}}>
                    <div style={{fontSize:11,fontWeight:700,color:item.c,marginBottom:8}}>{item.freq}</div>
                    {item.cats.map(cat=>(
                      <div key={cat} style={{fontSize:11,color:S.t2,padding:'3px 0',display:'flex',alignItems:'center',gap:6}}>
                        <div style={{width:6,height:6,borderRadius:'50%',background:item.c,flexShrink:0}}/>
                        {cat}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {/* Tipos de merma */}
            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:18}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:14}}>⚖️ Clasificación de mermas — Regla 6</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {['Natural','Por limpieza','Por cocción','Por vencimiento','Por error','Por devolución','Por diferencia no explicada (robo)'].map(tipo=>(
                  <span key={tipo} style={{fontSize:11,background:tipo.includes('robo')?`${S.red}15`:S.bg3,color:tipo.includes('robo')?S.red:S.t2,border:`1px solid ${tipo.includes('robo')?S.red+'30':S.border}`,padding:'4px 12px',borderRadius:20}}>
                    {tipo}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
