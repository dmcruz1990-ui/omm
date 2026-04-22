import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';

const S = {
  bg:'#0a0a0a', bg2:'#141414', bg3:'#1c1c1c', bg4:'#222222',
  border:'#2a2a2a', text1:'#f0f0f0', text2:'#a0a0a0', text3:'#606060',
  gold:'#d4943a', goldL:'#f0b45a', green:'#3dba6f',
  red:'#e05050', blue:'#4a8fd4', purple:'#9b72ff', pink:'#e91e8c',
};
const inp: React.CSSProperties = { background:S.bg3, border:`1px solid ${S.border}`, borderRadius:8, padding:'9px 14px', color:S.text1, fontSize:13, outline:'none', width:'100%' };
const btn = (color:string): React.CSSProperties => ({ padding:'9px 18px', borderRadius:9, border:'none', background:color, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' });

type CTab = 'grid' | 'perfil' | 'nuevo' | 'analytics';
type Segmento = 'todos' | 'vip' | 'recurrentes' | 'nuevos' | 'dormidos';

interface Customer {
  id:number; name:string; apellido?:string; phone?:string; email?:string;
  notes?:string; vip_status?:boolean; total_visits?:number; total_spent?:number;
  created_at?:string; fecha_nacimiento?:string; alergias?:string[]; preferencias?:string[];
  ultima_visita?:string; score?:number; tags?:string[]; documento?:string;
  tipo_documento?:string; ciudad?:string; origen_captacion?:string;
  promedio_ticket?:number; canal_preferido?:string; activo?:boolean;
  ocasiones_especiales?:any[]; historial_notas?:any[];
  // desde vista
  reservas_count?:number; ultima_reserva?:string; ocasiones_visitadas?:string[];
}

const TAGS_PRESET = ['Cumpleañero frecuente','Primera vez','Crítico gastronómico','Influencer','Corporativo','Alérgico crítico','Sommelier','Vegetariano','Sin gluten','Madrugador','Noche larga','Propina generosa'];
const ALERGIAS_PRESET = ['Mariscos','Gluten','Lácteos','Nueces','Huevo','Soya','Pescado','Cerdo','Maní'];
const PREFS_PRESET = ['Mesa ventana','Mesa esquinera','Mesa íntima','Zona VIP','Barra','Terraza','Música baja','Sillas altas','Luz tenue'];
const CANALES = ['walk-in','web','whatsapp','instagram','telefono','oh_yeah','referido'];
const OCASIONES_TIPOS = ['Cumpleaños','Aniversario','Negocio','Primera Cita','Celebración','Graduación','Despedida','Otro'];

const scoreColor = (s:number) => s>=80?S.green:s>=50?S.goldL:s>=20?S.gold:S.red;
const scoreLabel = (s:number) => s>=80?'Embajador':s>=50?'Frecuente':s>=20?'Ocasional':'Nuevo';
const iniciales = (n:string,a?:string) => `${n.charAt(0)}${a?a.charAt(0):''}`.toUpperCase();
const formatFecha = (f?:string) => f ? new Date(f+'T00:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'}) : '—';
const hoy = () => new Date().toISOString().split('T')[0];

export default function CustomersModule() {
  const [ctab, setCtab]       = useState<CTab>('grid');
  const [clientes, setClientes] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer|null>(null);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [segmento, setSegmento] = useState<Segmento>('todos');
  const [ordenar, setOrdenar]   = useState('total_visits');
  const [toast, setToast]       = useState('');
  const [editMode, setEditMode] = useState(false);
  const [nuevaNota, setNuevaNota] = useState('');
  const [form, setForm]         = useState<Partial<Customer>>({ tipo_documento:'CC', origen_captacion:'walk-in', activo:true });
  const [tagInput, setTagInput] = useState('');
  const [rangoDias, setRangoDias] = useState(30);
  const [alergiasEdit, setAlergiasEdit] = useState<string[]>([]);
  const [prefsEdit, setPrefsEdit] = useState<string[]>([]);
  const [tagsEdit, setTagsEdit] = useState<string[]>([]);

  const showToast = useCallback((m:string)=>{ setToast(m); setTimeout(()=>setToast(''),3000); },[]);
  const setF = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  const fetchClientes = async () => {
    const { data } = await supabase.from('vista_customers').select('*').order('total_visits',{ascending:false});
    if (data) setClientes(data as Customer[]);
    setLoading(false);
  };

  useEffect(()=>{ fetchClientes(); },[]);

  // ── Filtros ───────────────────────────────────────────────
  const filtrados = (() => {
    let base = clientes.filter(c => c.activo !== false);
    // Segmento
    if (segmento==='vip')       base = base.filter(c=>c.vip_status);
    if (segmento==='recurrentes') base = base.filter(c=>(c.total_visits||0)>=3);
    if (segmento==='nuevos')    base = base.filter(c=>(c.total_visits||0)<=1);
    if (segmento==='dormidos')  {
      const hace90 = new Date(); hace90.setDate(hace90.getDate()-90);
      base = base.filter(c=>!c.ultima_visita||new Date(c.ultima_visita)<hace90);
    }
    // Búsqueda
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      base = base.filter(c=>
        c.name?.toLowerCase().includes(q)||c.apellido?.toLowerCase().includes(q)||
        c.email?.toLowerCase().includes(q)||c.phone?.includes(q)||
        c.documento?.includes(q)||c.ciudad?.toLowerCase().includes(q)||
        c.tags?.some(t=>t.toLowerCase().includes(q))
      );
    }
    // Ordenar
    base = [...base].sort((a,b)=>{
      if (ordenar==='total_visits') return (b.total_visits||0)-(a.total_visits||0);
      if (ordenar==='total_spent')  return Number(b.total_spent||0)-Number(a.total_spent||0);
      if (ordenar==='score')        return (b.score||0)-(a.score||0);
      if (ordenar==='reciente')     return (b.ultima_visita||'').localeCompare(a.ultima_visita||'');
      if (ordenar==='nombre')       return a.name.localeCompare(b.name);
      return 0;
    });
    return base;
  })();

  // ── KPIs ─────────────────────────────────────────────────
  const kpis = [
    { label:'Total clientes', value:clientes.length, color:S.purple },
    { label:'VIP',            value:clientes.filter(c=>c.vip_status).length, color:S.gold },
    { label:'Recurrentes',    value:clientes.filter(c=>(c.total_visits||0)>=3).length, color:S.green },
    { label:'Ticket prom.',   value:`$${Math.round(clientes.reduce((a,c)=>a+Number(c.promedio_ticket||0),0)/Math.max(clientes.length,1)).toLocaleString('es-CO')}`, color:S.goldL },
  ];

  // ── Guardar cliente nuevo ─────────────────────────────────
  const guardarNuevo = async () => {
    if (!form.name) { showToast('⚠️ Nombre requerido'); return; }
    const payload = { ...form, alergias:alergiasEdit, preferencias:prefsEdit, tags:tagsEdit, score: calcularScore(form as Customer) };
    const { error } = await supabase.from('customers').insert(payload);
    if (error) { showToast(`✗ ${error.message}`); return; }
    showToast(`✓ ${form.name} creado en la base de clientes`);
    setForm({ tipo_documento:'CC', origen_captacion:'walk-in', activo:true });
    setAlergiasEdit([]); setPrefsEdit([]); setTagsEdit([]);
    setCtab('grid'); fetchClientes();
  };

  // ── Guardar edición ───────────────────────────────────────
  const guardarEdicion = async () => {
    if (!selected) return;
    const payload = { ...form, alergias:alergiasEdit, preferencias:prefsEdit, tags:tagsEdit, score: calcularScore({...selected,...form} as Customer) };
    const { error } = await supabase.from('customers').update(payload).eq('id',selected.id);
    if (error) { showToast(`✗ ${error.message}`); return; }
    showToast('✓ Perfil actualizado');
    setEditMode(false); fetchClientes();
    const updated = { ...selected, ...payload };
    setSelected(updated as Customer);
  };

  // ── Agregar nota al historial ─────────────────────────────
  const agregarNota = async () => {
    if (!selected||!nuevaNota.trim()) return;
    const notas = [...(selected.historial_notas||[]), { texto:nuevaNota, fecha:hoy(), autor:'Staff' }];
    await supabase.from('customers').update({ historial_notas:notas }).eq('id',selected.id);
    showToast('✓ Nota guardada');
    setNuevaNota('');
    setSelected({ ...selected, historial_notas:notas });
    fetchClientes();
  };

  // ── Toggle VIP ────────────────────────────────────────────
  const toggleVip = async (c:Customer) => {
    const nuevo = !c.vip_status;
    await supabase.from('customers').update({ vip_status:nuevo }).eq('id',c.id);
    showToast(nuevo ? `⭐ ${c.name} ahora es VIP` : `${c.name} removido de VIP`);
    if (selected?.id===c.id) setSelected({...c, vip_status:nuevo});
    fetchClientes();
  };

  // ── Score automático ──────────────────────────────────────
  const calcularScore = (c:Partial<Customer>) => {
    let s = 0;
    if ((c.total_visits||0)>=10) s+=40; else s+=(c.total_visits||0)*4;
    if (Number(c.total_spent||0)>=500000) s+=30; else s+=Math.round(Number(c.total_spent||0)/16667);
    if (c.vip_status) s+=10;
    if (c.email) s+=5;
    if (c.phone) s+=5;
    if ((c.alergias as any[])?.length) s+=5;
    if ((c.preferencias as any[])?.length) s+=5;
    return Math.min(100,s);
  };

  const abrirPerfil = (c:Customer) => {
    setSelected(c);
    setForm({ name:c.name, apellido:c.apellido, phone:c.phone, email:c.email, fecha_nacimiento:c.fecha_nacimiento, documento:c.documento, tipo_documento:c.tipo_documento||'CC', ciudad:c.ciudad, origen_captacion:c.origen_captacion||'walk-in', canal_preferido:c.canal_preferido, notes:c.notes, vip_status:c.vip_status, promedio_ticket:c.promedio_ticket });
    setAlergiasEdit(c.alergias||[]); setPrefsEdit(c.preferencias||[]); setTagsEdit(c.tags||[]);
    setCtab('perfil');
  };

  const toggleArr = (arr:string[], setArr:React.Dispatch<React.SetStateAction<string[]>>, val:string) => {
    setArr(prev => prev.includes(val) ? prev.filter(x=>x!==val) : [...prev,val]);
  };

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:S.bg,color:S.text1,fontFamily:"'DM Sans',sans-serif"}}>

      {/* Toast */}
      {toast && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'#222',border:`1px solid ${S.purple}`,color:S.text1,padding:'10px 22px',borderRadius:10,fontSize:13,zIndex:9999}}>{toast}</div>}

      {/* Header */}
      <div style={{padding:'12px 20px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${S.purple},#5030a0)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>👥</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900}}>CLIENTES</div>
            <div style={{fontSize:11,color:S.text3}}>Base de datos CRM — OMM</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{position:'relative'}}>
            <input placeholder="🔍 Nombre, email, teléfono, tag..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}
              style={{...inp,width:260,fontSize:12,padding:'8px 14px'}} />
            {busqueda && <button onClick={()=>setBusqueda('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:S.text3,cursor:'pointer'}}>✕</button>}
          </div>
          <select style={{...inp,width:'auto',fontSize:12,padding:'8px 12px'}} value={ordenar} onChange={e=>setOrdenar(e.target.value)}>
            <option value="total_visits">Más visitas</option>
            <option value="total_spent">Mayor gasto</option>
            <option value="score">Mayor score</option>
            <option value="reciente">Más reciente</option>
            <option value="nombre">Nombre A-Z</option>
          </select>
          <button onClick={()=>setCtab('analytics')} style={{...btn(ctab==='analytics'?S.purple:'transparent'),padding:'8px 16px',border:`1px solid ${ctab==='analytics'?S.purple:S.border}`,color:ctab==='analytics'?'#fff':S.text3}}>📊 Analytics</button>
          <button onClick={()=>setCtab('nuevo')} style={{...btn(S.purple),padding:'8px 16px'}}>+ Nuevo cliente</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,padding:'10px 20px',borderBottom:`1px solid ${S.border}`,flexShrink:0}}>
        {kpis.map(k=>(
          <div key={k.label} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:10,padding:'8px 14px'}}>
            <div style={{fontSize:10,color:S.text3,marginBottom:2}}>{k.label}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:k.color}}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Segmentos */}
      <div style={{display:'flex',gap:6,padding:'10px 20px',borderBottom:`1px solid ${S.border}`,flexShrink:0,flexWrap:'wrap'}}>
        {([
          {id:'todos',      label:'Todos',       count:clientes.length},
          {id:'vip',        label:'⭐ VIP',       count:clientes.filter(c=>c.vip_status).length},
          {id:'recurrentes',label:'🔄 Recurrentes',count:clientes.filter(c=>(c.total_visits||0)>=3).length},
          {id:'nuevos',     label:'🆕 Nuevos',    count:clientes.filter(c=>(c.total_visits||0)<=1).length},
          {id:'dormidos',   label:'💤 Dormidos',  count:clientes.filter(c=>{ const h=new Date(); h.setDate(h.getDate()-90); return !c.ultima_visita||new Date(c.ultima_visita)<h; }).length},
        ] as const).map(s=>(
          <button key={s.id} onClick={()=>setSegmento(s.id)}
            style={{padding:'5px 14px',borderRadius:20,border:`1px solid ${segmento===s.id?S.purple:S.border}`,background:segmento===s.id?`${S.purple}20`:'transparent',color:segmento===s.id?S.purple:S.text3,fontSize:11,fontWeight:700,cursor:'pointer'}}>
            {s.label} <span style={{opacity:.6}}>({s.count})</span>
          </button>
        ))}
        {busqueda && <span style={{fontSize:11,color:S.text3,alignSelf:'center',marginLeft:8}}>{filtrados.length} resultado{filtrados.length!==1?'s':''}</span>}
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex'}}>

        {/* ── GRID CLIENTES ── */}
        {ctab==='grid' && (
          <div style={{flex:1,overflowY:'auto',padding:16}}>
            {loading && <div style={{color:S.text3,textAlign:'center',padding:40}}>Cargando clientes...</div>}
            {!loading && filtrados.length===0 && (
              <div style={{background:S.bg2,borderRadius:16,padding:60,textAlign:'center'}}>
                <div style={{fontSize:48,marginBottom:12}}>👥</div>
                <div style={{fontSize:16,fontWeight:700}}>{busqueda?'Sin resultados':'Sin clientes aún'}</div>
                <div style={{fontSize:12,color:S.text3,marginTop:6}}>Crea el primer perfil con el botón "+ Nuevo cliente"</div>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12}}>
              {filtrados.map(c=>{
                const sc = c.score||0;
                return (
                  <div key={c.id} onClick={()=>abrirPerfil(c)}
                    style={{background:S.bg2,border:`1px solid ${c.vip_status?S.gold+'40':S.border}`,borderRadius:16,padding:16,cursor:'pointer',transition:'all .2s',position:'relative'}}
                    onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor=S.purple+'60'}
                    onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor=c.vip_status?S.gold+'40':S.border}>

                    {/* Score bar */}
                    <div style={{position:'absolute',top:0,left:0,right:0,height:3,borderRadius:'16px 16px 0 0',background:S.bg3}}>
                      <div style={{height:'100%',borderRadius:'16px 16px 0 0',background:scoreColor(sc),width:`${sc}%`,transition:'width .4s'}}/>
                    </div>

                    <div style={{display:'flex',alignItems:'flex-start',gap:12,marginTop:6}}>
                      <div style={{width:46,height:46,borderRadius:12,background:`linear-gradient(135deg,${S.purple}80,#3020a0)`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,color:'#fff',flexShrink:0,position:'relative'}}>
                        {iniciales(c.name,c.apellido)}
                        {c.vip_status && <div style={{position:'absolute',bottom:-3,right:-3,fontSize:10,background:S.bg2,borderRadius:'50%',width:16,height:16,display:'flex',alignItems:'center',justifyContent:'center'}}>⭐</div>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                          <span style={{fontSize:14,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name} {c.apellido}</span>
                        </div>
                        <div style={{fontSize:11,color:S.text3,marginBottom:6}}>{c.email||c.phone||'Sin contacto'}</div>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          <span style={{fontSize:9,background:`${scoreColor(sc)}20`,color:scoreColor(sc),padding:'2px 8px',borderRadius:20,fontWeight:700}}>{scoreLabel(sc)} · {sc}pts</span>
                          {c.ciudad && <span style={{fontSize:9,background:`${S.blue}15`,color:S.blue,padding:'2px 8px',borderRadius:20}}>{c.ciudad}</span>}
                          {c.alergias?.length&&<span style={{fontSize:9,background:`${S.red}15`,color:S.red,padding:'2px 8px',borderRadius:20}}>⚠️ Alergias</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginTop:12}}>
                      {[
                        {l:'Visitas',  v:c.total_visits||0,             color:S.blue},
                        {l:'Gastado',  v:`$${Math.round(Number(c.total_spent||0)/1000)}k`, color:S.goldL},
                        {l:'Reservas', v:c.reservas_count||0,           color:S.purple},
                      ].map(m=>(
                        <div key={m.l} style={{background:S.bg3,borderRadius:8,padding:'6px 8px',textAlign:'center'}}>
                          <div style={{fontSize:9,color:S.text3}}>{m.l}</div>
                          <div style={{fontSize:15,fontWeight:900,color:m.color,fontFamily:"'Syne',sans-serif"}}>{m.v}</div>
                        </div>
                      ))}
                    </div>

                    {c.tags?.length ? (
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:8}}>
                        {c.tags.slice(0,3).map(t=>(
                          <span key={t} style={{fontSize:9,background:S.bg4,color:S.text3,padding:'2px 8px',borderRadius:20,border:`1px solid ${S.border}`}}>{t}</span>
                        ))}
                        {c.tags.length>3&&<span style={{fontSize:9,color:S.text3}}>+{c.tags.length-3}</span>}
                      </div>
                    ):null}

                    {c.ultima_visita && <div style={{fontSize:10,color:S.text3,marginTop:8}}>Última visita: {formatFecha(c.ultima_visita)}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PERFIL DETALLE ── */}
        {ctab==='perfil' && selected && (
          <div style={{flex:1,overflowY:'auto',padding:16,display:'grid',gridTemplateColumns:'340px 1fr',gap:16,alignItems:'start'}}>

            {/* Panel izquierdo — info principal */}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>

              {/* Header perfil */}
              <div style={{background:S.bg2,border:`1px solid ${selected.vip_status?S.gold+'40':S.border}`,borderRadius:16,padding:20}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
                  <button onClick={()=>{setCtab('grid');setEditMode(false);}} style={{background:'none',border:'none',color:S.text3,fontSize:12,cursor:'pointer'}}>← Volver</button>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>toggleVip(selected)} style={{...btn(selected.vip_status?S.text3:S.gold),padding:'5px 12px',fontSize:11}}>{selected.vip_status?'Quitar VIP':'⭐ VIP'}</button>
                    <button onClick={()=>setEditMode(p=>!p)} style={{...btn(editMode?S.red:S.purple),padding:'5px 12px',fontSize:11}}>{editMode?'Cancelar':'Editar'}</button>
                  </div>
                </div>
                <div style={{display:'flex',gap:14,alignItems:'center'}}>
                  <div style={{width:60,height:60,borderRadius:14,background:`linear-gradient(135deg,${S.purple},#3020a0)`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:'#fff',flexShrink:0,position:'relative'}}>
                    {iniciales(selected.name,selected.apellido)}
                    {selected.vip_status && <div style={{position:'absolute',bottom:-4,right:-4,fontSize:14,background:S.bg2,borderRadius:'50%',width:22,height:22,display:'flex',alignItems:'center',justifyContent:'center'}}>⭐</div>}
                  </div>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900}}>{selected.name} {selected.apellido}</div>
                    <div style={{fontSize:12,color:S.text3,marginTop:2}}>{selected.email||'Sin email'}</div>
                    <div style={{fontSize:12,color:S.text3}}>{selected.phone||'Sin teléfono'}</div>
                  </div>
                </div>
                {/* Score */}
                <div style={{marginTop:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:10,color:S.text3,fontWeight:700}}>Score CRM</span>
                    <span style={{fontSize:12,fontWeight:900,color:scoreColor(selected.score||0)}}>{scoreLabel(selected.score||0)} · {selected.score||0}/100</span>
                  </div>
                  <div style={{height:6,background:S.bg3,borderRadius:4,overflow:'hidden'}}>
                    <div style={{height:'100%',background:scoreColor(selected.score||0),width:`${selected.score||0}%`,borderRadius:4,transition:'width .4s'}}/>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
                <div style={{fontSize:10,color:S.text3,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:12}}>Historial</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[
                    {l:'Total visitas',  v:selected.total_visits||0,  color:S.blue},
                    {l:'Total gastado',  v:`$${Number(selected.total_spent||0).toLocaleString('es-CO')}`, color:S.goldL},
                    {l:'Reservas',       v:selected.reservas_count||0, color:S.purple},
                    {l:'Ticket prom.',   v:`$${Number(selected.promedio_ticket||0).toLocaleString('es-CO')}`, color:S.green},
                  ].map(m=>(
                    <div key={m.l} style={{background:S.bg3,borderRadius:10,padding:'10px 12px'}}>
                      <div style={{fontSize:9,color:S.text3,marginBottom:4}}>{m.l}</div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:m.color}}>{m.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:10,fontSize:11,color:S.text3}}>
                  Primera visita: {formatFecha(selected.created_at?.split('T')[0])}
                </div>
                {selected.ultima_visita && <div style={{fontSize:11,color:S.text3}}>Última visita: {formatFecha(selected.ultima_visita)}</div>}
                {selected.ocasiones_visitadas?.filter(Boolean).length ? (
                  <div style={{fontSize:11,color:S.text3,marginTop:4}}>Ocasiones: {selected.ocasiones_visitadas.filter(Boolean).join(', ')}</div>
                ):null}
              </div>

              {/* Alergias y preferencias */}
              {(selected.alergias?.length||selected.preferencias?.length) && (
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
                  {selected.alergias?.length ? (
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:10,color:S.red,fontWeight:700,marginBottom:6}}>⚠️ ALERGIAS</div>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                        {selected.alergias.map(a=><span key={a} style={{fontSize:11,background:`${S.red}15`,color:S.red,padding:'3px 10px',borderRadius:20,border:`1px solid ${S.red}30`}}>{a}</span>)}
                      </div>
                    </div>
                  ):null}
                  {selected.preferencias?.length ? (
                    <div>
                      <div style={{fontSize:10,color:S.green,fontWeight:700,marginBottom:6}}>✓ PREFERENCIAS</div>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                        {selected.preferencias.map(p=><span key={p} style={{fontSize:11,background:`${S.green}15`,color:S.green,padding:'3px 10px',borderRadius:20,border:`1px solid ${S.green}30`}}>{p}</span>)}
                      </div>
                    </div>
                  ):null}
                </div>
              )}

              {/* Tags */}
              {selected.tags?.length ? (
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
                  <div style={{fontSize:10,color:S.text3,fontWeight:700,marginBottom:8}}>TAGS</div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {selected.tags.map(t=><span key={t} style={{fontSize:11,background:S.bg3,color:S.text2,padding:'3px 10px',borderRadius:20,border:`1px solid ${S.border}`}}>{t}</span>)}
                  </div>
                </div>
              ):null}
            </div>

            {/* Panel derecho — edición / notas */}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>

              {editMode ? (
                /* ── Modo edición ── */
                <div style={{background:S.bg2,border:`1px solid ${S.purple}40`,borderRadius:16,padding:20}}>
                  <div style={{fontSize:12,color:S.purple,fontWeight:700,marginBottom:16,textTransform:'uppercase' as const}}>Editar perfil</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                    {[
                      {k:'name',label:'Nombre *',ph:'Nombre'},
                      {k:'apellido',label:'Apellido',ph:'Apellido'},
                      {k:'phone',label:'Teléfono',ph:'+57 300...'},
                      {k:'email',label:'Email',ph:'email@...'},
                      {k:'ciudad',label:'Ciudad',ph:'Bogotá'},
                      {k:'fecha_nacimiento',label:'Fecha nacimiento',type:'date'},
                      {k:'documento',label:'Documento',ph:'CC / NIT'},
                    ].map(f=>(
                      <div key={f.k}>
                        <div style={{fontSize:10,color:S.text3,marginBottom:4}}>{f.label}</div>
                        <input type={f.type||'text'} style={inp} placeholder={f.ph} value={(form as any)[f.k]||''} onChange={e=>setF(f.k,e.target.value)} />
                      </div>
                    ))}
                    <div>
                      <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Canal preferido</div>
                      <select style={inp} value={form.canal_preferido||''} onChange={e=>setF('canal_preferido',e.target.value)}>
                        <option value="">Sin preferencia</option>
                        {CANALES.map(c=><option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Alergias */}
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:10,color:S.red,fontWeight:700,marginBottom:6}}>⚠️ Alergias</div>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      {ALERGIAS_PRESET.map(a=>(
                        <button key={a} onClick={()=>toggleArr(alergiasEdit,setAlergiasEdit,a)}
                          style={{padding:'4px 12px',borderRadius:20,border:`1px solid ${alergiasEdit.includes(a)?S.red:S.border}`,background:alergiasEdit.includes(a)?`${S.red}20`:'transparent',color:alergiasEdit.includes(a)?S.red:S.text3,fontSize:11,cursor:'pointer'}}>
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preferencias */}
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:10,color:S.green,fontWeight:700,marginBottom:6}}>✓ Preferencias</div>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      {PREFS_PRESET.map(p=>(
                        <button key={p} onClick={()=>toggleArr(prefsEdit,setPrefsEdit,p)}
                          style={{padding:'4px 12px',borderRadius:20,border:`1px solid ${prefsEdit.includes(p)?S.green:S.border}`,background:prefsEdit.includes(p)?`${S.green}20`:'transparent',color:prefsEdit.includes(p)?S.green:S.text3,fontSize:11,cursor:'pointer'}}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:10,color:S.text3,fontWeight:700,marginBottom:6}}>Tags</div>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>
                      {TAGS_PRESET.map(t=>(
                        <button key={t} onClick={()=>toggleArr(tagsEdit,setTagsEdit,t)}
                          style={{padding:'4px 12px',borderRadius:20,border:`1px solid ${tagsEdit.includes(t)?S.purple:S.border}`,background:tagsEdit.includes(t)?`${S.purple}20`:'transparent',color:tagsEdit.includes(t)?S.purple:S.text3,fontSize:11,cursor:'pointer'}}>
                          {t}
                        </button>
                      ))}
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <input style={{...inp,flex:1}} placeholder="Tag personalizado..." value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&tagInput.trim()){ toggleArr(tagsEdit,setTagsEdit,tagInput.trim()); setTagInput(''); }}} />
                      <button onClick={()=>{ if(tagInput.trim()){ toggleArr(tagsEdit,setTagsEdit,tagInput.trim()); setTagInput(''); }}} style={{...btn(S.purple),padding:'9px 14px',fontSize:12}}>+</button>
                    </div>
                  </div>

                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>setEditMode(false)} style={{...btn(S.text3),flex:1,background:'transparent',border:`1px solid ${S.border}`,color:S.text3}}>Cancelar</button>
                    <button onClick={guardarEdicion} style={{...btn(S.purple),flex:2}}>✓ Guardar cambios</button>
                  </div>
                </div>
              ) : (
                /* ── Modo lectura — info adicional ── */
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
                  <div style={{fontSize:10,color:S.text3,fontWeight:700,marginBottom:12,textTransform:'uppercase' as const}}>Datos adicionales</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {[
                      {l:'Documento',  v:`${selected.tipo_documento||'CC'} ${selected.documento||'—'}`},
                      {l:'Ciudad',     v:selected.ciudad||'—'},
                      {l:'Captación',  v:selected.origen_captacion||'—'},
                      {l:'Canal pref.',v:selected.canal_preferido||'—'},
                      {l:'Cumpleaños', v:formatFecha(selected.fecha_nacimiento)},
                      {l:'Registrado', v:formatFecha(selected.created_at?.split('T')[0])},
                    ].map(x=>(
                      <div key={x.l} style={{background:S.bg3,borderRadius:8,padding:'8px 12px'}}>
                        <div style={{fontSize:9,color:S.text3,marginBottom:2}}>{x.l}</div>
                        <div style={{fontSize:12,fontWeight:600}}>{x.v}</div>
                      </div>
                    ))}
                  </div>
                  {selected.notes && (
                    <div style={{marginTop:12,background:S.bg3,borderRadius:8,padding:'10px 14px',fontSize:12,color:S.text2}}>
                      📝 {selected.notes}
                    </div>
                  )}
                </div>
              )}

              {/* Notas del historial */}
              {!editMode && (
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
                  <div style={{fontSize:10,color:S.text3,fontWeight:700,marginBottom:12,textTransform:'uppercase' as const}}>Notas del equipo</div>
                  <div style={{display:'flex',gap:8,marginBottom:12}}>
                    <input style={{...inp,flex:1,fontSize:12}} placeholder="Agregar nota del servicio..." value={nuevaNota} onChange={e=>setNuevaNota(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') agregarNota(); }} />
                    <button onClick={agregarNota} style={{...btn(S.gold),padding:'9px 14px',fontSize:12}}>+</button>
                  </div>
                  {(selected.historial_notas||[]).length===0 && <div style={{fontSize:12,color:S.text3}}>Sin notas aún</div>}
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {[...(selected.historial_notas||[])].reverse().map((n:any,i)=>(
                      <div key={i} style={{background:S.bg3,borderRadius:10,padding:'10px 14px'}}>
                        <div style={{fontSize:12,color:S.text1,marginBottom:4}}>{n.texto}</div>
                        <div style={{fontSize:10,color:S.text3}}>{n.autor} · {formatFecha(n.fecha)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NUEVO CLIENTE ── */}
        {ctab==='nuevo' && (
          <div style={{flex:1,overflowY:'auto',padding:16}}>
            <div style={{maxWidth:640}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
                <button onClick={()=>setCtab('grid')} style={{background:'none',border:'none',color:S.text3,fontSize:13,cursor:'pointer'}}>← Volver</button>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>Nuevo cliente</div>
              </div>

              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:16,padding:20,marginBottom:14}}>
                <div style={{fontSize:11,color:S.purple,fontWeight:700,marginBottom:14,textTransform:'uppercase' as const}}>Datos personales</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {[
                    {k:'name',label:'Nombre *',ph:'Nombre'},
                    {k:'apellido',label:'Apellido',ph:'Apellido'},
                    {k:'phone',label:'Teléfono / WhatsApp',ph:'+57 310...'},
                    {k:'email',label:'Email',ph:'email@correo.com'},
                    {k:'ciudad',label:'Ciudad',ph:'Bogotá'},
                    {k:'fecha_nacimiento',label:'Fecha de nacimiento',type:'date'},
                  ].map(f=>(
                    <div key={f.k}>
                      <div style={{fontSize:10,color:S.text3,marginBottom:4}}>{f.label}</div>
                      <input type={f.type||'text'} style={inp} placeholder={f.ph} value={(form as any)[f.k]||''} onChange={e=>setF(f.k,e.target.value)} />
                    </div>
                  ))}
                  <div>
                    <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Tipo documento</div>
                    <select style={inp} value={form.tipo_documento||'CC'} onChange={e=>setF('tipo_documento',e.target.value)}>
                      {['CC','CE','NIT','Pasaporte','TI'].map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Número de documento</div>
                    <input style={inp} placeholder="Número..." value={form.documento||''} onChange={e=>setF('documento',e.target.value)} />
                  </div>
                  <div>
                    <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Origen captación</div>
                    <select style={inp} value={form.origen_captacion||'walk-in'} onChange={e=>setF('origen_captacion',e.target.value)}>
                      {CANALES.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Canal preferido</div>
                    <select style={inp} value={form.canal_preferido||''} onChange={e=>setF('canal_preferido',e.target.value)}>
                      <option value="">Sin preferencia</option>
                      {CANALES.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{marginTop:10}}>
                  <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Nota inicial</div>
                  <textarea style={{...inp,minHeight:60,resize:'vertical' as const}} placeholder="Observaciones generales del cliente..." value={form.notes||''} onChange={e=>setF('notes',e.target.value)} />
                </div>
              </div>

              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:16,padding:20,marginBottom:14}}>
                <div style={{fontSize:11,color:S.red,fontWeight:700,marginBottom:12,textTransform:'uppercase' as const}}>⚠️ Alergias e intolerancias</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {ALERGIAS_PRESET.map(a=>(
                    <button key={a} onClick={()=>toggleArr(alergiasEdit,setAlergiasEdit,a)}
                      style={{padding:'6px 14px',borderRadius:20,border:`1px solid ${alergiasEdit.includes(a)?S.red:S.border}`,background:alergiasEdit.includes(a)?`${S.red}20`:'transparent',color:alergiasEdit.includes(a)?S.red:S.text3,fontSize:12,cursor:'pointer',transition:'all .15s'}}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:16,padding:20,marginBottom:14}}>
                <div style={{fontSize:11,color:S.green,fontWeight:700,marginBottom:12,textTransform:'uppercase' as const}}>✓ Preferencias de servicio</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {PREFS_PRESET.map(p=>(
                    <button key={p} onClick={()=>toggleArr(prefsEdit,setPrefsEdit,p)}
                      style={{padding:'6px 14px',borderRadius:20,border:`1px solid ${prefsEdit.includes(p)?S.green:S.border}`,background:prefsEdit.includes(p)?`${S.green}20`:'transparent',color:prefsEdit.includes(p)?S.green:S.text3,fontSize:12,cursor:'pointer',transition:'all .15s'}}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:16,padding:20,marginBottom:20}}>
                <div style={{fontSize:11,color:S.purple,fontWeight:700,marginBottom:12,textTransform:'uppercase' as const}}>Tags</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
                  {TAGS_PRESET.map(t=>(
                    <button key={t} onClick={()=>toggleArr(tagsEdit,setTagsEdit,t)}
                      style={{padding:'6px 14px',borderRadius:20,border:`1px solid ${tagsEdit.includes(t)?S.purple:S.border}`,background:tagsEdit.includes(t)?`${S.purple}20`:'transparent',color:tagsEdit.includes(t)?S.purple:S.text3,fontSize:12,cursor:'pointer',transition:'all .15s'}}>
                      {t}
                    </button>
                  ))}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <input style={{...inp,flex:1,fontSize:12}} placeholder="Tag personalizado..." value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&tagInput.trim()){ toggleArr(tagsEdit,setTagsEdit,tagInput.trim()); setTagInput(''); }}} />
                  <button onClick={()=>{ if(tagInput.trim()){ toggleArr(tagsEdit,setTagsEdit,tagInput.trim()); setTagInput(''); }}} style={{...btn(S.purple),padding:'9px 14px'}}>+</button>
                </div>
              </div>

              <button onClick={guardarNuevo} style={{width:'100%',padding:14,borderRadius:12,border:'none',background:S.purple,color:'#fff',fontSize:14,fontWeight:900,cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>
                ✓ Crear cliente
              </button>
            </div>
          </div>
        )}

        {/* ── ANALYTICS DASHBOARD ── */}
        {ctab==='analytics' && (() => {
          const fechaCorte = new Date();
          fechaCorte.setDate(fechaCorte.getDate() - rangoDias);

          // Temperatura de clientes
          const calientes = clientes.filter(c => (c.total_visits||0)>=5 || (c.score||0)>=70).length;
          const tibios    = clientes.filter(c => { const v=c.total_visits||0; const s=c.score||0; return (v>=2&&v<5)||(s>=30&&s<70); }).length;
          const frios     = clientes.filter(c => (c.total_visits||0)<=1 && (c.score||0)<30).length;

          // Datos pie — origen reservas
          const origenMap: Record<string,number> = {};
          clientes.forEach(cl => {
            const o = (cl.origen_captacion||'walk-in').toLowerCase();
            const key = o==='walk-in'?'Walk-In':o==='web'||o==='google'?'Google/Web':o==='instagram'||o==='redes'?'Redes Sociales':o==='oh_yeah'?'Oh Yeah':o==='whatsapp'?'WhatsApp':o==='telefono'?'Teléfono':'Otro';
            origenMap[key] = (origenMap[key]||0)+1;
          });
          const pieData = Object.entries(origenMap).map(([name,value])=>({name,value}));
          const PIE_COLORS = [S.purple,S.blue,S.gold,S.green,S.red,S.pink,'#60a5fa'];

          // Datos barras — clientes por mes
          const meses: Record<string,{mes:string;clientes:number;costo:number}> = {};
          clientes.forEach(cl => {
            if (!cl.created_at) return;
            const d = new Date(cl.created_at);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            const label = d.toLocaleDateString('es-CO',{month:'short',year:'2-digit'});
            if (!meses[key]) meses[key] = { mes:label, clientes:0, costo:0 };
            meses[key].clientes++;
            meses[key].costo += 50000; // costo estimado adquisición por cliente
          });
          const barData = Object.values(meses).sort((a,b)=>a.mes.localeCompare(b.mes));

          // Tabla clientes con cumpleaños
          const conCumple = clientes.filter(c=>c.fecha_nacimiento).sort((a,b)=>{
            const ma = new Date(a.fecha_nacimiento!).getMonth();
            const mb = new Date(b.fecha_nacimiento!).getMonth();
            return ma-mb;
          });

          return (
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              {/* Filtro rango */}
              <div style={{display:'flex',gap:8,marginBottom:20,alignItems:'center',flexWrap:'wrap'}}>
                <span style={{fontSize:11,color:S.text3,fontWeight:700}}>Período:</span>
                {[
                  {label:'30 días',v:30},{label:'1 mes',v:30},{label:'3 meses',v:90},
                  {label:'6 meses',v:180},{label:'Todo',v:9999},
                ].map(r=>(
                  <button key={r.label} onClick={()=>setRangoDias(r.v)}
                    style={{padding:'5px 14px',borderRadius:20,border:`1px solid ${rangoDias===r.v?S.purple:S.border}`,background:rangoDias===r.v?`${S.purple}20`:'transparent',color:rangoDias===r.v?S.purple:S.text3,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                    {r.label}
                  </button>
                ))}
                <div style={{marginLeft:'auto'}}>
                  <input type="date" style={{...inp,width:'auto',fontSize:11,padding:'5px 12px'}} title="Fecha personalizada" />
                </div>
              </div>

              {/* KPIs temperatura */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:12,padding:'12px 16px'}}>
                  <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Total clientes</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,color:S.purple}}>{clientes.length}</div>
                </div>
                {[
                  {label:'🔴 Calientes',v:calientes,color:'#ef4444',desc:'≥5 visitas o score 70+'},
                  {label:'🟠 Tibios',   v:tibios,   color:S.gold,  desc:'2-4 visitas o score 30-70'},
                  {label:'🔵 Fríos',    v:frios,    color:S.blue,  desc:'≤1 visita y score <30'},
                ].map(k=>(
                  <div key={k.label} style={{background:S.bg2,border:`1px solid ${k.color}30`,borderRadius:12,padding:'12px 16px'}}>
                    <div style={{fontSize:10,color:S.text3,marginBottom:4}}>{k.label}</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,color:k.color}}>{k.v}</div>
                    <div style={{fontSize:9,color:S.text3,marginTop:4}}>{k.desc}</div>
                  </div>
                ))}
              </div>

              {/* Gráficos */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
                {/* Pie — Origen */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:20}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900,marginBottom:4}}>Origen de Clientes</div>
                  <div style={{fontSize:11,color:S.text3,marginBottom:16}}>De dónde vienen tus clientes</div>
                  {pieData.length > 0 ? (() => {
                    const total = pieData.reduce((a,d)=>a+d.value,0);
                    let cumAngle = -Math.PI/2;
                    const cx=110, cy=110, ro=85, ri=52;
                    const slices = pieData.map((d,i)=>{ const a=2*Math.PI*d.value/total; const s=cumAngle; cumAngle+=a; return {...d,startA:s,endA:cumAngle,color:PIE_COLORS[i%PIE_COLORS.length]}; });
                    const arc=(sx:number,sy:number,ex:number,ey:number,large:number,r:number,ri:number)=>{
                      const x1=cx+r*Math.cos(sx),y1=cy+r*Math.sin(sx),x2=cx+r*Math.cos(ey),y2=cy+r*Math.sin(ey);
                      const ix1=cx+ri*Math.cos(sy),iy1=cy+ri*Math.sin(sy),ix2=cx+ri*Math.cos(ey),iy2=cy+ri*Math.sin(ey);
                      return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ri} ${ri} 0 ${large} 0 ${ix1} ${iy1} Z`;
                    };
                    return (
                      <div style={{display:'flex',gap:16,alignItems:'center'}}>
                        <svg width="220" height="220" viewBox="0 0 220 220">
                          {slices.map((s,i)=>{
                            const large = s.endA-s.startA>Math.PI?1:0;
                            return <path key={i} d={arc(s.startA,s.startA,s.endA,s.endA,large,ro,ri)} fill={s.color} stroke={S.bg2} strokeWidth="2"/>;
                          })}
                          <text x="110" y="106" textAnchor="middle" fill={S.text1} fontSize="18" fontWeight="900">{total}</text>
                          <text x="110" y="122" textAnchor="middle" fill={S.text3} fontSize="10">total</text>
                        </svg>
                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                          {slices.map((s,i)=>(
                            <div key={i} style={{display:'flex',alignItems:'center',gap:7,fontSize:11}}>
                              <div style={{width:8,height:8,borderRadius:'50%',background:s.color,flexShrink:0}}/>
                              <span style={{color:S.text2}}>{s.name}</span>
                              <span style={{color:s.color,fontWeight:700,marginLeft:'auto'}}>{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })() : (
                    <div style={{height:220,display:'flex',alignItems:'center',justifyContent:'center',color:S.text3,fontSize:12}}>Sin datos de origen</div>
                  )}
                </div>

                {/* Bar — Costo vs Volumen */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:20}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900,marginBottom:4}}>Análisis Costo vs. Volumen</div>
                  <div style={{fontSize:11,color:S.text3,marginBottom:16}}>Adquisición mensual estimada</div>
                  {barData.length > 0 ? (() => {
                    const maxC = Math.max(...barData.map(d=>d.clientes),1);
                    const maxK = Math.max(...barData.map(d=>d.costo),1);
                    const W=360, H=180, pad=32, barW=Math.max(10,Math.floor((W-pad*2)/(barData.length*2+1)));
                    return (
                      <div>
                        <svg width="100%" viewBox={`0 0 ${W} ${H+24}`} style={{overflow:'visible'}}>
                          {barData.map((d,i)=>{
                            const x = pad + i*(barW*2+6);
                            const hC = Math.round((d.clientes/maxC)*(H-20));
                            const hK = Math.round((d.costo/maxK)*(H-20));
                            return (
                              <g key={i}>
                                <rect x={x} y={H-hC} width={barW} height={hC} rx="3" fill={S.purple}/>
                                <rect x={x+barW+2} y={H-hK} width={barW} height={hK} rx="3" fill={S.gold+'99'}/>
                                <text x={x+barW} y={H+14} textAnchor="middle" fill={S.text3} fontSize="9">{d.mes}</text>
                              </g>
                            );
                          })}
                          <line x1={pad} y1={H} x2={W-pad} y2={H} stroke={S.border} strokeWidth="1"/>
                        </svg>
                        <div style={{display:'flex',gap:14,marginTop:4}}>
                          <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:S.text3}}><div style={{width:8,height:8,borderRadius:2,background:S.purple}}/> Clientes</div>
                          <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:S.text3}}><div style={{width:8,height:8,borderRadius:2,background:S.gold}}/> Costo est.</div>
                        </div>
                      </div>
                    );
                  })() : (
                    <div style={{height:220,display:'flex',alignItems:'center',justifyContent:'center',color:S.text3,fontSize:12}}>Sin datos mensuales</div>
                  )}
                </div>
              </div>

              {/* Tabla clientes */}
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
                <div style={{padding:'14px 20px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900}}>Directorio de Clientes</div>
                    <div style={{fontSize:11,color:S.text3}}>Gustos conectados al ecosistema Oh Yeah</div>
                  </div>
                  <span style={{fontSize:10,color:S.text3}}>{clientes.length} registros</span>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse' as const}}>
                    <thead>
                      <tr style={{background:S.bg3}}>
                        {['Nombre','Celular','Email','Cumpleaños','Gustos / Oh Yeah','Score','VIP'].map((h,i)=>(
                          <th key={h} style={{padding:'10px 14px',fontSize:10,fontWeight:700,color:S.text3,textAlign:'left' as const,textTransform:'uppercase' as const,letterSpacing:'.06em',whiteSpace:'nowrap',borderBottom:`1px solid ${S.border}`}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map((cl,idx)=>(
                        <tr key={cl.id}
                          onClick={()=>abrirPerfil(cl)}
                          style={{background:idx%2===0?S.bg2:S.bg3,cursor:'pointer',transition:'background .15s'}}
                          onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background=`${S.purple}10`}
                          onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=idx%2===0?S.bg2:S.bg3}>
                          <td style={{padding:'10px 14px',fontSize:13,fontWeight:600,whiteSpace:'nowrap'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <div style={{width:28,height:28,borderRadius:8,background:`${S.purple}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,flexShrink:0}}>
                                {iniciales(cl.name,cl.apellido)}
                              </div>
                              {cl.name} {cl.apellido}
                            </div>
                          </td>
                          <td style={{padding:'10px 14px',fontSize:12,color:S.text2,whiteSpace:'nowrap'}}>{cl.phone||'—'}</td>
                          <td style={{padding:'10px 14px',fontSize:12,color:S.text2,whiteSpace:'nowrap',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis'}}>{cl.email||'—'}</td>
                          <td style={{padding:'10px 14px',fontSize:12,color:cl.fecha_nacimiento?S.gold:S.text3,whiteSpace:'nowrap'}}>
                            {cl.fecha_nacimiento ? `🎂 ${new Date(cl.fecha_nacimiento+'T00:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'short'})}` : '—'}
                          </td>
                          <td style={{padding:'10px 14px'}}>
                            <div style={{display:'flex',gap:4,flexWrap:'wrap',maxWidth:220}}>
                              {(cl.preferencias||[]).slice(0,2).map(p=>(
                                <span key={p} style={{fontSize:9,background:`${S.green}15`,color:S.green,padding:'2px 8px',borderRadius:20,border:`1px solid ${S.green}30`,whiteSpace:'nowrap'}}>{p}</span>
                              ))}
                              {(cl.ocasiones_visitadas||[]).filter(Boolean).slice(0,1).map(o=>(
                                <span key={o} style={{fontSize:9,background:`${S.purple}15`,color:S.purple,padding:'2px 8px',borderRadius:20,border:`1px solid ${S.purple}30`,whiteSpace:'nowrap'}}>{o}</span>
                              ))}
                              {/* Badge Oh Yeah */}
                              {cl.tags?.some(t=>t.toLowerCase().includes('oyea')||t.toLowerCase().includes('oh yeah')) && (
                                <span style={{fontSize:9,background:'#FF007F20',color:'#FF007F',padding:'2px 8px',borderRadius:20,border:'1px solid #FF007F40',fontWeight:700,whiteSpace:'nowrap'}}>
                                  ✦ Oh Yeah
                                </span>
                              )}
                              {!(cl.preferencias?.length)&&!(cl.ocasiones_visitadas?.filter(Boolean).length)&&<span style={{fontSize:11,color:S.text3}}>—</span>}
                            </div>
                          </td>
                          <td style={{padding:'10px 14px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                              <div style={{width:40,height:4,background:S.bg4,borderRadius:2,overflow:'hidden'}}>
                                <div style={{height:'100%',background:scoreColor(cl.score||0),width:`${cl.score||0}%`}}/>
                              </div>
                              <span style={{fontSize:11,fontWeight:700,color:scoreColor(cl.score||0)}}>{cl.score||0}</span>
                            </div>
                          </td>
                          <td style={{padding:'10px 14px',textAlign:'center' as const}}>
                            {cl.vip_status ? <span style={{color:S.gold}}>⭐</span> : <span style={{color:S.text3}}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
