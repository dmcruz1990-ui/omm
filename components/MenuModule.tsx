import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';

const S = {
  bg:'#0a0a0a', bg2:'#141414', bg3:'#1c1c1c', bg4:'#242424',
  border:'#2a2a2a', border2:'#333',
  text1:'#f0f0f0', text2:'#a0a0a0', text3:'#606060',
  gold:'#d4943a', goldL:'#f0b45a', green:'#3dba6f', greenL:'#4ade80',
  red:'#e05050', blue:'#4a8fd4', purple:'#9b72ff', pink:'#e91e8c',
  cyan:'#22d3ee',
};

const inp: React.CSSProperties = { background:S.bg3, border:`1px solid ${S.border}`, borderRadius:8, padding:'9px 14px', color:S.text1, fontSize:13, outline:'none', width:'100%' };
const btn = (bg:string,color='#fff'): React.CSSProperties => ({ padding:'9px 18px', borderRadius:9, border:'none', background:bg, color, fontSize:12, fontWeight:700, cursor:'pointer', transition:'opacity .15s' });

type MTab = 'tabla' | 'nuevo' | 'detalle' | 'costos';
type Estacion = 'Cocina Caliente' | 'Cocina Fría' | 'Barra 1' | 'Barra 2' | 'Postres' | 'Panadería';

interface Ingrediente { id?:number; nombre:string; cantidad:number; unidad:string; costo_unitario:number; costo_total?:number; proveedor?:string; }
interface MenuItem {
  id?:string; name:string; emoji:string; category:string; descripcion_comercial?:string;
  costo_produccion:number; precio_venta:number; margen?:number; margen_real?:number;
  tiempo_preparacion:number; centro_preparacion:string; disponible:boolean;
  tips_flow?:string; alerta_stock?:boolean; stock_minimo?:number;
  tags?:string[]; es_especial?:boolean; calorias?:number; alergenos?:string[];
  num_ingredientes?:number; costo_real?:number;
  ingredientes?: Ingrediente[];
}

const CATEGORIAS = ['Para Compartir','Robata/Wok','Sushi Frío','Ensaladas','Postres','Cocteles','Vinos','Sakes','Cervezas','Aguas','Café/Té','Especiales'];
const ESTACIONES: Estacion[] = ['Cocina Caliente','Cocina Fría','Barra 1','Barra 2','Postres','Panadería'];
const UNIDADES = ['gr','kg','ml','lt','unidad','porción','taza','cucharada'];
const ALERGENOS_LISTA = ['Gluten','Mariscos','Lácteos','Huevo','Nueces','Soya','Pescado','Maní','Sésamo'];
const EMOJIS_CAT: Record<string,string> = { 'Para Compartir':'🥟','Robata/Wok':'🔥','Sushi Frío':'🍣','Ensaladas':'🥗','Postres':'🍮','Cocteles':'🍹','Vinos':'🍷','Sakes':'🍶','Cervezas':'🍺','Aguas':'💧','Café/Té':'☕','Especiales':'⭐' };

