import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';

const S = {
  bg:'#08080f', bg2:'#0f0f1a', bg3:'#161624', bg4:'#1e1e2e',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.12)',
  t1:'#FFFFFF', t2:'#A0A0B8', t3:'#50506A',
  gold:'#FFB547', green:'#00E676', red:'#FF5252',
  blue:'#448AFF', purple:'#B388FF', pink:'#FF2D78', cyan:'#22d3ee',
};
const inp: React.CSSProperties = {
  background:'rgba(255,255,255,0.05)', border:`1px solid ${S.border2}`,
  borderRadius:8, padding:'9px 14px', color:S.t1, fontSize:13, outline:'none', width:'100%',
};
const fmt = (n:number) => `$${Math.round(n).toLocaleString('es-CO')}`;

type Tab = 'mimenu' | 'marketplace';

interface MiPlato {
  id?:number; nombre:string; emoji:string; precio:number;
  categoria:string; es_recomendado:boolean; es_carne:boolean;
  disponible:boolean; descripcion?:string;
}

interface Producto {
  id:number; nombre:string; descripcion?:string; categoria?:string;
  proveedor_nombre?:string; precio_unidad?:number; precio_caja?:number;
  unidad:string; unidades_por_caja:number; disponible:boolean;
  tiempo_entrega_dias:number; calificacion:number; es_destacado:boolean;
  tags?:string[]; imagen_url?:string;
}

interface CartItem { producto: Producto; cantidad: number; }

const EMOJIS_COMIDA = ['🍱','🍣','🥩','🍖','🦐','🐟','🥗','🍜','🍝','🫕','🥘','🍲','🍛','🌮','🥙','🥚','🧆','🫔','🍤','🦑','🥦','🍄','🫑','🧀','🍳','🥞','🧇','🍰','🎂','🍮','🍭','🍬','🧁','🍩','🍪','🍺','🍷','🍸','🍹','🥂','☕','🧋','🥤','🧃'];
const CATEGORIAS_MENU = ['Especial','Entrada','Fuertes','Postres','Bebidas','Cócteles','Sushi','Robata','Compartir'];
const CATS_MARKET = ['Todos','Carnes','Pescados','Lácteos','Bebidas','Licores','Verduras','Frutas','Abarrotes','Bar','Panadería'];

