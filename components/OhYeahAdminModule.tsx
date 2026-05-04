import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';

// ── Design tokens ─────────────────────────────────────────────────────────
const S = {
  bg:'#08080f', bg2:'#0f0f1a', bg3:'#161624', bg4:'#1e1e2e',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.12)',
  t1:'#FFFFFF', t2:'#A0A0B8', t3:'#50506A',
  gold:'#FFB547', green:'#00E676', red:'#FF5252',
  blue:'#448AFF', purple:'#B388FF', pink:'#FF2D78', cyan:'#22d3ee',
  yellow:'#FFE600',
};
const inp: React.CSSProperties = {
  background:'rgba(255,255,255,0.05)', border:`1px solid rgba(255,255,255,0.12)`,
  borderRadius:10, padding:'10px 14px', color:'#fff', fontSize:13, outline:'none', width:'100%',
  fontFamily:"'DM Sans',sans-serif",
};
const label: React.CSSProperties = { fontSize:11, color:'#50506A', fontWeight:700, marginBottom:6, display:'block', textTransform:'uppercase', letterSpacing:'.06em' };

type Tab = 'general' | 'fotos' | 'horarios' | 'amenidades' | 'experiencias' | 'menu' | 'preview';

const COCINAS_OPTS = ['Italiana','Japonesa','Nikkei','Mediterránea','Colombiana','Francesa','Española','China','Peruana','Mexicana','Bar de pizzas','Cócteles','Sake','Vinos','Mariscos','Carnes','Vegetariana','Vegana','Fusión'];
const ETIQUETAS = ['Informal','Elegante','Informal y elegante','Smart casual','Fine dining','Casual','Brunch','Romántico','Familiar','Negocios'];
const PRECIOS = ['$','$$','$$$','$$$$'];
const DIAS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

const AMENIDADES = [
  { key:'acceso_silla_ruedas', label:'Acceso silla ruedas', icon:'♿' },
  { key:'asientos_barra',      label:'Asientos en barra',   icon:'🍸' },
  { key:'banos_unisex',        label:'Baños unisex',         icon:'🚻' },
  { key:'bar_completo',        label:'Bar completo',         icon:'🍺' },
  { key:'cargo_descorche',     label:'Cargo descorche',      icon:'🍾' },
  { key:'cocteles',            label:'Cócteles',             icon:'🍹' },
  { key:'terraza',             label:'Terraza',              icon:'🌿' },
  { key:'sin_gluten',          label:'Sin gluten',           icon:'🌾' },
  { key:'sala_fumar',          label:'Sala de fumar',        icon:'🚬' },
  { key:'vinos',               label:'Vinos',                icon:'🍷' },
  { key:'vista',               label:'Vista',                icon:'🌅' },
  { key:'wifi',                label:'WiFi',                  icon:'📶' },
  { key:'musica_en_vivo',      label:'Música en vivo',       icon:'🎵' },
];

const emptyRestaurante = () => ({
  nombre:'', slug:'', descripcion:'', descripcion_corta:'',
  plato_insignia:'', plato_insignia_desc:'',
  direccion:'', ciudad:'Bogotá', telefono:'', whatsapp:'', email:'', web:'', maps_url:'',
  cocinas:[] as string[], etiqueta:'Informal y elegante', precio_rango:'$$',
  horarios:{} as Record<string,any>,
  acceso_silla_ruedas:false, asientos_barra:false, banos_unisex:false, bar_completo:false,
  cargo_descorche:false, cocteles:false, terraza:false, sin_gluten:false,
  sala_fumar:false, vinos:false, vista:false, wifi:false, musica_en_vivo:false,
  estacionamiento:'', eventos_privados:'', instagram:'', facebook:'', tiktok:'',
  foto_portada:'', foto_logo:'', fotos:[] as string[],
  experiencias:[] as any[], concierge_texto:'', menu_url:'', menu_pdf:'',
  activo:true, destacado:false, reservas_activas:true,
  restaurante_id: 6,
});