const fmt = (n:number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const margenColor = (m:number) => m>=60?S.green:m>=40?S.goldL:m>=20?S.gold:S.red;
const margenLabel = (m:number) => m>=60?'Excelente':m>=40?'Bueno':m>=20?'Regular':'Bajo';

const PLATO_INICIAL: MenuItem = {
  name:'', emoji:'🍽️', category:'Para Compartir',
  descripcion_comercial:'', costo_produccion:0, precio_venta:0,
  tiempo_preparacion:15, centro_preparacion:'Cocina Caliente',
  disponible:true, tips_flow:'', es_especial:false,
  tags:[], alergenos:[], ingredientes:[],
};

export default function MenuModule() {
  const [tab, setTab]             = useState<MTab>('tabla');
  const [items, setItems]         = useState<MenuItem[]>([]);
  const [selected, setSelected]   = useState<MenuItem|null>(null);
  const [loading, setLoading]     = useState(true);
  const [busqueda, setBusqueda]   = useState('');
  const [catFiltro, setCatFiltro] = useState('Todas');
  const [form, setForm]           = useState<MenuItem>({...PLATO_INICIAL});
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [newIng, setNewIng]       = useState<Ingrediente>({nombre:'',cantidad:0,unidad:'gr',costo_unitario:0});
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState('');
  const [sortCol, setSortCol]     = useState<string>('name');
  const [sortDir, setSortDir]     = useState<'asc'|'desc'>('asc');

  const showToast = useCallback((m:string)=>{ setToast(m); setTimeout(()=>setToast(''),3000); },[]);
  const setF = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  const fetchMenu = async () => {
    const { data } = await supabase.from('vista_menu').select('*').order('category').order('name');
    if (data) setItems(data as MenuItem[]);
    setLoading(false);
  };

  useEffect(()=>{ fetchMenu(); },[]);

  // ── Filtros y sort ──────────────────────────────────────
  const filtrados = (() => {
    let base = items;
    if (catFiltro!=='Todas') base = base.filter(i=>i.category===catFiltro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      base = base.filter(i=>i.name.toLowerCase().includes(q)||i.category.toLowerCase().includes(q)||i.descripcion_comercial?.toLowerCase().includes(q));
    }
    return [...base].sort((a,b)=>{
      const va = (a as any)[sortCol]??''; const vb = (b as any)[sortCol]??'';
      const r = typeof va==='number' ? va-vb : String(va).localeCompare(String(vb));
      return sortDir==='asc'?r:-r;
    });
  })();

  // ── KPIs ───────────────────────────────────────────────
  const kpis = [
    { l:'Platos activos',    v:items.filter(i=>i.disponible).length,                                                    c:S.green  },
    { l:'Margen promedio',   v:`${Math.round(items.reduce((a,i)=>a+(i.margen_real||i.margen||0),0)/Math.max(items.length,1))}%`, c:S.goldL },
    { l:'Platos especiales', v:items.filter(i=>i.es_especial).length,                                                  c:S.purple },
    { l:'Ticket promedio',   v:fmt(items.reduce((a,i)=>a+i.precio_venta,0)/Math.max(items.length,1)),                  c:S.blue   },
    { l:'Costo promedio',    v:fmt(items.reduce((a,i)=>a+(i.costo_real||i.costo_produccion||0),0)/Math.max(items.length,1)), c:S.red },
  ];

  // ── Costo total ingredientes ───────────────────────────
  const costoIngredientes = ingredientes.reduce((a,i)=>a+(i.cantidad*i.costo_unitario),0);

  // ── Guardar plato ──────────────────────────────────────
  const guardar = async () => {
    if (!form.name) { showToast('⚠️ Nombre requerido'); return; }
    setSaving(true);
    const payload = {
      ...form,
      costo_produccion: costoIngredientes > 0 ? costoIngredientes : form.costo_produccion,
      restaurant_id: 'kxaxjttvkaeewsjbpert',
    };
    delete (payload as any).ingredientes;
    delete (payload as any).margen;
    delete (payload as any).margen_real;
    delete (payload as any).num_ingredientes;
    delete (payload as any).costo_real;

    let itemId = form.id;
    if (itemId) {
      await supabase.from('menu_items').update(payload).eq('id', itemId);
    } else {
      const { data } = await supabase.from('menu_items').insert(payload).select().single();
      itemId = (data as any)?.id;
    }

    // Guardar ingredientes
    if (itemId && ingredientes.length > 0) {
      await supabase.from('menu_ingredientes').delete().eq('menu_item_id', itemId);
      await supabase.from('menu_ingredientes').insert(
        ingredientes.map(i=>({ menu_item_id:itemId, nombre:i.nombre, cantidad:i.cantidad, unidad:i.unidad, costo_unitario:i.costo_unitario, proveedor:i.proveedor||null }))
      );
    }

    showToast(`✓ ${form.name} guardado`);
    setSaving(false);
    setTab('tabla');
    setForm({...PLATO_INICIAL});
    setIngredientes([]);
    fetchMenu();
  };

  const toggleDisponible = async (item:MenuItem) => {
    await supabase.from('menu_items').update({ disponible:!item.disponible }).eq('id', item.id!);
    showToast(item.disponible ? `86 ${item.name}` : `✓ ${item.name} disponible`);
    fetchMenu();
  };

  const abrirDetalle = async (item:MenuItem) => {
    setSelected(item);
    setForm({...item});
    const { data } = await supabase.from('menu_ingredientes').select('*').eq('menu_item_id', item.id!);
    setIngredientes(data||[]);
    setTab('detalle');
  };

  const sort = (col:string) => {
    if (sortCol===col) setSortDir(p=>p==='asc'?'desc':'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const SortIcon = ({col}:{col:string}) => sortCol===col
    ? <span style={{fontSize:9,marginLeft:3}}>{sortDir==='asc'?'▲':'▼'}</span>
    : <span style={{fontSize:9,marginLeft:3,opacity:.3}}>▲</span>;

  // ── RENDER ─────────────────────────────────────────────
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:S.bg,color:S.text1,fontFamily:"'DM Sans',sans-serif"}}>

      {/* Toast */}
      {toast && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'#222',border:`1px solid ${S.gold}`,color:S.text1,padding:'10px 22px',borderRadius:10,fontSize:13,zIndex:9999,whiteSpace:'nowrap'}}>{toast}</div>}

      {/* Header */}
      <div style={{padding:'12px 20px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:40,height:40,borderRadius:12,background:`linear-gradient(135deg,${S.gold},${S.purple})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📋</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,letterSpacing:'-0.02em'}}>MI MENÚ</div>
            <div style={{fontSize:11,color:S.text3}}>Ingeniería de menú — OMM Seratta</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <input placeholder="🔍 Buscar plato..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}
            style={{...inp,width:220,fontSize:12,padding:'7px 14px'}} />
          <select style={{...inp,width:'auto',fontSize:12,padding:'7px 12px'}} value={catFiltro} onChange={e=>setCatFiltro(e.target.value)}>
            <option>Todas</option>
            {CATEGORIAS.map(c=><option key={c}>{c}</option>)}
          </select>
          <button onClick={()=>setTab('costos')} style={{...btn(`${S.blue}20`,S.blue),border:`1px solid ${S.blue}40`,padding:'7px 14px',fontSize:11}}>📊 Análisis</button>
          <button onClick={()=>{setForm({...PLATO_INICIAL});setIngredientes([]);setTab('nuevo');}} style={{...btn(`linear-gradient(135deg,${S.gold},${S.purple})`),padding:'8px 18px'}}>+ Nuevo plato</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,padding:'10px 20px',borderBottom:`1px solid ${S.border}`,flexShrink:0}}>
        {kpis.map(k=>(
          <div key={k.l} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:10,padding:'8px 14px'}}>
            <div style={{fontSize:9,color:S.text3,marginBottom:2,textTransform:'uppercase' as const,letterSpacing:'.06em'}}>{k.l}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:k.c}}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>

        {/* ── TABLA EXCEL ── */}
        {tab==='tabla' && (
          <div style={{flex:1,overflowY:'auto'}}>
            {loading && <div style={{padding:40,textAlign:'center',color:S.text3}}>Cargando menú...</div>}
            {!loading && (
              <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
                <thead style={{position:'sticky',top:0,zIndex:10}}>
                  <tr style={{background:S.bg3,borderBottom:`2px solid ${S.border}`}}>
                    {[
                      {k:'disponible',l:''},
                      {k:'emoji',l:''},
                      {k:'name',l:'Nombre'},
                      {k:'category',l:'Categoría'},
                      {k:'descripcion_comercial',l:'Descripción comercial'},
                      {k:'centro_preparacion',l:'Estación'},
                      {k:'tiempo_preparacion',l:'⏱ Min'},
                      {k:'costo_real',l:'Costo'},
                      {k:'precio_venta',l:'Precio venta'},
                      {k:'margen_real',l:'Margen %'},
                      {k:'tips_flow',l:'Tips Flow'},
                      {k:'acciones',l:''},
                    ].map(col=>(
                      <th key={col.k} onClick={()=>col.k!=='acciones'&&col.k!=='emoji'&&col.k!=='disponible'&&sort(col.k)}
                        style={{padding:'10px 12px',textAlign:'left' as const,fontSize:10,fontWeight:700,color:S.text3,textTransform:'uppercase' as const,letterSpacing:'.06em',cursor:'pointer',whiteSpace:'nowrap',userSelect:'none' as const}}>
                        {col.l}<SortIcon col={col.k}/>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((item,idx)=>{
                    const mg = item.margen_real||item.margen||0;
                    const costo = item.costo_real||item.costo_produccion||0;
                    return (
                      <tr key={item.id||idx}
                        style={{background:idx%2===0?S.bg:S.bg2,borderBottom:`1px solid ${S.border}`,transition:'background .1s',cursor:'pointer'}}
                        onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background=`${S.gold}08`}
                        onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=idx%2===0?S.bg:S.bg2}>
                        {/* Disponible toggle */}
                        <td style={{padding:'8px 12px',textAlign:'center' as const}}>
                          <div onClick={e=>{e.stopPropagation();toggleDisponible(item);}}
                            style={{width:28,height:16,borderRadius:8,background:item.disponible?S.green:S.border,position:'relative',cursor:'pointer',transition:'all .2s',flexShrink:0,display:'inline-block'}}>
                            <div style={{position:'absolute',top:2,left:item.disponible?14:2,width:12,height:12,borderRadius:'50%',background:'#fff',transition:'left .2s'}}/>
                          </div>
                        </td>
                        {/* Emoji */}
                        <td style={{padding:'8px 8px',fontSize:20,textAlign:'center' as const}}>{item.emoji}</td>
                        {/* Nombre */}
                        <td onClick={()=>abrirDetalle(item)} style={{padding:'8px 12px',fontWeight:700,whiteSpace:'nowrap'}}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            {item.name}
                            {item.es_especial && <span style={{fontSize:9,background:`${S.gold}20`,color:S.gold,padding:'1px 6px',borderRadius:10,fontWeight:700}}>ESPECIAL</span>}
                            {!item.disponible && <span style={{fontSize:9,background:`${S.red}20`,color:S.red,padding:'1px 6px',borderRadius:10}}>86</span>}
                            {(item.margen_real||item.margen||0)>=70 && <span style={{fontSize:9,background:'rgba(212,148,58,0.15)',color:'#d4943a',padding:'1px 6px',borderRadius:10,fontWeight:700}}>★ Alta Rent.</span>}
                          </div>
                        </td>
                        {/* Categoría */}
                        <td style={{padding:'8px 12px',whiteSpace:'nowrap'}}>
                          <span style={{fontSize:11,background:`${S.purple}15`,color:S.purple,padding:'3px 10px',borderRadius:20}}>
                            {EMOJIS_CAT[item.category]||'🍽️'} {item.category}
                          </span>
                        </td>
                        {/* Descripción */}
                        <td style={{padding:'8px 12px',color:S.text2,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {item.descripcion_comercial||<span style={{color:S.text3,fontStyle:'italic'}}>Sin descripción</span>}
                        </td>
                        {/* Estación */}
                        <td style={{padding:'8px 12px',whiteSpace:'nowrap'}}>
                          <span style={{fontSize:11,background:`${S.blue}15`,color:S.blue,padding:'3px 10px',borderRadius:20}}>{item.centro_preparacion}</span>
                        </td>
                        {/* Tiempo */}
                        <td style={{padding:'8px 12px',textAlign:'center' as const,color:item.tiempo_preparacion>20?S.gold:S.green,fontWeight:700}}>
                          {item.tiempo_preparacion}m
                        </td>
                        {/* Costo */}
                        <td style={{padding:'8px 12px',fontWeight:700,color:S.red,whiteSpace:'nowrap'}}>{fmt(costo)}</td>
                        {/* Precio venta */}
                        <td style={{padding:'8px 12px',fontWeight:900,color:S.goldL,whiteSpace:'nowrap',fontFamily:"'Syne',sans-serif"}}>{fmt(item.precio_venta)}</td>
                        {/* Margen */}
                        <td style={{padding:'8px 12px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:50,height:5,background:S.bg4,borderRadius:3,overflow:'hidden'}}>
                              <div style={{height:'100%',background:margenColor(mg),width:`${Math.min(100,mg)}%`,borderRadius:3}}/>
                            </div>
                            <span style={{fontWeight:700,color:margenColor(mg),fontSize:11,whiteSpace:'nowrap'}}>{mg}%</span>
                          </div>
                        </td>
                        {/* Tips flow */}
                        <td style={{padding:'8px 12px',color:S.cyan,fontSize:11,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {item.tips_flow||<span style={{color:S.text3}}>—</span>}
                        </td>
                        {/* Acciones */}
                        <td style={{padding:'8px 12px'}}>
                          <div style={{display:'flex',gap:6}}>
                            <button onClick={e=>{e.stopPropagation();abrirDetalle(item);}}
                              style={{...btn(`${S.blue}20`,S.blue),padding:'4px 10px',fontSize:10,border:`1px solid ${S.blue}30`}}>✏️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!loading && filtrados.length===0 && (
              <div style={{padding:60,textAlign:'center',color:S.text3}}>
                <div style={{fontSize:40,marginBottom:12}}>🍽️</div>
                <div style={{fontSize:14,fontWeight:700}}>Sin platos — crea el primero</div>
              </div>
            )}
          </div>
        )}

        {/* ── NUEVO / EDITAR ── */}
        {(tab==='nuevo'||tab==='detalle') && (
          <div style={{flex:1,overflowY:'auto',padding:16}}>
            <div style={{maxWidth:900,display:'grid',gridTemplateColumns:'1fr 380px',gap:16,alignItems:'start'}}>

              {/* Panel izquierdo */}
              <div style={{display:'flex',flexDirection:'column',gap:14}}>

                {/* Info básica */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:16,padding:20}}>
                  <div style={{fontSize:11,color:S.gold,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:16}}>Información del plato</div>
                  <div style={{display:'grid',gridTemplateColumns:'60px 1fr 200px',gap:10,marginBottom:10}}>
                    {/* Emoji picker */}
                    <div>
                      <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Emoji</div>
                      <input style={{...inp,textAlign:'center',fontSize:24,padding:'6px'}} value={form.emoji} onChange={e=>setF('emoji',e.target.value)} maxLength={2}/>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Nombre del plato *</div>
                      <input style={inp} placeholder="Ej: Burosu Shitake" value={form.name} onChange={e=>setF('name',e.target.value)} />
                    </div>
                    <div>
                      <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Categoría</div>
                      <select style={inp} value={form.category} onChange={e=>setF('category',e.target.value)}>
                        {CATEGORIAS.map(c=><option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Descripción comercial (lo que ve el cliente)</div>
                    <textarea style={{...inp,minHeight:64,resize:'vertical' as const}} placeholder="Ej: Delicado consomé de res con hongos shitake frescos, aceite de trufa y cebollín..." value={form.descripcion_comercial||''} onChange={e=>setF('descripcion_comercial',e.target.value)} />
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                    <div>
                      <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Estación de preparación</div>
                      <select style={inp} value={form.centro_preparacion} onChange={e=>setF('centro_preparacion',e.target.value)}>
                        {ESTACIONES.map(e=><option key={e}>{e}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:S.text3,marginBottom:4}}>⏱ Tiempo (min)</div>
                      <input type="number" style={inp} value={form.tiempo_preparacion} onChange={e=>setF('tiempo_preparacion',parseInt(e.target.value)||0)} />
                    </div>
                    <div>
                      <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Calorías (opcional)</div>
                      <input type="number" style={inp} placeholder="320" value={form.calorias||''} onChange={e=>setF('calorias',parseInt(e.target.value)||null)} />
                    </div>
                  </div>
                </div>

                {/* Ingredientes y costos */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:16,padding:20}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                    <div style={{fontSize:11,color:S.red,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.08em'}}>Receta e ingredientes</div>
                    <div style={{fontSize:12,color:S.gold,fontWeight:700}}>Costo total: {fmt(costoIngredientes)}</div>
                  </div>
                  {/* Lista ingredientes */}
                  {ingredientes.length>0 && (
                    <div style={{marginBottom:12}}>
                      <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
                        <thead>
                          <tr style={{borderBottom:`1px solid ${S.border}`}}>
                            {['Ingrediente','Cantidad','Unidad','Costo unit.','Costo total','Proveedor',''].map(h=>(
                              <th key={h} style={{padding:'6px 8px',textAlign:'left' as const,fontSize:10,color:S.text3,fontWeight:700}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ingredientes.map((ing,i)=>(
                            <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?S.bg3:'transparent'}}>
                              <td style={{padding:'6px 8px',fontWeight:600}}>{ing.nombre}</td>
                              <td style={{padding:'6px 8px',color:S.blue}}>{ing.cantidad}</td>
                              <td style={{padding:'6px 8px',color:S.text3}}>{ing.unidad}</td>
                              <td style={{padding:'6px 8px',color:S.gold}}>{fmt(ing.costo_unitario)}</td>
                              <td style={{padding:'6px 8px',color:S.red,fontWeight:700}}>{fmt(ing.cantidad*ing.costo_unitario)}</td>
                              <td style={{padding:'6px 8px',color:S.text3,fontSize:11}}>{ing.proveedor||'—'}</td>
                              <td style={{padding:'6px 8px'}}>
                                <button onClick={()=>setIngredientes(p=>p.filter((_,j)=>j!==i))}
                                  style={{...btn(`${S.red}20`,S.red),padding:'3px 8px',fontSize:10,border:`1px solid ${S.red}30`}}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {/* Agregar ingrediente */}
                  <div style={{background:S.bg3,borderRadius:10,padding:14}}>
                    <div style={{fontSize:10,color:S.text3,marginBottom:8,fontWeight:700}}>+ Agregar ingrediente</div>
                    <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr auto',gap:8,alignItems:'end'}}>
                      <div>
                        <div style={{fontSize:9,color:S.text3,marginBottom:3}}>Nombre</div>
                        <input style={{...inp,padding:'7px 10px',fontSize:12}} placeholder="Ej: Hongos shitake" value={newIng.nombre} onChange={e=>setNewIng(p=>({...p,nombre:e.target.value}))} />
                      </div>
                      <div>
                        <div style={{fontSize:9,color:S.text3,marginBottom:3}}>Cantidad</div>
                        <input type="number" style={{...inp,padding:'7px 10px',fontSize:12}} value={newIng.cantidad||''} onChange={e=>setNewIng(p=>({...p,cantidad:parseFloat(e.target.value)||0}))} />
                      </div>
                      <div>
                        <div style={{fontSize:9,color:S.text3,marginBottom:3}}>Unidad</div>
                        <select style={{...inp,padding:'7px 8px',fontSize:12}} value={newIng.unidad} onChange={e=>setNewIng(p=>({...p,unidad:e.target.value}))}>
                          {UNIDADES.map(u=><option key={u}>{u}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{fontSize:9,color:S.text3,marginBottom:3}}>Costo/unidad $</div>
                        <input type="number" style={{...inp,padding:'7px 10px',fontSize:12}} placeholder="0" value={newIng.costo_unitario||''} onChange={e=>setNewIng(p=>({...p,costo_unitario:parseFloat(e.target.value)||0}))} />
                      </div>
                      <div>
                        <div style={{fontSize:9,color:S.text3,marginBottom:3}}>Proveedor</div>
                        <input style={{...inp,padding:'7px 10px',fontSize:12}} placeholder="Opcional" value={newIng.proveedor||''} onChange={e=>setNewIng(p=>({...p,proveedor:e.target.value}))} />
                      </div>
                      <button onClick={()=>{
                        if(!newIng.nombre) return;
                        setIngredientes(p=>[...p,{...newIng}]);
                        setNewIng({nombre:'',cantidad:0,unidad:'gr',costo_unitario:0});
                      }} style={{...btn(S.green),padding:'8px 14px',height:36,fontSize:13}}>+</button>
                    </div>
                  </div>
                </div>

                {/* Tips y notas */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:16,padding:20}}>
                  <div style={{fontSize:11,color:S.cyan,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:14}}>Tips para el Flow</div>
                  <textarea style={{...inp,minHeight:70,resize:'vertical' as const}} placeholder="Ej: Servir en copa de martini helada. Mencionar el origen japonés del shitake. Maridaje recomendado: Sake G Joy." value={form.tips_flow||''} onChange={e=>setF('tips_flow',e.target.value)} />
                </div>

              </div>

              {/* Panel derecho — preview y financiero */}
              <div style={{display:'flex',flexDirection:'column',gap:14}}>

                {/* Preview tarjeta */}
                <div style={{background:`linear-gradient(135deg,${S.bg3},${S.bg4})`,border:`1px solid ${S.border}`,borderRadius:16,padding:20,position:'sticky',top:16}}>
                  <div style={{fontSize:10,color:S.text3,fontWeight:700,marginBottom:12,textTransform:'uppercase' as const}}>Vista previa</div>
                  <div style={{textAlign:'center',marginBottom:16}}>
                    <div style={{fontSize:48,marginBottom:6}}>{form.emoji}</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900}}>{form.name||'Nombre del plato'}</div>
                    <div style={{fontSize:11,color:S.purple,marginTop:4}}>{EMOJIS_CAT[form.category]||'🍽️'} {form.category}</div>
                    {form.descripcion_comercial && <div style={{fontSize:11,color:S.text2,marginTop:8,fontStyle:'italic',lineHeight:1.5}}>{form.descripcion_comercial}</div>}
                  </div>

                  {/* Financiero */}
                  <div style={{background:S.bg,borderRadius:12,padding:14,marginBottom:14}}>
                    <div style={{fontSize:10,color:S.text3,fontWeight:700,marginBottom:10,textTransform:'uppercase' as const}}>Análisis financiero</div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <div>
                        <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Precio de venta</div>
                        <input type="number" style={{...inp,fontSize:16,fontWeight:900,color:S.goldL,textAlign:'center' as const}} placeholder="0" value={form.precio_venta||''} onChange={e=>setF('precio_venta',parseFloat(e.target.value)||0)} />
                      </div>
                      {costoIngredientes===0 && (
                        <div>
                          <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Costo manual (sin ingredientes)</div>
                          <input type="number" style={{...inp,fontSize:13}} placeholder="0" value={form.costo_produccion||''} onChange={e=>setF('costo_produccion',parseFloat(e.target.value)||0)} />
                        </div>
                      )}
                    </div>
                    {/* Cálculo de margen */}
                    {form.precio_venta>0 && (()=>{
                      const costo = costoIngredientes>0 ? costoIngredientes : form.costo_produccion;
                      const margen = Math.round(((form.precio_venta-costo)/form.precio_venta)*100);
                      const ganancia = form.precio_venta - costo;
                      return (
                        <div style={{marginTop:12,background:S.bg3,borderRadius:10,padding:12}}>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                            <div style={{textAlign:'center' as const}}>
                              <div style={{fontSize:9,color:S.text3}}>Costo</div>
                              <div style={{fontSize:16,fontWeight:900,color:S.red}}>{fmt(costo)}</div>
                            </div>
                            <div style={{textAlign:'center' as const}}>
                              <div style={{fontSize:9,color:S.text3}}>Ganancia</div>
                              <div style={{fontSize:16,fontWeight:900,color:S.green}}>{fmt(ganancia)}</div>
                            </div>
                          </div>
                          <div style={{textAlign:'center' as const}}>
                            <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Margen de contribución</div>
                            <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,color:margenColor(margen)}}>{margen}%</div>
                            <div style={{fontSize:11,color:margenColor(margen)}}>{margenLabel(margen)}</div>
                            <div style={{height:6,background:S.bg4,borderRadius:3,marginTop:8,overflow:'hidden'}}>
                              <div style={{height:'100%',background:margenColor(margen),width:`${Math.min(100,Math.max(0,margen))}%`,borderRadius:3,transition:'width .3s'}}/>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Opciones */}
                  <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
                    <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:12,color:S.text2}}>
                      <input type="checkbox" checked={form.es_especial||false} onChange={e=>setF('es_especial',e.target.checked)} />
                      ⭐ Plato especial de temporada
                    </label>
                    <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:12,color:S.text2}}>
                      <input type="checkbox" checked={form.disponible} onChange={e=>setF('disponible',e.target.checked)} />
                      ✓ Disponible en carta
                    </label>
                  </div>

                  {/* Alérgenos */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10,color:S.red,fontWeight:700,marginBottom:6}}>⚠️ Alérgenos</div>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      {ALERGENOS_LISTA.map(a=>{
                        const sel = (form.alergenos||[]).includes(a);
                        return (
                          <button key={a} onClick={()=>setF('alergenos',sel?(form.alergenos||[]).filter((x:string)=>x!==a):[...(form.alergenos||[]),a])}
                            style={{padding:'3px 10px',borderRadius:20,border:`1px solid ${sel?S.red:S.border}`,background:sel?`${S.red}20`:'transparent',color:sel?S.red:S.text3,fontSize:10,cursor:'pointer'}}>
                            {a}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Info estación */}
                  <div style={{background:`${S.blue}10`,border:`1px solid ${S.blue}20`,borderRadius:10,padding:'8px 12px',marginBottom:14,fontSize:11,color:S.blue}}>
                    🏪 {form.centro_preparacion} · ⏱ {form.tiempo_preparacion} min
                  </div>

                  <button onClick={guardar} disabled={saving}
                    style={{...btn(`linear-gradient(135deg,${S.gold},${S.purple})`),width:'100%',padding:13,fontSize:13,fontFamily:"'Syne',sans-serif",opacity:saving?.7:1}}>
                    {saving ? '⏳ Guardando...' : tab==='detalle' ? '✓ Actualizar plato' : '✓ Crear plato'}
                  </button>
                  {tab==='detalle' && (
                    <button onClick={()=>{setTab('tabla');setForm({...PLATO_INICIAL});setIngredientes([]);}}
                      style={{...btn('transparent',S.text3),width:'100%',marginTop:8,border:`1px solid ${S.border}`,padding:'9px'}}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ANÁLISIS DE COSTOS ── */}
        {tab==='costos' && (
          <div style={{flex:1,overflowY:'auto',padding:16}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20}}>
              {/* Top rentables */}
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:18}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900,marginBottom:4,color:S.green}}>🏆 Más rentables</div>
                <div style={{fontSize:11,color:S.text3,marginBottom:14}}>Mayor margen de contribución</div>
                {[...items].sort((a,b)=>(b.margen_real||b.margen||0)-(a.margen_real||a.margen||0)).slice(0,5).map((item,i)=>{
                  const mg = item.margen_real||item.margen||0;
                  return (
                    <div key={item.id||i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:`1px solid ${S.border}`}}>
                      <span style={{fontSize:18}}>{item.emoji}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</div>
                        <div style={{fontSize:10,color:S.text3}}>{fmt(item.precio_venta)}</div>
                      </div>
                      <span style={{fontSize:13,fontWeight:900,color:margenColor(mg)}}>{mg}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Más lentos */}
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:18}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900,marginBottom:4,color:S.gold}}>⏱ Más tiempo de prep.</div>
                <div style={{fontSize:11,color:S.text3,marginBottom:14}}>Platos que más demoran</div>
                {[...items].sort((a,b)=>b.tiempo_preparacion-a.tiempo_preparacion).slice(0,5).map((item,i)=>(
                  <div key={item.id||i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:`1px solid ${S.border}`}}>
                    <span style={{fontSize:18}}>{item.emoji}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</div>
                      <div style={{fontSize:10,color:S.text3}}>{item.centro_preparacion}</div>
                    </div>
                    <span style={{fontSize:13,fontWeight:900,color:item.tiempo_preparacion>20?S.red:S.goldL}}>{item.tiempo_preparacion}m</span>
                  </div>
                ))}
              </div>

              {/* Por estación */}
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:18}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900,marginBottom:4,color:S.blue}}>🏪 Por estación</div>
                <div style={{fontSize:11,color:S.text3,marginBottom:14}}>Carga de trabajo por área</div>
                {ESTACIONES.map(est=>{
                  const count = items.filter(i=>i.centro_preparacion===est).length;
                  if (!count) return null;
                  const pct = Math.round(count/Math.max(items.length,1)*100);
                  return (
                    <div key={est} style={{marginBottom:10}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:4}}>
                        <span style={{color:S.text2}}>{est}</span>
                        <span style={{color:S.blue,fontWeight:700}}>{count} platos</span>
                      </div>
                      <div style={{height:5,background:S.bg4,borderRadius:3,overflow:'hidden'}}>
                        <div style={{height:'100%',background:S.blue,width:`${pct}%`,borderRadius:3}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tabla resumen por categoría */}
            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
              <div style={{padding:'14px 20px',borderBottom:`1px solid ${S.border}`}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900}}>Resumen por categoría</div>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
                <thead>
                  <tr style={{background:S.bg3}}>
                    {['Categoría','Platos','Precio prom.','Costo prom.','Margen prom.','Tiempo prom.'].map(h=>(
                      <th key={h} style={{padding:'10px 16px',textAlign:'left' as const,fontSize:10,color:S.text3,fontWeight:700,textTransform:'uppercase' as const}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIAS.map((cat,idx)=>{
                    const catItems = items.filter(i=>i.category===cat);
                    if (!catItems.length) return null;
                    const avgPrecio = catItems.reduce((a,i)=>a+i.precio_venta,0)/catItems.length;
                    const avgCosto  = catItems.reduce((a,i)=>a+(i.costo_real||i.costo_produccion||0),0)/catItems.length;
                    const avgMargen = catItems.reduce((a,i)=>a+(i.margen_real||i.margen||0),0)/catItems.length;
                    const avgTiempo = catItems.reduce((a,i)=>a+i.tiempo_preparacion,0)/catItems.length;
                    return (
                      <tr key={cat} style={{background:idx%2===0?S.bg:S.bg2,borderBottom:`1px solid ${S.border}`}}>
                        <td style={{padding:'10px 16px',fontWeight:700}}>{EMOJIS_CAT[cat]} {cat}</td>
                        <td style={{padding:'10px 16px',color:S.blue,fontWeight:700}}>{catItems.length}</td>
                        <td style={{padding:'10px 16px',color:S.goldL,fontWeight:700}}>{fmt(avgPrecio)}</td>
                        <td style={{padding:'10px 16px',color:S.red}}>{fmt(avgCosto)}</td>
                        <td style={{padding:'10px 16px'}}>
                          <span style={{color:margenColor(avgMargen),fontWeight:700}}>{Math.round(avgMargen)}%</span>
                        </td>
                        <td style={{padding:'10px 16px',color:S.text2}}>{Math.round(avgTiempo)} min</td>
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