export default function MarketplaceModule() {
  const [tab, setTab]             = useState<Tab>('mimenu');
  const [platos, setPlatos]       = useState<MiPlato[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito]     = useState<CartItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState('');
  const [showCart, setShowCart]   = useState(false);
  const [catMarket, setCatMarket] = useState('Todos');
  const [busqueda, setBusqueda]   = useState('');
  // Form Mi Menú
  const [formOpen, setFormOpen]   = useState(false);
  const [editPlato, setEditPlato] = useState<MiPlato|null>(null);
  const [form, setForm]           = useState<MiPlato>({ nombre:'', emoji:'🍽️', precio:0, categoria:'Especial', es_recomendado:false, es_carne:false, disponible:true });

  const showToast = useCallback((m:string)=>{ setToast(m); setTimeout(()=>setToast(''),3000); },[]);
  const setF = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  const fetchPlatos = async () => {
    const { data } = await supabase.from('mi_menu').select('*').eq('restaurante_id',6).order('created_at',{ascending:false});
    if (data) setPlatos(data as MiPlato[]);
  };

  const fetchProductos = async () => {
    const { data } = await supabase.from('marketplace_productos').select('*').eq('disponible',true).order('es_destacado',{ascending:false});
    if (data) setProductos(data as Producto[]);
    setLoading(false);
  };

  useEffect(()=>{ fetchPlatos(); fetchProductos(); },[]);

  // ── Mi Menú ────────────────────────────────────────────────────────────
  const guardarPlato = async () => {
    if (!form.nombre) { showToast('⚠️ Nombre requerido'); return; }
    if (!form.precio || form.precio <= 0) { showToast('⚠️ Precio requerido'); return; }
    if (editPlato?.id) {
      await supabase.from('mi_menu').update(form).eq('id', editPlato.id);
      showToast('✓ Plato actualizado');
    } else {
      await supabase.from('mi_menu').insert({ ...form, restaurante_id:6 });
      showToast('✓ Plato guardado');
    }
    setFormOpen(false); setEditPlato(null);
    setForm({ nombre:'', emoji:'🍽️', precio:0, categoria:'Especial', es_recomendado:false, es_carne:false, disponible:true });
    fetchPlatos();
  };

  const toggleDisponible = async (p:MiPlato) => {
    await supabase.from('mi_menu').update({ disponible: !p.disponible }).eq('id', p.id);
    fetchPlatos();
  };

  const eliminarPlato = async (id:number) => {
    await supabase.from('mi_menu').delete().eq('id', id);
    showToast('Plato eliminado'); fetchPlatos();
  };

  // ── Marketplace ────────────────────────────────────────────────────────
  const addToCart = (prod: Producto) => {
    setCarrito(prev => {
      const ex = prev.find(c => c.producto.id === prod.id);
      if (ex) return prev.map(c => c.producto.id===prod.id ? {...c, cantidad:c.cantidad+1} : c);
      return [...prev, { producto:prod, cantidad:1 }];
    });
    showToast(`🛒 ${prod.nombre} agregado`);
  };

  const removeFromCart = (id:number) => setCarrito(p=>p.filter(c=>c.producto.id!==id));
  const cartTotal = carrito.reduce((a,c)=>a+(c.producto.precio_unidad||0)*c.cantidad, 0);
  const cartCount = carrito.reduce((a,c)=>a+c.cantidad, 0);

  const enviarOrden = async () => {
    if (!carrito.length) return;
    for (const item of carrito) {
      await supabase.from('marketplace_carrito').insert({
        restaurante_id:6, producto_id:item.producto.id,
        cantidad:item.cantidad, precio_unitario:item.producto.precio_unidad,
      });
    }
    // También crear purchase order
    await supabase.from('purchase_orders').insert({
      restaurante_id:6, estado:'pendiente', tipo:'marketplace',
      total_estimado:cartTotal, generada_por:'Marketplace',
      notas:`${carrito.length} producto(s) desde marketplace`,
    });
    setCarrito([]); setShowCart(false);
    showToast(`✓ Orden enviada — ${fmt(cartTotal)}`);
  };

  const prodFiltrados = productos.filter(p => {
    if (catMarket !== 'Todos' && p.categoria !== catMarket) return false;
    if (busqueda && !p.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>

      {/* Toast */}
      {toast && (
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:S.bg4,border:`1px solid ${S.pink}`,color:S.t1,padding:'10px 24px',borderRadius:50,fontSize:13,zIndex:9999}}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{padding:'16px 24px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:16,flexShrink:0,background:S.bg2}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,borderRadius:14,background:`linear-gradient(135deg,${S.purple},${S.blue})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>🛍️</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:900,letterSpacing:'-0.02em'}}>MARKETPLACE & MI MENÚ</div>
            <div style={{fontSize:10,color:S.t3,letterSpacing:'.1em',textTransform:'uppercase'}}>Nexum V4 · Grupo Seratta</div>
          </div>
        </div>
        <div style={{flex:1}}/>
        {/* Carrito (solo en marketplace) */}
        {tab === 'marketplace' && (
          <button onClick={()=>setShowCart(true)} style={{position:'relative',padding:'9px 18px',borderRadius:10,border:`1px solid ${S.border2}`,background:cartCount>0?`${S.blue}15`:'transparent',color:cartCount>0?S.blue:S.t3,cursor:'pointer',fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:8}}>
            🛒 Carrito
            {cartCount>0 && <span style={{background:S.blue,color:'#fff',borderRadius:50,padding:'1px 7px',fontSize:11,fontWeight:900}}>{cartCount}</span>}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,background:S.bg2,padding:'0 24px',flexShrink:0}}>
        {[
          {id:'mimenu',    label:'✦ Mi Menú Personalizado'},
          {id:'marketplace',label:'🛍️ Marketplace Proveedores'},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as Tab)}
            style={{padding:'12px 20px',background:'none',border:'none',borderBottom:`2px solid ${tab===t.id?S.purple:'transparent'}`,color:tab===t.id?S.purple:S.t3,fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s'}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ MI MENÚ ══ */}
      {tab === 'mimenu' && (
        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          {/* Toolbar */}
          <div style={{padding:'12px 24px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
            <div style={{fontSize:12,color:S.t2}}>
              <span style={{fontWeight:700,color:S.purple}}>{platos.filter(p=>p.disponible).length}</span> activos · <span style={{color:S.t3}}>{platos.length} total</span>
            </div>
            <div style={{flex:1}}/>
            <button onClick={()=>{ setEditPlato(null); setForm({nombre:'',emoji:'🍽️',precio:0,categoria:'Especial',es_recomendado:false,es_carne:false,disponible:true}); setFormOpen(p=>!p); }}
              style={{padding:'8px 20px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.purple},${S.blue})`,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>
              {formOpen?'✕ Cancelar':'+ Agregar plato'}
            </button>
          </div>

          {/* Formulario */}
          {formOpen && (
            <div style={{padding:'16px 24px',borderBottom:`1px solid ${S.border}`,background:`${S.purple}06`,flexShrink:0}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 2fr 1fr 1fr',gap:12,alignItems:'end',marginBottom:12}}>
                <div>
                  <div style={{fontSize:10,color:S.t3,marginBottom:4}}>Emoji</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4,maxHeight:80,overflowY:'auto',padding:'6px',background:'rgba(255,255,255,0.03)',borderRadius:8,border:`1px solid ${S.border}`}}>
                    {EMOJIS_COMIDA.map(e=>(
                      <button key={e} onClick={()=>setF('emoji',e)}
                        style={{width:28,height:28,borderRadius:6,border:`1px solid ${form.emoji===e?S.purple:'transparent'}`,background:form.emoji===e?`${S.purple}20`:'transparent',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:10,color:S.t3,marginBottom:4}}>Nombre del plato *</div>
                  <input style={inp} value={form.nombre} onChange={e=>setF('nombre',e.target.value)} placeholder="Ej: Ceviche especial del día"/>
                  <div style={{marginTop:8}}>
                    <div style={{fontSize:10,color:S.t3,marginBottom:4}}>Descripción (opcional)</div>
                    <input style={inp} value={form.descripcion||''} onChange={e=>setF('descripcion',e.target.value)} placeholder="Descripción breve..."/>
                  </div>
                </div>
                <div>
                  <div style={{fontSize:10,color:S.t3,marginBottom:4}}>Precio *</div>
                  <input style={inp} type="number" value={form.precio||''} onChange={e=>setF('precio',Number(e.target.value))} placeholder="80000"/>
                  <div style={{marginTop:8}}>
                    <div style={{fontSize:10,color:S.t3,marginBottom:4}}>Categoría</div>
                    <select style={inp} value={form.categoria} onChange={e=>setF('categoria',e.target.value)}>
                      {CATEGORIAS_MENU.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {[
                    {k:'es_recomendado', l:'⭐ Recomendado', c:S.gold},
                    {k:'es_carne',       l:'🥩 Contiene carne', c:S.red},
                    {k:'disponible',     l:'✓ Disponible', c:S.green},
                  ].map(t=>(
                    <label key={t.k} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'6px 10px',borderRadius:8,background:(form as any)[t.k]?`${t.c}10`:'transparent',border:`1px solid ${(form as any)[t.k]?t.c:S.border}`}}>
                      <input type="checkbox" checked={(form as any)[t.k]} onChange={e=>setF(t.k,e.target.checked)} style={{cursor:'pointer'}}/>
                      <span style={{fontSize:12,color:(form as any)[t.k]?t.c:S.t3,fontWeight:700}}>{t.l}</span>
                    </label>
                  ))}
                  <button onClick={guardarPlato}
                    style={{padding:'10px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.purple},${S.blue})`,color:'#fff',fontWeight:900,cursor:'pointer',fontSize:13}}>
                    ✓ Guardar
                  </button>
                </div>
              </div>
              {/* Preview */}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:S.bg3,borderRadius:10,border:`1px solid ${S.border}`,maxWidth:360}}>
                <span style={{fontSize:28}}>{form.emoji}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700}}>{form.nombre||'Nombre del plato'}</div>
                  <div style={{display:'flex',gap:6,marginTop:3}}>
                    <span style={{fontSize:12,color:S.gold,fontWeight:700}}>{form.precio?fmt(form.precio):'$0'}</span>
                    {form.es_recomendado && <span style={{fontSize:10,background:`${S.gold}15`,color:S.gold,padding:'1px 6px',borderRadius:10}}>⭐ Reco</span>}
                    {form.es_carne && <span style={{fontSize:10,background:`${S.red}15`,color:S.red,padding:'1px 6px',borderRadius:10}}>🥩</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lista de platos */}
          <div style={{flex:1,overflowY:'auto',padding:24}}>
            {platos.length === 0 && (
              <div style={{textAlign:'center',padding:60,color:S.t3}}>
                <div style={{fontSize:48,marginBottom:12}}>🍽️</div>
                <div style={{fontSize:15,fontWeight:700}}>Sin platos aún</div>
                <div style={{fontSize:12,marginTop:6}}>Agrega platos especiales del día o del mesero</div>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
              {platos.map(p=>(
                <div key={p.id} style={{background:S.bg2,border:`1px solid ${p.disponible?S.border:S.border}`,borderRadius:14,overflow:'hidden',opacity:p.disponible?1:0.5,transition:'all .2s'}}>
                  <div style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontSize:32}}>{p.emoji}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                        {p.nombre}
                        {p.es_recomendado && <span style={{fontSize:9,background:`${S.gold}15`,color:S.gold,padding:'1px 6px',borderRadius:10}}>⭐</span>}
                        {p.es_carne && <span style={{fontSize:9,background:`${S.red}15`,color:S.red,padding:'1px 6px',borderRadius:10}}>🥩</span>}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
                        <span style={{fontSize:15,fontWeight:900,color:S.gold}}>{fmt(p.precio)}</span>
                        <span style={{fontSize:10,color:S.t3,background:S.bg3,padding:'2px 8px',borderRadius:8}}>{p.categoria}</span>
                      </div>
                      {p.descripcion && <div style={{fontSize:11,color:S.t3,marginTop:3}}>{p.descripcion}</div>}
                    </div>
                  </div>
                  <div style={{padding:'0 16px 14px',display:'flex',gap:8}}>
                    <button onClick={()=>toggleDisponible(p)}
                      style={{flex:1,padding:'6px',borderRadius:8,border:`1px solid ${p.disponible?S.green:S.border}`,background:p.disponible?`${S.green}10`:'transparent',color:p.disponible?S.green:S.t3,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                      {p.disponible?'✓ Activo':'◌ Inactivo'}
                    </button>
                    <button onClick={()=>{ setEditPlato(p); setForm(p); setFormOpen(true); }}
                      style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${S.border}`,background:'transparent',color:S.t2,fontSize:11,cursor:'pointer'}}>
                      ✏️
                    </button>
                    <button onClick={()=>p.id&&eliminarPlato(p.id)}
                      style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${S.red}30`,background:'transparent',color:S.red,fontSize:11,cursor:'pointer'}}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ MARKETPLACE ══ */}
      {tab === 'marketplace' && (
        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          {/* Barra búsqueda + categorías */}
          <div style={{padding:'12px 24px',borderBottom:`1px solid ${S.border}`,flexShrink:0,display:'flex',flexDirection:'column',gap:10}}>
            <div style={{position:'relative'}}>
              <input placeholder="🔍 Buscar productos..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}
                style={{...inp,padding:'9px 40px 9px 14px'}}/>
              {busqueda && <button onClick={()=>setBusqueda('')} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:S.t3,cursor:'pointer'}}>✕</button>}
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {CATS_MARKET.map(cat=>(
                <button key={cat} onClick={()=>setCatMarket(cat)}
                  style={{padding:'5px 14px',borderRadius:50,border:`1px solid ${catMarket===cat?S.blue:S.border}`,background:catMarket===cat?`${S.blue}15`:'transparent',color:catMarket===cat?S.blue:S.t3,fontSize:11,fontWeight:700,cursor:'pointer',transition:'all .15s'}}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de productos */}
          <div style={{flex:1,overflowY:'auto',padding:24}}>
            {loading && <div style={{textAlign:'center',padding:40,color:S.t3}}>Cargando marketplace...</div>}
            {!loading && prodFiltrados.length === 0 && (
              <div style={{textAlign:'center',padding:60,color:S.t3}}>
                <div style={{fontSize:48,marginBottom:12}}>🛍️</div>
                <div style={{fontSize:15,fontWeight:700}}>Sin productos en esta categoría</div>
                <div style={{fontSize:12,marginTop:6,color:S.t3}}>Los productos se cargan desde los proveedores registrados en Supply IA</div>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:14}}>
              {prodFiltrados.map(prod=>{
                const enCarrito = carrito.find(c=>c.producto.id===prod.id);
                return (
                  <div key={prod.id} style={{background:S.bg2,border:`1px solid ${prod.es_destacado?`${S.gold}40`:S.border}`,borderRadius:14,overflow:'hidden',display:'flex',flexDirection:'column'}}>
                    {/* Header */}
                    <div style={{background:`linear-gradient(135deg,${S.bg3},${S.bg4})`,padding:'20px 16px',textAlign:'center',position:'relative'}}>
                      {prod.es_destacado && <div style={{position:'absolute',top:8,right:8,fontSize:10,background:`${S.gold}20`,color:S.gold,padding:'2px 8px',borderRadius:20,fontWeight:700}}>⭐ Destacado</div>}
                      <div style={{fontSize:40,marginBottom:8}}>
                        {prod.categoria==='Carnes'?'🥩':prod.categoria==='Pescados'?'🐟':prod.categoria==='Lácteos'?'🧀':prod.categoria==='Bebidas'?'🥤':prod.categoria==='Licores'?'🍷':prod.categoria==='Verduras'?'🥦':prod.categoria==='Frutas'?'🍊':prod.categoria==='Bar'?'🍸':'📦'}
                      </div>
                      <div style={{fontSize:14,fontWeight:700,color:S.t1}}>{prod.nombre}</div>
                      {prod.proveedor_nombre && <div style={{fontSize:10,color:S.t3,marginTop:3}}>{prod.proveedor_nombre}</div>}
                    </div>
                    {/* Info */}
                    <div style={{padding:'12px 16px',flex:1}}>
                      {prod.descripcion && <div style={{fontSize:11,color:S.t2,marginBottom:8,lineHeight:1.5}}>{prod.descripcion}</div>}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        <div style={{background:S.bg3,borderRadius:8,padding:'8px 10px'}}>
                          <div style={{fontSize:9,color:S.t3}}>Por unidad</div>
                          <div style={{fontSize:14,fontWeight:700,color:S.gold}}>{prod.precio_unidad?fmt(prod.precio_unidad):'—'}</div>
                        </div>
                        <div style={{background:S.bg3,borderRadius:8,padding:'8px 10px'}}>
                          <div style={{fontSize:9,color:S.t3}}>Por caja ({prod.unidades_por_caja}u)</div>
                          <div style={{fontSize:14,fontWeight:700,color:S.cyan}}>{prod.precio_caja?fmt(prod.precio_caja):'—'}</div>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:8,marginTop:8}}>
                        <span style={{fontSize:10,color:S.t3,background:S.bg3,padding:'2px 8px',borderRadius:8}}>⏱ {prod.tiempo_entrega_dias}d</span>
                        <span style={{fontSize:10,color:S.gold,background:`${S.gold}10`,padding:'2px 8px',borderRadius:8}}>★ {prod.calificacion}</span>
                        <span style={{fontSize:10,color:S.t3,background:S.bg3,padding:'2px 8px',borderRadius:8}}>{prod.unidad}</span>
                      </div>
                    </div>
                    {/* Botón */}
                    <div style={{padding:'0 16px 14px'}}>
                      {enCarrito ? (
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <button onClick={()=>setCarrito(p=>p.map(c=>c.producto.id===prod.id?{...c,cantidad:Math.max(1,c.cantidad-1)}:c))}
                            style={{width:32,height:32,borderRadius:8,border:`1px solid ${S.blue}40`,background:'transparent',color:S.blue,cursor:'pointer',fontSize:18}}>−</button>
                          <span style={{flex:1,textAlign:'center',fontWeight:900,color:S.blue}}>{enCarrito.cantidad}</span>
                          <button onClick={()=>addToCart(prod)}
                            style={{width:32,height:32,borderRadius:8,border:`1px solid ${S.blue}40`,background:'transparent',color:S.blue,cursor:'pointer',fontSize:18}}>+</button>
                          <button onClick={()=>removeFromCart(prod.id)}
                            style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${S.red}40`,background:'transparent',color:S.red,cursor:'pointer',fontSize:11}}>✕</button>
                        </div>
                      ) : (
                        <button onClick={()=>addToCart(prod)}
                          style={{width:'100%',padding:'9px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.blue},${S.purple})`,color:'#fff',fontWeight:700,cursor:'pointer',fontSize:12}}>
                          + Agregar al pedido
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL CARRITO ══ */}
      {showCart && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:S.bg2,border:`1px solid ${S.border2}`,borderRadius:18,width:'100%',maxWidth:480,maxHeight:'80vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:`1px solid ${S.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>🛒 Carrito — {cartCount} items</div>
              <button onClick={()=>setShowCart(false)} style={{background:'none',border:'none',color:S.t3,cursor:'pointer',fontSize:20}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              {carrito.length===0 && <div style={{textAlign:'center',padding:40,color:S.t3}}>Carrito vacío</div>}
              {carrito.map(item=>(
                <div key={item.producto.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:`1px solid ${S.border}`}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700}}>{item.producto.nombre}</div>
                    <div style={{fontSize:11,color:S.t3}}>{item.producto.proveedor_nombre}</div>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:S.gold}}>{item.producto.precio_unidad?fmt(item.producto.precio_unidad*item.cantidad):'—'}</div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <button onClick={()=>setCarrito(p=>p.map(c=>c.producto.id===item.producto.id?{...c,cantidad:Math.max(1,c.cantidad-1)}:c))} style={{width:26,height:26,borderRadius:6,border:`1px solid ${S.border}`,background:S.bg3,color:S.t1,cursor:'pointer'}}>−</button>
                    <span style={{minWidth:20,textAlign:'center',fontWeight:700}}>{item.cantidad}</span>
                    <button onClick={()=>setCarrito(p=>p.map(c=>c.producto.id===item.producto.id?{...c,cantidad:c.cantidad+1}:c))} style={{width:26,height:26,borderRadius:6,border:`1px solid ${S.border}`,background:S.bg3,color:S.t1,cursor:'pointer'}}>+</button>
                    <button onClick={()=>removeFromCart(item.producto.id)} style={{width:26,height:26,borderRadius:6,border:`1px solid ${S.red}30`,background:'transparent',color:S.red,cursor:'pointer'}}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            {carrito.length > 0 && (
              <div style={{padding:16,borderTop:`1px solid ${S.border}`}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
                  <span style={{fontSize:14,fontWeight:700}}>Total estimado</span>
                  <span style={{fontSize:18,fontWeight:900,color:S.gold,fontFamily:"'Syne',sans-serif"}}>{fmt(cartTotal)}</span>
                </div>
                <button onClick={enviarOrden}
                  style={{width:'100%',padding:13,borderRadius:12,border:'none',background:`linear-gradient(135deg,${S.blue},${S.purple})`,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                  ✓ Enviar orden de compra
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