export default function OhYeahAdminModule() {
  const [tab, setTab]           = useState<Tab>('general');
  const [restaurantes, setRest] = useState<any[]>([]);
  const [selected, setSel]      = useState<any | null>(null);
  const [form, setForm]         = useState<any>(emptyRestaurante());
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState('');
  const [showList, setShowList] = useState(true);
  // Horarios por día
  const [horarioDia, setHorarioDia] = useState<Record<string,{abre:string,cierra:string,cerrado:boolean}>>({});
  // Experiencias
  const [newExp, setNewExp]     = useState({ titulo:'', descripcion:'', emoji:'✨' });
  // Fotos input
  const [fotoUrl, setFotoUrl]   = useState('');
  const fileInputRef            = useRef<HTMLInputElement>(null);

  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''),3000); };
  const setF = (k:string, v:any) => setForm((p:any) => ({...p, [k]:v}));

  const fetchRest = async () => {
    const { data } = await supabase.from('ohyeah_restaurantes').select('*').order('created_at', { ascending:false });
    if (data) setRest(data);
  };

  useEffect(() => { fetchRest(); }, []);

  // Inicializar horarios al cargar restaurante
  useEffect(() => {
    if (form.horarios && typeof form.horarios === 'object') {
      const init: Record<string,any> = {};
      DIAS.forEach(d => {
        init[d] = form.horarios[d] || { abre:'12:00', cierra:'22:00', cerrado: false };
      });
      setHorarioDia(init);
    }
  }, [selected]);

  const generarSlug = (nombre:string) =>
    nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');

  const guardar = async () => {
    if (!form.nombre) { showToast('⚠️ Nombre requerido'); return; }
    setSaving(true);
    const slug = form.slug || generarSlug(form.nombre);
    const horarios = Object.fromEntries(Object.entries(horarioDia).map(([d,v])=>[d,v]));
    const payload = { ...form, slug, horarios, updated_at: new Date().toISOString() };

    if (selected?.id) {
      await supabase.from('ohyeah_restaurantes').update(payload).eq('id', selected.id);
      showToast('✓ Restaurante actualizado');
    } else {
      await supabase.from('ohyeah_restaurantes').insert(payload);
      showToast('✓ Restaurante creado');
    }
    setSaving(false);
    fetchRest();
    setShowList(true);
  };

  const abrirEditar = (r:any) => {
    setSel(r);
    setForm(r);
    setShowList(false);
    setTab('general');
  };

  const nuevoRestaurante = () => {
    setSel(null);
    setForm(emptyRestaurante());
    const init:Record<string,any> = {};
    DIAS.forEach(d => { init[d] = { abre:'12:00', cierra:'22:00', cerrado:false }; });
    setHorarioDia(init);
    setShowList(false);
    setTab('general');
  };

  const agregarFoto = () => {
    if (!fotoUrl.trim()) return;
    setF('fotos', [...(form.fotos||[]), fotoUrl.trim()]);
    setFotoUrl('');
  };

  const agregarExp = () => {
    if (!newExp.titulo) return;
    setF('experiencias', [...(form.experiencias||[]), { ...newExp, id: Date.now() }]);
    setNewExp({ titulo:'', descripcion:'', emoji:'✨' });
  };

  const toggleCocina = (c:string) => {
    const cur = form.cocinas || [];
    setF('cocinas', cur.includes(c) ? cur.filter((x:string)=>x!==c) : [...cur,c]);
  };

  const TABS: {id:Tab, label:string}[] = [
    {id:'general',      label:'📋 General'},
    {id:'fotos',        label:'📸 Fotos'},
    {id:'horarios',     label:'🕐 Horarios'},
    {id:'amenidades',   label:'✓ Amenidades'},
    {id:'experiencias', label:'✨ Experiencias'},
    {id:'menu',         label:'🍽️ Menú & Concierge'},
    {id:'preview',      label:'👁️ Preview'},
  ];

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>

      {/* Toast */}
      {toast && (
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'#1e1e2e',border:`1px solid ${S.pink}`,color:'#fff',padding:'10px 28px',borderRadius:50,fontSize:13,zIndex:9999,fontWeight:700}}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{padding:'16px 28px',borderBottom:`1px solid ${S.border}`,background:S.bg2,display:'flex',alignItems:'center',gap:16,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div style={{width:48,height:48,borderRadius:15,background:`linear-gradient(135deg,${S.yellow},${S.pink})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,boxShadow:`0 0 24px ${S.yellow}40`}}>
            🦉
          </div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,letterSpacing:'-0.02em'}}>
              OH YEAH <span style={{color:S.yellow}}>ADMIN</span>
            </div>
            <div style={{fontSize:10,color:S.t3,letterSpacing:'.12em',textTransform:'uppercase'}}>Gestión de restaurantes · Plataforma Oh Yeah</div>
          </div>
        </div>
        <div style={{flex:1}}/>
        {!showList && (
          <button onClick={()=>setShowList(true)}
            style={{padding:'8px 18px',borderRadius:10,border:`1px solid ${S.border2}`,background:'transparent',color:S.t2,cursor:'pointer',fontSize:12,fontWeight:700}}>
            ← Mis restaurantes
          </button>
        )}
        <button onClick={nuevoRestaurante}
          style={{padding:'9px 22px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.yellow},#e6a800)`,color:'#000',fontSize:12,fontWeight:900,cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
          + Nuevo restaurante
        </button>
      </div>

      {/* ══ LISTA DE RESTAURANTES ══ */}
      {showList && (
        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div style={{padding:'16px 28px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:12}}>
            <div style={{fontSize:13,color:S.t2}}><span style={{fontWeight:700,color:S.yellow}}>{restaurantes.length}</span> restaurantes registrados en Oh Yeah</div>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:28}}>
            {restaurantes.length === 0 && (
              <div style={{textAlign:'center',padding:80,color:S.t3}}>
                <div style={{fontSize:56,marginBottom:16}}>🦉</div>
                <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>Sin restaurantes aún</div>
                <div style={{fontSize:13}}>Crea el primer restaurante para Oh Yeah</div>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:16}}>
              {restaurantes.map((r:any) => (
                <div key={r.id} style={{background:S.bg2,border:`1px solid ${r.destacado?`${S.yellow}40`:S.border}`,borderRadius:18,overflow:'hidden',cursor:'pointer',transition:'all .2s'}}
                  onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor=S.yellow}
                  onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor=r.destacado?`${S.yellow}40`:S.border}>
                  {/* Cover */}
                  <div style={{height:140,background:r.foto_portada?`url(${r.foto_portada}) center/cover no-repeat`:`linear-gradient(135deg,#1e1e2e,${S.purple}30)`,position:'relative',display:'flex',alignItems:'flex-end',padding:14}}>
                    {r.destacado && (
                      <span style={{position:'absolute',top:10,right:10,background:S.yellow,color:'#000',fontSize:9,fontWeight:900,padding:'3px 10px',borderRadius:50}}>⭐ DESTACADO</span>
                    )}
                    {r.foto_logo && (
                      <img src={r.foto_logo} alt="" style={{width:48,height:48,borderRadius:12,border:'2px solid rgba(255,255,255,0.2)',objectFit:'cover',background:'#1e1e2e'}}/>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{padding:'14px 18px'}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                      <div>
                        <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>{r.nombre}</div>
                        <div style={{fontSize:11,color:S.t3,marginTop:2}}>📍 {r.ciudad} · {r.precio_rango} · {(r.cocinas||[]).slice(0,2).join(', ')}</div>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                        <div style={{fontSize:12,fontWeight:900,color:S.yellow}}>★ {r.score_ohyeah||'—'}</div>
                        <div style={{width:8,height:8,borderRadius:'50%',background:r.activo?S.green:S.red}}/>
                      </div>
                    </div>
                    {r.descripcion_corta && (
                      <div style={{fontSize:11,color:S.t3,marginTop:8,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                        {r.descripcion_corta}
                      </div>
                    )}
                    <div style={{display:'flex',gap:8,marginTop:12}}>
                      <button onClick={()=>abrirEditar(r)}
                        style={{flex:1,padding:'8px',borderRadius:10,border:`1px solid ${S.yellow}40`,background:`${S.yellow}10`,color:S.yellow,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                        ✏️ Editar
                      </button>
                      <button onClick={()=>{ setF('activo',!r.activo); supabase.from('ohyeah_restaurantes').update({activo:!r.activo}).eq('id',r.id).then(()=>{ fetchRest(); showToast(r.activo?'Restaurante pausado':'Restaurante activado'); }); }}
                        style={{padding:'8px 12px',borderRadius:10,border:`1px solid ${S.border}`,background:'transparent',color:r.activo?S.red:S.green,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                        {r.activo?'Pausar':'Activar'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ EDITOR ══ */}
      {!showList && (
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {/* Tabs */}
          <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,background:S.bg2,padding:'0 28px',flexShrink:0,overflowX:'auto',scrollbarWidth:'none'}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{padding:'12px 18px',background:'none',border:'none',borderBottom:`2px solid ${tab===t.id?S.yellow:'transparent'}`,color:tab===t.id?S.yellow:S.t3,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s'}}>
                {t.label}
              </button>
            ))}
            <div style={{flex:1}}/>
            <button onClick={guardar} disabled={saving}
              style={{margin:'8px 0 8px 16px',padding:'0 24px',borderRadius:10,border:'none',background:saving?'#333':`linear-gradient(135deg,${S.yellow},#e6a800)`,color:'#000',fontSize:12,fontWeight:900,cursor:'pointer',flexShrink:0}}>
              {saving?'Guardando...':'✓ Guardar'}
            </button>
          </div>

          <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>

            {/* ── GENERAL ── */}
            {tab==='general' && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,maxWidth:900}}>
                <div style={{gridColumn:'1/-1'}}>
                  <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:18,display:'flex',alignItems:'center',gap:16}}>
                    {form.foto_logo && <img src={form.foto_logo} alt="" style={{width:56,height:56,borderRadius:12,objectFit:'cover'}}/>}
                    <div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900}}>{form.nombre||'Nuevo restaurante'}</div>
                      <div style={{fontSize:12,color:S.t3}}>{form.ciudad} · {form.precio_rango} · {(form.cocinas||[]).join(', ')||'Sin cocinas'}</div>
                    </div>
                    <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
                      <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:form.activo?S.green:S.t3}}>
                        <input type="checkbox" checked={form.activo} onChange={e=>setF('activo',e.target.checked)} style={{cursor:'pointer'}}/>
                        Activo
                      </label>
                      <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:form.destacado?S.yellow:S.t3}}>
                        <input type="checkbox" checked={form.destacado} onChange={e=>setF('destacado',e.target.checked)} style={{cursor:'pointer'}}/>
                        ⭐ Destacado
                      </label>
                      <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:form.reservas_activas?S.blue:S.t3}}>
                        <input type="checkbox" checked={form.reservas_activas} onChange={e=>setF('reservas_activas',e.target.checked)} style={{cursor:'pointer'}}/>
                        Reservas activas
                      </label>
                    </div>
                  </div>
                </div>

                {/* Nombre */}
                <div>
                  <div style={label}>Nombre del restaurante *</div>
                  <input style={inp} value={form.nombre} onChange={e=>{setF('nombre',e.target.value); if(!selected) setF('slug',generarSlug(e.target.value));}} placeholder="Ej: OMM · Bogotá"/>
                </div>
                {/* Slug */}
                <div>
                  <div style={label}>Slug (URL Oh Yeah)</div>
                  <div style={{position:'relative'}}>
                    <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:12,color:S.t3}}>ohyeah.co/</span>
                    <input style={{...inp,paddingLeft:90}} value={form.slug} onChange={e=>setF('slug',generarSlug(e.target.value))} placeholder="omm-bogota"/>
                  </div>
                </div>
                {/* Descripción */}
                <div style={{gridColumn:'1/-1'}}>
                  <div style={label}>Descripción completa</div>
                  <textarea style={{...inp,height:90,resize:'vertical'}} value={form.descripcion} onChange={e=>setF('descripcion',e.target.value)} placeholder="Describe la experiencia del restaurante..."/>
                </div>
                <div style={{gridColumn:'1/-1'}}>
                  <div style={label}>Descripción corta (aparece en cards)</div>
                  <input style={inp} value={form.descripcion_corta} onChange={e=>setF('descripcion_corta',e.target.value)} placeholder="Japonés Nikkei · Robata · Bar"/>
                </div>
                {/* Plato insignia */}
                <div>
                  <div style={label}>🍽️ Plato insignia</div>
                  <input style={inp} value={form.plato_insignia} onChange={e=>setF('plato_insignia',e.target.value)} placeholder="Ton Katsu Don"/>
                </div>
                <div>
                  <div style={label}>Descripción del plato insignia</div>
                  <input style={inp} value={form.plato_insignia_desc} onChange={e=>setF('plato_insignia_desc',e.target.value)} placeholder="Lomo de cerdo empanizado, arroz con dashi..."/>
                </div>
                {/* Contacto */}
                <div><div style={label}>📍 Dirección</div><input style={inp} value={form.direccion} onChange={e=>setF('direccion',e.target.value)} placeholder="9A-13 Cra. 38, Bogotá"/></div>
                <div><div style={label}>Ciudad</div>
                  <select style={inp} value={form.ciudad} onChange={e=>setF('ciudad',e.target.value)}>
                    {['Bogotá','Medellín','Cali','Barranquilla','Cartagena','Santa Marta','Bucaramanga','Pereira'].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><div style={label}>📞 Teléfono</div><input style={inp} value={form.telefono} onChange={e=>setF('telefono',e.target.value)} placeholder="601 3594562"/></div>
                <div><div style={label}>💬 WhatsApp</div><input style={inp} value={form.whatsapp} onChange={e=>setF('whatsapp',e.target.value)} placeholder="+573233594562"/></div>
                <div><div style={label}>✉️ Email</div><input style={inp} value={form.email} onChange={e=>setF('email',e.target.value)} placeholder="reservas@omm.com.co"/></div>
                <div><div style={label}>🌐 Sitio web</div><input style={inp} value={form.web} onChange={e=>setF('web',e.target.value)} placeholder="www.omm.com.co"/></div>
                <div><div style={label}>📍 URL Google Maps</div><input style={inp} value={form.maps_url} onChange={e=>setF('maps_url',e.target.value)} placeholder="https://maps.google.com/..."/></div>
                <div><div style={label}>🎉 Eventos privados</div><input style={inp} value={form.eventos_privados} onChange={e=>setF('eventos_privados',e.target.value)} placeholder="+57 323 399 45 62"/></div>
                <div><div style={label}>🅿️ Estacionamiento</div><input style={inp} value={form.estacionamiento} onChange={e=>setF('estacionamiento',e.target.value)} placeholder="Vía pública / Parqueadero cercano"/></div>
                {/* Cocinas */}
                <div style={{gridColumn:'1/-1'}}>
                  <div style={label}>🍴 Tipos de cocina</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {COCINAS_OPTS.map(c=>{
                      const sel=(form.cocinas||[]).includes(c);
                      return <button key={c} onClick={()=>toggleCocina(c)} style={{padding:'5px 14px',borderRadius:50,border:`1px solid ${sel?S.yellow:S.border}`,background:sel?`${S.yellow}15`:'transparent',color:sel?S.yellow:S.t3,fontSize:12,cursor:'pointer',transition:'all .15s'}}>{c}</button>;
                    })}
                  </div>
                </div>
                {/* Etiqueta y precio */}
                <div>
                  <div style={label}>👔 Etiqueta</div>
                  <select style={inp} value={form.etiqueta} onChange={e=>setF('etiqueta',e.target.value)}>
                    {ETIQUETAS.map(e=><option key={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <div style={label}>💰 Rango de precio</div>
                  <div style={{display:'flex',gap:8}}>
                    {PRECIOS.map(p=>(
                      <button key={p} onClick={()=>setF('precio_rango',p)}
                        style={{flex:1,padding:'10px',borderRadius:10,border:`1px solid ${form.precio_rango===p?S.yellow:S.border}`,background:form.precio_rango===p?`${S.yellow}15`:'transparent',color:form.precio_rango===p?S.yellow:S.t3,fontSize:14,fontWeight:700,cursor:'pointer'}}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Redes */}
                <div><div style={label}>📸 Instagram</div><input style={inp} value={form.instagram} onChange={e=>setF('instagram',e.target.value)} placeholder="@ommbogota"/></div>
                <div><div style={label}>👍 Facebook</div><input style={inp} value={form.facebook} onChange={e=>setF('facebook',e.target.value)} placeholder="facebook.com/omm"/></div>
                <div><div style={label}>🎵 TikTok</div><input style={inp} value={form.tiktok} onChange={e=>setF('tiktok',e.target.value)} placeholder="@ommbogota"/></div>
              </div>
            )}

            {/* ── FOTOS ── */}
            {tab==='fotos' && (
              <div style={{maxWidth:900}}>
                {/* Logo */}
                <div style={{marginBottom:24}}>
                  <div style={label}>Logo del restaurante (URL)</div>
                  <div style={{display:'flex',gap:10,alignItems:'center'}}>
                    <input style={{...inp,flex:1}} value={form.foto_logo} onChange={e=>setF('foto_logo',e.target.value)} placeholder="https://...logo.png"/>
                    {form.foto_logo && <img src={form.foto_logo} alt="" style={{width:56,height:56,borderRadius:12,objectFit:'cover',border:`1px solid ${S.border}`}}/>}
                  </div>
                </div>
                {/* Portada */}
                <div style={{marginBottom:24}}>
                  <div style={label}>Foto de portada (URL)</div>
                  <input style={inp} value={form.foto_portada} onChange={e=>setF('foto_portada',e.target.value)} placeholder="https://...cover.jpg"/>
                  {form.foto_portada && (
                    <div style={{marginTop:12,height:180,borderRadius:14,overflow:'hidden',background:`url(${form.foto_portada}) center/cover no-repeat`}}/>
                  )}
                </div>
                {/* Galería */}
                <div>
                  <div style={label}>Galería de fotos</div>
                  <div style={{display:'flex',gap:10,marginBottom:12}}>
                    <input style={{...inp,flex:1}} value={fotoUrl} onChange={e=>setFotoUrl(e.target.value)} placeholder="https://...foto.jpg" onKeyDown={e=>e.key==='Enter'&&agregarFoto()}/>
                    <button onClick={agregarFoto} style={{padding:'0 20px',borderRadius:10,border:'none',background:S.yellow,color:'#000',fontWeight:700,cursor:'pointer',fontSize:13}}>+ Agregar</button>
                  </div>
                  <div style={{fontSize:11,color:S.t3,marginBottom:12}}>Puedes agregar hasta 20 fotos. Aparecerán en la galería de Oh Yeah.</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10}}>
                    {(form.fotos||[]).map((f:string,i:number)=>(
                      <div key={i} style={{position:'relative',borderRadius:12,overflow:'hidden',aspectRatio:'1',background:`url(${f}) center/cover no-repeat`,border:`1px solid ${S.border}`}}>
                        <button onClick={()=>setF('fotos',(form.fotos||[]).filter((_:any,j:number)=>j!==i))}
                          style={{position:'absolute',top:6,right:6,width:24,height:24,borderRadius:'50%',border:'none',background:'rgba(0,0,0,0.7)',color:'#fff',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center'}}>
                          ✕
                        </button>
                        <div style={{position:'absolute',bottom:6,left:6,fontSize:9,color:'rgba(255,255,255,0.6)'}}>#{i+1}</div>
                      </div>
                    ))}
                    {/* Placeholder vacío */}
                    {(form.fotos||[]).length === 0 && (
                      <div style={{gridColumn:'1/-1',textAlign:'center',padding:40,color:S.t3,border:`2px dashed ${S.border}`,borderRadius:14}}>
                        <div style={{fontSize:32,marginBottom:8}}>📸</div>
                        <div style={{fontSize:13}}>Agrega URLs de fotos del restaurante</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── HORARIOS ── */}
            {tab==='horarios' && (
              <div style={{maxWidth:600}}>
                <div style={{fontSize:13,color:S.t2,marginBottom:20}}>Configura el horario de atención de cada día de la semana.</div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {DIAS.map(dia=>{
                    const h = horarioDia[dia] || {abre:'12:00',cierra:'22:00',cerrado:false};
                    return (
                      <div key={dia} style={{background:S.bg2,border:`1px solid ${h.cerrado?S.border:`${S.yellow}20`}`,borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',gap:14}}>
                        <div style={{width:90,fontSize:13,fontWeight:700,color:h.cerrado?S.t3:S.t1}}>{dia}</div>
                        {!h.cerrado ? (
                          <>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <input type="time" value={h.abre}
                                onChange={e=>setHorarioDia(p=>({...p,[dia]:{...h,abre:e.target.value}}))}
                                style={{...inp,width:110,padding:'7px 10px',fontSize:13}}/>
                              <span style={{color:S.t3}}>—</span>
                              <input type="time" value={h.cierra}
                                onChange={e=>setHorarioDia(p=>({...p,[dia]:{...h,cierra:e.target.value}}))}
                                style={{...inp,width:110,padding:'7px 10px',fontSize:13}}/>
                            </div>
                          </>
                        ) : (
                          <div style={{fontSize:12,color:S.t3,fontStyle:'italic'}}>Cerrado</div>
                        )}
                        <div style={{marginLeft:'auto'}}>
                          <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:11,color:h.cerrado?S.red:S.t3}}>
                            <input type="checkbox" checked={h.cerrado}
                              onChange={e=>setHorarioDia(p=>({...p,[dia]:{...h,cerrado:e.target.checked}}))}
                              style={{cursor:'pointer'}}/>
                            Cerrado
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── AMENIDADES ── */}
            {tab==='amenidades' && (
              <div style={{maxWidth:700}}>
                <div style={{fontSize:13,color:S.t2,marginBottom:20}}>Selecciona los servicios y características disponibles en el restaurante.</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
                  {AMENIDADES.map(a=>{
                    const on = !!form[a.key];
                    return (
                      <button key={a.key} onClick={()=>setF(a.key,!on)}
                        style={{padding:'14px 16px',borderRadius:12,border:`1px solid ${on?S.yellow:S.border}`,background:on?`${S.yellow}10`:'transparent',color:on?S.yellow:S.t2,cursor:'pointer',display:'flex',alignItems:'center',gap:10,transition:'all .15s',textAlign:'left'}}>
                        <span style={{fontSize:20}}>{a.icon}</span>
                        <div>
                          <div style={{fontSize:12,fontWeight:700}}>{a.label}</div>
                          <div style={{fontSize:10,color:on?`${S.yellow}90`:S.t3}}>{on?'Disponible':'No disponible'}</div>
                        </div>
                        <div style={{marginLeft:'auto',width:18,height:18,borderRadius:'50%',background:on?S.yellow:'transparent',border:`2px solid ${on?S.yellow:S.t3}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#000',fontWeight:900}}>
                          {on?'✓':''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── EXPERIENCIAS ── */}
            {tab==='experiencias' && (
              <div style={{maxWidth:800}}>
                <div style={{fontSize:13,color:S.t2,marginBottom:20}}>Las experiencias son tabs que aparecen en el perfil del restaurante en Oh Yeah (Resumen, Concierge, Menú, etc).</div>
                {/* Agregar experiencia */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16,marginBottom:20}}>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>+ Nueva experiencia</div>
                  <div style={{display:'grid',gridTemplateColumns:'60px 1fr 1fr',gap:10}}>
                    <div>
                      <div style={label}>Emoji</div>
                      <input style={inp} value={newExp.emoji} onChange={e=>setNewExp(p=>({...p,emoji:e.target.value}))} maxLength={2}/>
                    </div>
                    <div>
                      <div style={label}>Título</div>
                      <input style={inp} value={newExp.titulo} onChange={e=>setNewExp(p=>({...p,titulo:e.target.value}))} placeholder="Ej: RESUMEN, CONCIERGE, MENÚ"/>
                    </div>
                    <div>
                      <div style={label}>Descripción</div>
                      <input style={inp} value={newExp.descripcion} onChange={e=>setNewExp(p=>({...p,descripcion:e.target.value}))} placeholder="Breve descripción..."/>
                    </div>
                  </div>
                  <button onClick={agregarExp} style={{marginTop:10,padding:'8px 20px',borderRadius:10,border:'none',background:S.yellow,color:'#000',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                    Agregar experiencia
                  </button>
                </div>
                {/* Lista */}
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {(form.experiencias||[]).map((exp:any,i:number)=>(
                    <div key={exp.id||i} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
                      <span style={{fontSize:24}}>{exp.emoji}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:700}}>{exp.titulo}</div>
                        {exp.descripcion && <div style={{fontSize:11,color:S.t3}}>{exp.descripcion}</div>}
                      </div>
                      <button onClick={()=>setF('experiencias',(form.experiencias||[]).filter((_:any,j:number)=>j!==i))}
                        style={{background:'none',border:'none',color:S.t3,cursor:'pointer',fontSize:16,padding:'0 4px'}}>✕</button>
                    </div>
                  ))}
                  {(form.experiencias||[]).length === 0 && (
                    <div style={{textAlign:'center',padding:32,color:S.t3,border:`2px dashed ${S.border}`,borderRadius:14}}>
                      Sin experiencias — agrega tabs para tu perfil en Oh Yeah
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── MENÚ & CONCIERGE ── */}
            {tab==='menu' && (
              <div style={{maxWidth:700,display:'flex',flexDirection:'column',gap:16}}>
                <div>
                  <div style={label}>URL del menú (PDF o página web)</div>
                  <input style={inp} value={form.menu_url} onChange={e=>setF('menu_url',e.target.value)} placeholder="https://...menu.pdf o www.restaurante.com/menu"/>
                </div>
                <div>
                  <div style={label}>✨ Texto del Concierge</div>
                  <div style={{fontSize:11,color:S.t3,marginBottom:8}}>Este texto aparece en la sección CONCIERGE del perfil. Recomendaciones, historia del restaurante, destacados del chef, etc.</div>
                  <textarea style={{...inp,height:180,resize:'vertical'}} value={form.concierge_texto}
                    onChange={e=>setF('concierge_texto',e.target.value)}
                    placeholder="Experimente nuestra propuesta única de cocina nikkei. El chef recomienda comenzar con el Ceviche Nikkei y terminar con el Cheesecake de Matcha..."/>
                </div>
              </div>
            )}

            {/* ── PREVIEW ── */}
            {tab==='preview' && (
              <div style={{maxWidth:480,margin:'0 auto'}}>
                <div style={{fontSize:11,color:S.t3,marginBottom:12,textAlign:'center'}}>Vista previa de cómo se verá el perfil en Oh Yeah</div>
                {/* Portada */}
                <div style={{height:200,borderRadius:18,overflow:'hidden',background:form.foto_portada?`url(${form.foto_portada}) center/cover no-repeat`:`linear-gradient(135deg,#1e1e2e,${S.purple}30)`,position:'relative',marginBottom:-40}}>
                  <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.7))'}}/>
                  {form.destacado && <div style={{position:'absolute',top:12,right:12,background:S.yellow,color:'#000',fontSize:9,fontWeight:900,padding:'4px 12px',borderRadius:50}}>⭐ DESTACADO OH YEAH</div>}
                </div>
                <div style={{background:S.bg2,borderRadius:18,padding:'50px 20px 20px',border:`1px solid ${S.border}`,position:'relative'}}>
                  {form.foto_logo && (
                    <img src={form.foto_logo} alt="" style={{position:'absolute',top:-30,left:20,width:60,height:60,borderRadius:14,objectFit:'cover',border:`2px solid ${S.border}`}}/>
                  )}
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,marginBottom:4}}>{form.nombre||'Nombre del restaurante'}</div>
                  <div style={{fontSize:12,color:S.t3,marginBottom:8}}>{(form.cocinas||[]).join(' · ')||'Tipos de cocina'}</div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
                    <span style={{fontSize:11,background:`${S.yellow}15`,color:S.yellow,padding:'3px 10px',borderRadius:50}}>{form.etiqueta||'Etiqueta'}</span>
                    <span style={{fontSize:11,background:`${S.blue}15`,color:S.blue,padding:'3px 10px',borderRadius:50}}>{form.precio_rango}</span>
                    {form.reservas_activas && <span style={{fontSize:11,background:`${S.green}15`,color:S.green,padding:'3px 10px',borderRadius:50}}>✓ Reservas</span>}
                  </div>
                  {form.descripcion_corta && <div style={{fontSize:12,color:S.t2,marginBottom:12,lineHeight:1.6}}>{form.descripcion_corta}</div>}
                  {/* Tabs preview */}
                  <div style={{display:'flex',gap:4,overflowX:'auto',marginBottom:12,scrollbarWidth:'none'}}>
                    {['RESUMEN','EXPERIENCIAS','CONCIERGE','MENÚ'].map((t,i)=>(
                      <div key={t} style={{padding:'6px 12px',borderRadius:50,background:i===0?S.yellow:'transparent',border:`1px solid ${i===0?S.yellow:S.border}`,color:i===0?'#000':S.t3,fontSize:10,fontWeight:700,whiteSpace:'nowrap',cursor:'pointer'}}>
                        {t}
                      </div>
                    ))}
                  </div>
                  {/* Detalles */}
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {[
                      {icon:'📍',label:'Ubicación',val:form.direccion},
                      {icon:'🍽️',label:'Cocinas',val:(form.cocinas||[]).join(', ')},
                      {icon:'📞',label:'Teléfono',val:form.telefono},
                      {icon:'👔',label:'Etiqueta',val:form.etiqueta},
                      {icon:'🅿️',label:'Estacionamiento',val:form.estacionamiento},
                    ].filter(d=>d.val).map(d=>(
                      <div key={d.label} style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                        <span style={{fontSize:14,flexShrink:0}}>{d.icon}</span>
                        <div>
                          <div style={{fontSize:10,color:S.t3,fontWeight:700}}>{d.label}</div>
                          <div style={{fontSize:12,color:S.t2}}>{d.val}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Amenidades activas */}
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:14}}>
                    {AMENIDADES.filter(a=>form[a.key]).map(a=>(
                      <span key={a.key} style={{fontSize:10,color:S.t2,background:S.bg3,padding:'3px 10px',borderRadius:50}}>✓ {a.label}</span>
                    ))}
                  </div>
                  {/* Galería */}
                  {(form.fotos||[]).length>0 && (
                    <div style={{marginTop:14}}>
                      <div style={{fontSize:11,color:S.t3,marginBottom:8}}>+{form.fotos.length} fotos</div>
                      <div style={{display:'flex',gap:6,overflowX:'auto',scrollbarWidth:'none'}}>
                        {form.fotos.slice(0,5).map((f:string,i:number)=>(
                          <img key={i} src={f} alt="" style={{width:70,height:70,borderRadius:10,objectFit:'cover',flexShrink:0}}/>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
