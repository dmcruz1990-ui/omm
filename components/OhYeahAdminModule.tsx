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

type Tab = 'general' | 'fotos' | 'horarios' | 'amenidades' | 'experiencias' | 'menu' | 'top_platos' | 'eventos' | 'gourmand' | 'preview';
type Vista = 'lista' | 'solicitudes' | 'editor';

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
  const [vista, setVista]       = useState<Vista>('solicitudes');
  const [solicitudes, setSolic] = useState<any[]>([]);
  const [solicSel, setSolicSel] = useState<any|null>(null);
  const [uploading, setUploading] = useState(false);
  const [analizando, setAnal]   = useState(false);
  const [analisisIA, setAnalIA] = useState<any>(null);
  const [toast, setToast]       = useState('');
  // Datos de las pestañas nuevas (Top platos, Eventos, Gourmand Society)
  const [topPlatos, setTopPlatos] = useState<any[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);
  const [gourmand, setGourmand] = useState<any[]>([]);
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

  const fetchSolicitudes = async () => {
    const { data } = await supabase.from('ohyeah_solicitudes')
      .select('*').order('created_at', { ascending: false });
    if (data) setSolic(data);
  };

  const fetchRest = async () => {
    const { data } = await supabase.from('ohyeah_restaurantes').select('*').order('created_at', { ascending:false });
    if (data) setRest(data);
  };

  useEffect(() => { fetchRest(); fetchSolicitudes(); }, []);

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

  // ── Subir foto a Supabase Storage ─────────────────────────────────────
  const subirFoto = async (file: File, contexto: 'solicitud'|'restaurante', id: number): Promise<string|null> => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${contexto}/${id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('ohyeah-fotos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('ohyeah-fotos').getPublicUrl(path);
      return publicUrl;
    } catch(e) {
      showToast('Error al subir imagen');
      return null;
    } finally { setUploading(false); }
  };

  const handleFileUpload = async (files: FileList, tipo: 'portada'|'logo'|'galeria') => {
    if (!solicSel?.id) return;
    const file = files[0];
    if (!file) return;
    const url = await subirFoto(file, 'solicitud', solicSel.id);
    if (!url) return;
    if (tipo === 'portada') {
      await supabase.from('ohyeah_solicitudes').update({ foto_portada: url }).eq('id', solicSel.id);
      setSolicSel((p:any) => ({...p, foto_portada: url}));
    } else if (tipo === 'logo') {
      await supabase.from('ohyeah_solicitudes').update({ foto_logo: url }).eq('id', solicSel.id);
      setSolicSel((p:any) => ({...p, foto_logo: url}));
    } else {
      const fotos = [...(solicSel.fotos_storage||[]), url];
      await supabase.from('ohyeah_solicitudes').update({ fotos_storage: fotos }).eq('id', solicSel.id);
      setSolicSel((p:any) => ({...p, fotos_storage: fotos}));
    }
    showToast('✓ Foto subida correctamente');
  };

  // ── Analizar foto con Claude IA ─────────────────────────────────────────
  const analizarConIA = async (imageUrl: string) => {
    setAnal(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "url", url: imageUrl } },
              { type: "text", text: `Analiza esta foto de restaurante y devuelve SOLO un JSON con:
{
  "tipo": "portada|interior|plato|bar|terraza|logo|fachada",
  "calidad": 1-10,
  "descripcion": "descripción breve de la imagen",
  "uso_sugerido": "portada|galeria|logo|menu",
  "colores_principales": ["#hex1","#hex2","#hex3"],
  "ambiente": "romántico|casual|elegante|familiar|moderno|rustico",
  "observaciones": "notas para el equipo Oh Yeah",
  "apta_plataforma": true|false,
  "razon_no_apta": "solo si no es apta"
}
No incluyas texto adicional, solo el JSON.` }
            ]
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || '{}';
      const clean = text.replace(/\`\`\`json|\`\`\`/g,'').trim();
      const resultado = JSON.parse(clean);
      setAnalIA(resultado);
      showToast('✓ Análisis IA completado');
      return resultado;
    } catch(e) {
      showToast('Error en análisis IA');
      return null;
    } finally { setAnal(false); }
  };

  // ── Aprobar solicitud → crea restaurante automáticamente ───────────────
  const aprobarSolicitud = async (sol: any) => {
    await supabase.from('ohyeah_solicitudes')
      .update({ estado: 'aprobado', aprobado_por: 'Admin Nexum', aprobado_en: new Date().toISOString() })
      .eq('id', sol.id);
    showToast('✓ Restaurante aprobado y publicado en Oh Yeah');
    fetchSolicitudes(); fetchRest();
    setSolicSel(null);
  };

  const rechazarSolicitud = async (id: number, nota: string) => {
    await supabase.from('ohyeah_solicitudes')
      .update({ estado: 'rechazado', notas_admin: nota })
      .eq('id', id);
    showToast('Solicitud rechazada');
    fetchSolicitudes();
    setSolicSel(null);
  };

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

  const cargarExtras = async (restauranteId:number) => {
    const [tp, ev, gs] = await Promise.all([
      supabase.from('ohyeah_top_platos').select('*').eq('restaurante_id', restauranteId).order('posicion'),
      supabase.from('ohyeah_eventos').select('*').eq('restaurante_id', restauranteId).order('fecha', { ascending:false }),
      supabase.from('ohyeah_gourmand_regalos').select('*').eq('restaurante_id', restauranteId).order('nivel'),
    ]);
    setTopPlatos(tp.data || []);
    setEventos(ev.data || []);
    setGourmand(gs.data || []);
  };

  const abrirEditar = (r:any) => {
    setSel(r);
    setForm(r);
    setShowList(false);
    setTab('general');
    if (r?.id) cargarExtras(r.id);
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
    {id:'top_platos',   label:'🌟 Top 10 Platos'},
    {id:'eventos',      label:'🎉 Eventos'},
    {id:'gourmand',     label:'👑 Gourmand Society'},
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
        {/* Vista tabs */}
        <div style={{display:'flex',gap:4,background:'rgba(255,255,255,0.05)',padding:4,borderRadius:10}}>
          {[
            {id:'solicitudes',label:'📥 Solicitudes',badge:(solicitudes.filter((s:any)=>s.estado==='pendiente'||s.estado==='en_revision').length)},
            {id:'lista',label:'🏪 Restaurantes',badge:0},
          ].map((v:any)=>(
            <button key={v.id} onClick={()=>{setVista(v.id as Vista);setShowList(true);setSolicSel(null);}}
              style={{padding:'7px 16px',borderRadius:8,border:'none',background:vista===v.id?S.yellow:'transparent',color:vista===v.id?'#000':S.t3,fontSize:11,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
              {v.label}
              {v.badge>0 && <span style={{background:vista===v.id?'#000':S.pink,color:'#fff',borderRadius:50,padding:'1px 7px',fontSize:9,fontWeight:900}}>{v.badge}</span>}
            </button>
          ))}
        </div>
        {!showList && (
          <button onClick={()=>{setShowList(true);setSolicSel(null);}}
            style={{padding:'8px 18px',borderRadius:10,border:`1px solid ${S.border2}`,background:'transparent',color:S.t2,cursor:'pointer',fontSize:12,fontWeight:700}}>
            ← Volver
          </button>
        )}
        <button onClick={nuevoRestaurante}
          style={{padding:'9px 22px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.yellow},#e6a800)`,color:'#000',fontSize:12,fontWeight:900,cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
          + Nuevo restaurante
        </button>
      </div>

      {/* ══ VISTA SOLICITUDES ══ */}
      {showList && vista==='solicitudes' && !solicSel && (
        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div style={{padding:'14px 28px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
            <div style={{fontSize:13,color:S.t2}}>
              <span style={{fontWeight:700,color:S.pink}}>{solicitudes.filter((s:any)=>s.estado==='pendiente').length}</span> pendientes ·
              <span style={{fontWeight:700,color:S.green,marginLeft:8}}>{solicitudes.filter((s:any)=>s.estado==='aprobado').length}</span> aprobadas ·
              <span style={{fontWeight:700,color:S.t3,marginLeft:8}}>{solicitudes.filter((s:any)=>s.estado==='rechazado').length}</span> rechazadas
            </div>
            <button onClick={fetchSolicitudes} style={{marginLeft:'auto',padding:'6px 14px',borderRadius:8,border:`1px solid ${S.border}`,background:'transparent',color:S.t3,fontSize:11,cursor:'pointer'}}>↻ Actualizar</button>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:28}}>
            {solicitudes.length===0 && (
              <div style={{textAlign:'center',padding:60,color:S.t3}}>
                <div style={{fontSize:48,marginBottom:12}}>📥</div>
                <div style={{fontSize:15,fontWeight:700}}>Sin solicitudes aún</div>
              </div>
            )}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {solicitudes.map((sol:any)=>{
                const estadoColor = sol.estado==='aprobado'?S.green:sol.estado==='rechazado'?S.red:sol.estado==='en_revision'?S.blue:S.yellow;
                const estadoLabel = sol.estado==='aprobado'?'✓ Aprobado':sol.estado==='rechazado'?'✗ Rechazado':sol.estado==='en_revision'?'👁 En revisión':'⏳ Pendiente';
                return (
                  <div key={sol.id} style={{background:S.bg2,border:`1px solid ${sol.estado==='pendiente'?`${S.yellow}30`:S.border}`,borderRadius:16,overflow:'hidden',cursor:'pointer',transition:'all .2s'}}
                    onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor=S.yellow}
                    onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor=sol.estado==='pendiente'?`${S.yellow}30`:S.border}>
                    <div style={{display:'flex',alignItems:'stretch'}}>
                      {/* Portada mini */}
                      <div style={{width:100,background:sol.foto_portada?`url(${sol.foto_portada}) center/cover`:S.bg3,flexShrink:0}}/>
                      {/* Info */}
                      <div style={{flex:1,padding:'14px 18px'}}>
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:8}}>
                          <div>
                            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>{sol.nombre}</div>
                            <div style={{fontSize:11,color:S.t3}}>📍 {sol.ciudad} · {sol.precio_rango} · {(sol.cocinas||[]).slice(0,2).join(', ')}</div>
                          </div>
                          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
                            <span style={{fontSize:10,background:`${estadoColor}20`,color:estadoColor,border:`1px solid ${estadoColor}30`,padding:'3px 10px',borderRadius:50,fontWeight:700,whiteSpace:'nowrap'}}>{estadoLabel}</span>
                            <div style={{fontSize:10,color:S.t3}}>{new Date(sol.created_at).toLocaleDateString('es-CO')}</div>
                          </div>
                        </div>
                        {sol.descripcion_corta && <div style={{fontSize:11,color:S.t2,marginBottom:10}}>{sol.descripcion_corta}</div>}
                        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                          <span style={{fontSize:10,color:S.t3}}>👤 {sol.nombre_contacto} · {sol.email_contacto}</span>
                          {sol.fotos_storage?.length>0 && <span style={{fontSize:10,color:S.blue}}>📸 {sol.fotos_storage.length} fotos subidas</span>}
                        </div>
                      </div>
                      {/* Acciones */}
                      <div style={{padding:'14px',display:'flex',flexDirection:'column',gap:8,justifyContent:'center',borderLeft:`1px solid ${S.border}`}}>
                        <button onClick={(e)=>{e.stopPropagation();setSolicSel(sol);setShowList(false);}}
                          style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${S.yellow}40`,background:`${S.yellow}10`,color:S.yellow,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                          ✏️ Gestionar
                        </button>
                        {sol.estado==='pendiente'&&(
                          <button onClick={(e)=>{e.stopPropagation();aprobarSolicitud(sol);}}
                            style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${S.green}40`,background:`${S.green}10`,color:S.green,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                            ✓ Aprobar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ DETALLE SOLICITUD ══ */}
      {!showList && solicSel && (
        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div style={{padding:'12px 28px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:12,flexShrink:0,background:S.bg2}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>{solicSel.nombre}</div>
            <span style={{fontSize:10,color:S.yellow,background:`${S.yellow}15`,padding:'2px 10px',borderRadius:50}}>Solicitud #{solicSel.id}</span>
            <div style={{marginLeft:'auto',display:'flex',gap:8}}>
              {solicSel.estado==='pendiente'&&(
                <>
                  <button onClick={()=>rechazarSolicitud(solicSel.id,'No cumple requisitos mínimos')}
                    style={{padding:'7px 16px',borderRadius:8,border:`1px solid ${S.red}40`,background:'transparent',color:S.red,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                    ✗ Rechazar
                  </button>
                  <button onClick={()=>aprobarSolicitud(solicSel)}
                    style={{padding:'7px 20px',borderRadius:8,border:'none',background:S.green,color:'#000',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                    ✓ Aprobar y publicar
                  </button>
                </>
              )}
              {solicSel.estado==='aprobado'&&<span style={{fontSize:12,color:S.green,fontWeight:700}}>✓ Publicado en Oh Yeah</span>}
            </div>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:24}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,maxWidth:900}}>

              {/* Datos del restaurante */}
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,marginBottom:12,color:S.yellow}}>📋 Datos del restaurante</div>
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:12,padding:16,display:'flex',flexDirection:'column',gap:8}}>
                  {[
                    {l:'Nombre',v:solicSel.nombre},
                    {l:'Ciudad',v:solicSel.ciudad},
                    {l:'Dirección',v:solicSel.direccion},
                    {l:'Cocinas',v:(solicSel.cocinas||[]).join(', ')},
                    {l:'Etiqueta',v:solicSel.etiqueta},
                    {l:'Precio',v:solicSel.precio_rango},
                    {l:'Web',v:solicSel.web},
                    {l:'Instagram',v:solicSel.instagram},
                  ].filter(x=>x.v).map(x=>(
                    <div key={x.l} style={{display:'flex',gap:10}}>
                      <span style={{fontSize:10,color:S.t3,minWidth:70,fontWeight:700,textTransform:'uppercase'}}>{x.l}</span>
                      <span style={{fontSize:12,color:S.t1,wordBreak:'break-word'}}>{x.v}</span>
                    </div>
                  ))}
                </div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,margin:'16px 0 12px',color:S.yellow}}>👤 Contacto</div>
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:12,padding:16,display:'flex',flexDirection:'column',gap:6}}>
                  {[
                    {l:'Nombre',v:solicSel.nombre_contacto},
                    {l:'Cargo',v:solicSel.cargo_contacto},
                    {l:'Email',v:solicSel.email_contacto},
                    {l:'Teléfono',v:solicSel.telefono},
                  ].map(x=>(
                    <div key={x.l} style={{display:'flex',gap:10}}>
                      <span style={{fontSize:10,color:S.t3,minWidth:70,fontWeight:700,textTransform:'uppercase'}}>{x.l}</span>
                      <span style={{fontSize:12,color:S.t1}}>{x.v||'—'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gestión de fotos */}
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,marginBottom:12,color:S.yellow}}>📸 Fotos</div>

                {/* Portada */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:S.t3,fontWeight:700,marginBottom:6}}>PORTADA</div>
                  <div style={{height:120,borderRadius:10,background:solicSel.foto_portada?`url(${solicSel.foto_portada}) center/cover`:S.bg3,border:`2px dashed ${S.border}`,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',marginBottom:6}}>
                    {!solicSel.foto_portada && <span style={{fontSize:11,color:S.t3}}>Sin portada</span>}
                  </div>
                  <label style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:S.bg3,border:`1px solid ${S.border}`,borderRadius:8,cursor:'pointer',fontSize:12,color:S.t2}}>
                    {uploading?'⏳ Subiendo...':'📤 Subir portada'}
                    <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files&&handleFileUpload(e.target.files,'portada')}/>
                  </label>
                </div>

                {/* Logo */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:S.t3,fontWeight:700,marginBottom:6}}>LOGO</div>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                    {solicSel.foto_logo
                      ? <img src={solicSel.foto_logo} alt="" style={{width:56,height:56,borderRadius:10,objectFit:'cover'}}/>
                      : <div style={{width:56,height:56,borderRadius:10,background:S.bg3,border:`2px dashed ${S.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:S.t3}}>Logo</div>
                    }
                    <label style={{flex:1,display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:S.bg3,border:`1px solid ${S.border}`,borderRadius:8,cursor:'pointer',fontSize:12,color:S.t2}}>
                      📤 Subir logo
                      <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files&&handleFileUpload(e.target.files,'logo')}/>
                    </label>
                  </div>
                </div>

                {/* Galería */}
                <div>
                  <div style={{fontSize:11,color:S.t3,fontWeight:700,marginBottom:6}}>GALERÍA ({(solicSel.fotos_storage||[]).length} fotos)</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:8}}>
                    {(solicSel.fotos_storage||[]).map((f:string,i:number)=>(
                      <div key={i} style={{position:'relative',borderRadius:8,overflow:'hidden',aspectRatio:'1',background:`url(${f}) center/cover`,border:`1px solid ${S.border}`}}>
                        {/* Botón analizar IA */}
                        <button onClick={()=>analizarConIA(f)}
                          style={{position:'absolute',bottom:4,right:4,padding:'3px 8px',borderRadius:6,border:'none',background:'rgba(0,0,0,0.8)',color:S.yellow,fontSize:9,fontWeight:700,cursor:'pointer'}}>
                          ✦IA
                        </button>
                      </div>
                    ))}
                    {/* Drop zone */}
                    <label style={{aspectRatio:'1',borderRadius:8,border:`2px dashed ${S.border}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:20,color:S.t3}}>
                      +
                      <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>{
                        if(e.target.files) Array.from(e.target.files).forEach(f=>handleFileUpload(e.target.files!,'galeria'));
                      }}/>
                    </label>
                  </div>
                </div>

                {/* Resultado análisis IA */}
                {analizando && (
                  <div style={{background:`${S.yellow}10`,border:`1px solid ${S.yellow}30`,borderRadius:10,padding:12,textAlign:'center'}}>
                    <div style={{fontSize:12,color:S.yellow}}>✦ Analizando imagen con Claude IA...</div>
                  </div>
                )}
                {analisisIA && !analizando && (
                  <div style={{background:`${S.purple}10`,border:`1px solid ${S.purple}30`,borderRadius:10,padding:12}}>
                    <div style={{fontSize:11,color:S.purple,fontWeight:700,marginBottom:8}}>✦ Análisis IA</div>
                    <div style={{display:'flex',flexDirection:'column',gap:5}}>
                      {[
                        {l:'Tipo',v:analisisIA.tipo},
                        {l:'Calidad',v:`${analisisIA.calidad}/10`},
                        {l:'Uso sugerido',v:analisisIA.uso_sugerido},
                        {l:'Ambiente',v:analisisIA.ambiente},
                        {l:'Descripción',v:analisisIA.descripcion},
                        {l:'Apta plataforma',v:analisisIA.apta_plataforma?'✓ Sí':'✗ No'},
                      ].map(x=>(
                        <div key={x.l} style={{display:'flex',gap:8}}>
                          <span style={{fontSize:9,color:S.t3,minWidth:90,fontWeight:700,textTransform:'uppercase'}}>{x.l}</span>
                          <span style={{fontSize:11,color:analisisIA.apta_plataforma===false&&x.l==='Apta plataforma'?S.red:S.t1}}>{x.v}</span>
                        </div>
                      ))}
                      {analisisIA.observaciones && (
                        <div style={{fontSize:11,color:S.t2,marginTop:4,padding:'8px',background:'rgba(255,255,255,0.04)',borderRadius:6}}>{analisisIA.observaciones}</div>
                      )}
                    </div>
                    <button onClick={()=>setAnalIA(null)} style={{marginTop:8,background:'none',border:'none',color:S.t3,fontSize:11,cursor:'pointer'}}>Cerrar análisis ×</button>
                  </div>
                )}

                {/* Descripción del restaurante */}
                {solicSel.descripcion && (
                  <div style={{marginTop:14,background:S.bg2,border:`1px solid ${S.border}`,borderRadius:12,padding:14}}>
                    <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:6}}>DESCRIPCIÓN</div>
                    <div style={{fontSize:12,color:S.t2,lineHeight:1.6}}>{solicSel.descripcion}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ LISTA DE RESTAURANTES ══ */}
      {showList && vista==='lista' && (
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

            {/* ── TOP 10 PLATOS ── */}
            {tab==='top_platos' && (
              <TopPlatosEditor
                restauranteId={selected?.id}
                topPlatos={topPlatos}
                onChange={(p:any[]) => setTopPlatos(p)}
                showToast={showToast}
              />
            )}

            {/* ── EVENTOS ── */}
            {tab==='eventos' && (
              <EventosEditor
                restauranteId={selected?.id}
                eventos={eventos}
                onChange={(p:any[]) => setEventos(p)}
                showToast={showToast}
              />
            )}

            {/* ── GOURMAND SOCIETY ── */}
            {tab==='gourmand' && (
              <GourmandEditor
                restauranteId={selected?.id}
                regalos={gourmand}
                onChange={(p:any[]) => setGourmand(p)}
                showToast={showToast}
              />
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

// ═══════════════════════════════════════════════════════════════════════
// SUB-EDITORES: Top Platos / Eventos / Gourmand Society
// ═══════════════════════════════════════════════════════════════════════

// Helper para subir foto a Storage y devolver URL pública
async function subirFotoOhYeah(file: File, prefix: string, restauranteId: number): Promise<string|null> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${prefix}/${restauranteId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from('ohyeah-fotos').upload(path, file, { upsert:false, contentType: file.type });
  if (upErr) return null;
  const { data: pub } = supabase.storage.from('ohyeah-fotos').getPublicUrl(path);
  return pub?.publicUrl || null;
}

// ── TOP 10 PLATOS ──────────────────────────────────────────────────────
function TopPlatosEditor({ restauranteId, topPlatos, onChange, showToast }: any) {
  const [editing, setEditing] = useState<number|null>(null);
  const [form, setForm] = useState<any>({});
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!restauranteId) return <div style={{padding:40,textAlign:'center',color:'#50506A'}}>Selecciona un restaurante de la lista</div>;

  const abrirSlot = (pos: number) => {
    const existente = topPlatos.find((p:any) => p.posicion === pos);
    setEditing(pos);
    setForm(existente || { posicion: pos, restaurante_id: restauranteId, nombre: '', descripcion: '', precio: 0, emoji: '🍽️' });
  };
  const guardar = async () => {
    if (!form.nombre) { showToast('⚠ Nombre requerido'); return; }
    setSubiendo(true);
    let payload = { ...form, restaurante_id: restauranteId, updated_at: new Date().toISOString() };
    if (payload.id) {
      await supabase.from('ohyeah_top_platos').update(payload).eq('id', payload.id);
    } else {
      const { data } = await supabase.from('ohyeah_top_platos').insert(payload).select().single();
      if (data) payload = data;
    }
    const nuevoArr = topPlatos.filter((p:any) => p.posicion !== form.posicion).concat(payload).sort((a:any,b:any)=>a.posicion-b.posicion);
    onChange(nuevoArr);
    setSubiendo(false);
    setEditing(null);
    showToast(`✓ Plato #${form.posicion} guardado`);
  };
  const onFile = async (file: File) => {
    setSubiendo(true);
    const url = await subirFotoOhYeah(file, 'top-platos', restauranteId);
    if (url) setForm((f:any) => ({ ...f, foto_url: url }));
    else showToast('⚠ Error subiendo foto');
    setSubiendo(false);
  };
  const generarConIA = async () => {
    if (!form.nombre) { showToast('⚠ Pon el nombre primero'); return; }
    showToast('🤖 La generación de descripciones con IA estará disponible próximamente');
    // TODO: llamar al endpoint de IA cuando esté listo
    setForm((f:any) => ({ ...f, ai_optimizado: true, ai_descripcion: `${f.nombre} — descripción optimizada por IA (placeholder)` }));
  };

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',marginBottom:18,gap:12,flexWrap:'wrap'}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:'#FFE600'}}>🌟 Top 10 Platos</div>
          <div style={{fontSize:11,color:'#50506A'}}>Sube tus 10 platos estrella · Estos aparecerán destacados en Oh Yeah</div>
        </div>
        <div style={{marginLeft:'auto',fontSize:11,color:'#50506A'}}>{topPlatos.length}/10 cargados</div>
      </div>
      {/* Grid de 10 slots */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:14}}>
        {Array.from({length:10}).map((_,i) => {
          const pos = i+1;
          const plato = topPlatos.find((p:any) => p.posicion === pos);
          return (
            <button key={pos} onClick={() => abrirSlot(pos)}
              style={{background:plato?'#1a1a26':'rgba(255,255,255,0.02)',border:`1px solid ${plato?'#FFE600'+'40':'rgba(255,255,255,0.08)'}`,borderRadius:14,overflow:'hidden',cursor:'pointer',textAlign:'left',padding:0,transition:'all .15s'}}>
              <div style={{height:140,background:plato?.foto_url?`url(${plato.foto_url}) center/cover`:'linear-gradient(135deg,#1e1e2e,#2a2a3e)',position:'relative'}}>
                <div style={{position:'absolute',top:8,left:8,background:'#FFE600',color:'#000',fontSize:10,fontWeight:900,padding:'3px 9px',borderRadius:50}}>#{pos}</div>
                {!plato && <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,color:'rgba(255,255,255,0.2)'}}>📷</div>}
                {plato?.ai_optimizado && <div style={{position:'absolute',top:8,right:8,background:'rgba(155,114,255,0.8)',color:'#fff',fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:50}}>🤖 IA</div>}
              </div>
              <div style={{padding:'10px 12px'}}>
                <div style={{fontSize:13,fontWeight:700,color:'#fff',marginBottom:3}}>{plato?.nombre || `Slot ${pos} vacío`}</div>
                <div style={{fontSize:11,color:plato?'#FFE600':'#50506A',fontWeight:700}}>{plato?.precio?`$${Number(plato.precio).toLocaleString('es-CO')}`:'Toca para agregar'}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal edición */}
      {editing !== null && (
        <div onClick={()=>setEditing(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0f0f1a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:18,width:'100%',maxWidth:420,padding:24,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:14,color:'#FFE600'}}>🌟 Plato Top #{form.posicion}</div>
            <input type="file" accept="image/*" ref={fileRef} onChange={e=>e.target.files?.[0] && onFile(e.target.files[0])} style={{display:'none'}}/>
            <div onClick={()=>fileRef.current?.click()}
              style={{height:160,borderRadius:12,marginBottom:14,cursor:'pointer',background:form.foto_url?`url(${form.foto_url}) center/cover`:'rgba(255,255,255,0.03)',border:`1px dashed ${form.foto_url?'transparent':'rgba(255,255,255,0.2)'}`,display:'flex',alignItems:'center',justifyContent:'center',color:'#A0A0B8',fontSize:13}}>
              {subiendo ? '⌛ Subiendo...' : (form.foto_url ? '🔄 Cambiar foto' : '📷 Subir foto del plato')}
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Nombre del plato</div>
              <input value={form.nombre||''} onChange={e=>setForm((p:any)=>({...p, nombre:e.target.value}))} placeholder="Ej: Ceviche a la Roca" style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:13,outline:'none'}}/>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Descripción {form.ai_optimizado && <span style={{color:'#9b72ff'}}>· 🤖 IA</span>}</div>
              <textarea value={form.descripcion||''} onChange={e=>setForm((p:any)=>({...p, descripcion:e.target.value}))} placeholder="Cuéntale al comensal de este plato..." rows={3} style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:12,outline:'none',resize:'vertical'}}/>
              <button onClick={generarConIA} style={{marginTop:6,padding:'5px 11px',borderRadius:7,border:'1px solid rgba(155,114,255,0.4)',background:'rgba(155,114,255,0.08)',color:'#9b72ff',fontSize:10,fontWeight:700,cursor:'pointer'}}>🤖 Generar con IA</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              <div>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Precio (COP)</div>
                <input type="number" value={form.precio||''} onChange={e=>setForm((p:any)=>({...p, precio:Number(e.target.value)}))} placeholder="0" style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:13,outline:'none'}}/>
              </div>
              <div>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Emoji</div>
                <input value={form.emoji||''} onChange={e=>setForm((p:any)=>({...p, emoji:e.target.value}))} placeholder="🍽️" style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:18,outline:'none',textAlign:'center'}}/>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              {form.id && <button onClick={async()=>{ await supabase.from('ohyeah_top_platos').delete().eq('id', form.id); onChange(topPlatos.filter((p:any)=>p.id!==form.id)); setEditing(null); showToast(`✓ Slot ${form.posicion} eliminado`); }} style={{padding:'10px 14px',borderRadius:9,border:'1px solid rgba(255,82,82,0.4)',background:'rgba(255,82,82,0.1)',color:'#ff5252',fontSize:12,fontWeight:700,cursor:'pointer'}}>Eliminar</button>}
              <button onClick={()=>setEditing(null)} style={{flex:1,padding:'10px 14px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'transparent',color:'#A0A0B8',fontSize:12,fontWeight:700,cursor:'pointer'}}>Cancelar</button>
              <button onClick={guardar} disabled={subiendo} style={{flex:2,padding:'10px 14px',borderRadius:9,border:'none',background:`linear-gradient(135deg,#FFE600,#e6a800)`,color:'#000',fontSize:12,fontWeight:900,cursor:'pointer'}}>{subiendo?'Guardando...':'✓ Guardar plato'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── EVENTOS DE OH YEAH ─────────────────────────────────────────────────
function EventosEditor({ restauranteId, eventos, onChange, showToast }: any) {
  const [editing, setEditing] = useState<any|null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!restauranteId) return <div style={{padding:40,textAlign:'center',color:'#50506A'}}>Selecciona un restaurante</div>;
  const TIPOS = [
    { id:'cata', label:'🍷 Cata', color:'#B388FF' },
    { id:'brunch', label:'🥐 Brunch', color:'#FFB547' },
    { id:'cena_privada', label:'🍽️ Cena privada', color:'#FF5252' },
    { id:'lanzamiento', label:'🎉 Lanzamiento', color:'#00E676' },
    { id:'show', label:'🎵 Show', color:'#FF2D78' },
    { id:'degustacion', label:'👨‍🍳 Degustación', color:'#448AFF' },
    { id:'clase', label:'📚 Clase', color:'#22d3ee' },
    { id:'otro', label:'✨ Otro', color:'#A0A0B8' },
  ];
  const ESTADOS = ['borrador','publicado','vendido','cancelado','finalizado'];

  const nuevoEvento = () => setEditing({ restaurante_id: restauranteId, titulo:'', tipo:'cata', fecha: new Date().toISOString().split('T')[0], cupos_totales: 20, cupos_disponibles: 20, estado:'borrador' });
  const guardar = async () => {
    if (!editing.titulo) { showToast('⚠ Título requerido'); return; }
    setSubiendo(true);
    let payload = { ...editing, restaurante_id: restauranteId, updated_at: new Date().toISOString() };
    if (payload.id) {
      await supabase.from('ohyeah_eventos').update(payload).eq('id', payload.id);
    } else {
      const { data } = await supabase.from('ohyeah_eventos').insert(payload).select().single();
      if (data) payload = data;
    }
    const nuevos = editing.id ? eventos.map((e:any)=>e.id===payload.id?payload:e) : [payload, ...eventos];
    onChange(nuevos);
    setSubiendo(false);
    setEditing(null);
    showToast('✓ Evento guardado');
  };
  const eliminar = async () => {
    if (!editing.id) { setEditing(null); return; }
    await supabase.from('ohyeah_eventos').delete().eq('id', editing.id);
    onChange(eventos.filter((e:any)=>e.id!==editing.id));
    setEditing(null);
    showToast('Evento eliminado');
  };
  const onFile = async (file: File) => {
    setSubiendo(true);
    const url = await subirFotoOhYeah(file, 'eventos', restauranteId);
    if (url) setEditing((e:any) => ({ ...e, foto_url: url }));
    setSubiendo(false);
  };

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',marginBottom:18,gap:12,flexWrap:'wrap'}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:'#FFE600'}}>🎉 Eventos Oh Yeah</div>
          <div style={{fontSize:11,color:'#50506A'}}>Catas, brunch, lanzamientos, cenas privadas · Tus clientes ven y reservan cupos</div>
        </div>
        <button onClick={nuevoEvento} style={{marginLeft:'auto',padding:'9px 18px',borderRadius:10,border:'none',background:`linear-gradient(135deg,#FFE600,#e6a800)`,color:'#000',fontSize:12,fontWeight:900,cursor:'pointer'}}>+ Nuevo evento</button>
      </div>

      {eventos.length === 0 && <div style={{padding:60,textAlign:'center',color:'#50506A'}}><div style={{fontSize:40,marginBottom:10}}>🎉</div><div style={{fontSize:13,fontWeight:700}}>Aún no tienes eventos · Crea el primero</div></div>}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>
        {eventos.map((e:any) => {
          const tipo = TIPOS.find(t => t.id === e.tipo) || TIPOS[7];
          const estadoColor = e.estado==='publicado'?'#00E676':e.estado==='vendido'?'#FFE600':e.estado==='cancelado'?'#FF5252':'#A0A0B8';
          return (
            <button key={e.id} onClick={()=>setEditing(e)} style={{background:'#1a1a26',border:`1px solid ${tipo.color}30`,borderRadius:14,overflow:'hidden',cursor:'pointer',textAlign:'left',padding:0}}>
              <div style={{height:120,background:e.foto_url?`url(${e.foto_url}) center/cover`:`linear-gradient(135deg,${tipo.color}30,#1e1e2e)`,position:'relative'}}>
                <div style={{position:'absolute',top:8,left:8,background:tipo.color,color:'#000',fontSize:10,fontWeight:900,padding:'3px 9px',borderRadius:50}}>{tipo.label}</div>
                <div style={{position:'absolute',top:8,right:8,background:`${estadoColor}25`,color:estadoColor,fontSize:9,fontWeight:900,padding:'3px 9px',borderRadius:50,textTransform:'uppercase'}}>{e.estado}</div>
              </div>
              <div style={{padding:'10px 14px'}}>
                <div style={{fontSize:14,fontWeight:700,color:'#fff',marginBottom:4}}>{e.titulo}</div>
                <div style={{fontSize:11,color:'#A0A0B8',marginBottom:6}}>{new Date(e.fecha+'T00:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}{e.hora_inicio?` · ${e.hora_inicio.slice(0,5)}`:''}</div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11}}>
                  <span style={{color:'#FFE600',fontWeight:700}}>{e.cupos_disponibles}/{e.cupos_totales} cupos</span>
                  {e.precio && <span style={{color:'#fff',fontWeight:700}}>${Number(e.precio).toLocaleString('es-CO')}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {editing && (
        <div onClick={()=>setEditing(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0f0f1a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:18,width:'100%',maxWidth:480,padding:24,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:14,color:'#FFE600'}}>🎉 {editing.id?'Editar evento':'Nuevo evento'}</div>
            <input type="file" accept="image/*" ref={fileRef} onChange={e=>e.target.files?.[0] && onFile(e.target.files[0])} style={{display:'none'}}/>
            <div onClick={()=>fileRef.current?.click()} style={{height:140,borderRadius:12,marginBottom:14,cursor:'pointer',background:editing.foto_url?`url(${editing.foto_url}) center/cover`:'rgba(255,255,255,0.03)',border:`1px dashed ${editing.foto_url?'transparent':'rgba(255,255,255,0.2)'}`,display:'flex',alignItems:'center',justifyContent:'center',color:'#A0A0B8',fontSize:13}}>
              {editing.foto_url?'🔄 Cambiar foto':'📷 Subir foto del evento'}
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Título</div>
              <input value={editing.titulo||''} onChange={e=>setEditing((p:any)=>({...p, titulo:e.target.value}))} placeholder="Ej: Cata de vinos italianos" style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:13,outline:'none'}}/>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Descripción</div>
              <textarea value={editing.descripcion||''} onChange={e=>setEditing((p:any)=>({...p, descripcion:e.target.value}))} rows={3} placeholder="¿De qué se trata el evento?" style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:12,outline:'none',resize:'vertical'}}/>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Tipo de evento</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {TIPOS.map(t => (
                  <button key={t.id} onClick={()=>setEditing((p:any)=>({...p, tipo:t.id}))} style={{padding:'7px 12px',borderRadius:9,border:`1px solid ${editing.tipo===t.id?t.color:'rgba(255,255,255,0.12)'}`,background:editing.tipo===t.id?`${t.color}20`:'transparent',color:editing.tipo===t.id?t.color:'#A0A0B8',fontSize:11,fontWeight:700,cursor:'pointer'}}>{t.label}</button>
                ))}
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Fecha</div>
                <input type="date" value={editing.fecha||''} onChange={e=>setEditing((p:any)=>({...p, fecha:e.target.value}))} style={{width:'100%',padding:'9px 10px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:11,outline:'none',colorScheme:'dark'}}/>
              </div>
              <div>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Inicio</div>
                <input type="time" value={editing.hora_inicio||''} onChange={e=>setEditing((p:any)=>({...p, hora_inicio:e.target.value}))} style={{width:'100%',padding:'9px 10px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:11,outline:'none',colorScheme:'dark'}}/>
              </div>
              <div>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Fin</div>
                <input type="time" value={editing.hora_fin||''} onChange={e=>setEditing((p:any)=>({...p, hora_fin:e.target.value}))} style={{width:'100%',padding:'9px 10px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:11,outline:'none',colorScheme:'dark'}}/>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Cupos totales</div>
                <input type="number" value={editing.cupos_totales||0} onChange={e=>{ const v = Number(e.target.value); setEditing((p:any)=>({...p, cupos_totales:v, cupos_disponibles: p.cupos_disponibles ?? v })); }} style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:13,outline:'none'}}/>
              </div>
              <div>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Precio (COP)</div>
                <input type="number" value={editing.precio||''} onChange={e=>setEditing((p:any)=>({...p, precio:Number(e.target.value)}))} placeholder="0" style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:13,outline:'none'}}/>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Estado</div>
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {ESTADOS.map(es => (
                  <button key={es} onClick={()=>setEditing((p:any)=>({...p, estado:es}))} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${editing.estado===es?'#FFE600':'rgba(255,255,255,0.12)'}`,background:editing.estado===es?'rgba(255,230,0,0.12)':'transparent',color:editing.estado===es?'#FFE600':'#A0A0B8',fontSize:11,fontWeight:700,cursor:'pointer',textTransform:'uppercase'}}>{es}</button>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              {editing.id && <button onClick={eliminar} style={{padding:'10px 14px',borderRadius:9,border:'1px solid rgba(255,82,82,0.4)',background:'rgba(255,82,82,0.1)',color:'#ff5252',fontSize:12,fontWeight:700,cursor:'pointer'}}>Eliminar</button>}
              <button onClick={()=>setEditing(null)} style={{flex:1,padding:'10px 14px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'transparent',color:'#A0A0B8',fontSize:12,fontWeight:700,cursor:'pointer'}}>Cancelar</button>
              <button onClick={guardar} disabled={subiendo} style={{flex:2,padding:'10px 14px',borderRadius:9,border:'none',background:`linear-gradient(135deg,#FFE600,#e6a800)`,color:'#000',fontSize:12,fontWeight:900,cursor:'pointer'}}>{subiendo?'Guardando...':'✓ Guardar evento'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── GOURMAND SOCIETY (regalos por nivel) ───────────────────────────────
function GourmandEditor({ restauranteId, regalos, onChange, showToast }: any) {
  const [editing, setEditing] = useState<any|null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!restauranteId) return <div style={{padding:40,textAlign:'center',color:'#50506A'}}>Selecciona un restaurante</div>;
  const NIVELES = [
    { id:'INICIADO', label:'Iniciado', emoji:'🌱', color:'#A0A0B8' },
    { id:'REGULAR', label:'Regular', emoji:'🍴', color:'#22d3ee' },
    { id:'VIP', label:'VIP', emoji:'⭐', color:'#FFE600' },
    { id:'CONSAGRADO', label:'Consagrado', emoji:'🔥', color:'#FF9800' },
    { id:'ELITE', label:'Élite', emoji:'👑', color:'#FF5252' },
    { id:'GRAND_GOURMAND', label:'Grand Gourmand', emoji:'🏆', color:'#B388FF' },
    { id:'LA_CREME', label:'La Crème', emoji:'💎', color:'#00E676' },
  ];
  const TIPOS_REGALO = ['cortesia','descuento','experiencia','plato','bebida','postre','combo','servicio'];

  const nuevo = (nivel:string) => setEditing({ restaurante_id: restauranteId, nivel, nombre:'', tipo:'cortesia', emoji:'🎁', activo:true });
  const guardar = async () => {
    if (!editing.nombre) { showToast('⚠ Nombre requerido'); return; }
    setSubiendo(true);
    let payload = { ...editing, restaurante_id: restauranteId, updated_at: new Date().toISOString() };
    if (payload.id) {
      await supabase.from('ohyeah_gourmand_regalos').update(payload).eq('id', payload.id);
    } else {
      const { data } = await supabase.from('ohyeah_gourmand_regalos').insert(payload).select().single();
      if (data) payload = data;
    }
    const nuevos = editing.id ? regalos.map((r:any)=>r.id===payload.id?payload:r) : [payload, ...regalos];
    onChange(nuevos);
    setSubiendo(false);
    setEditing(null);
    showToast('✓ Regalo guardado');
  };
  const eliminar = async () => {
    if (!editing.id) { setEditing(null); return; }
    await supabase.from('ohyeah_gourmand_regalos').delete().eq('id', editing.id);
    onChange(regalos.filter((r:any)=>r.id!==editing.id));
    setEditing(null);
    showToast('Regalo eliminado');
  };
  const onFile = async (file: File) => {
    setSubiendo(true);
    const url = await subirFotoOhYeah(file, 'gourmand', restauranteId);
    if (url) setEditing((e:any) => ({ ...e, foto_url: url }));
    setSubiendo(false);
  };

  return (
    <div>
      <div style={{marginBottom:18}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:'#FFE600'}}>👑 Gourmand Society</div>
        <div style={{fontSize:11,color:'#50506A'}}>Catálogo de regalos por nivel · Los clientes desbloquean según su nivel en Oh Yeah</div>
      </div>

      {NIVELES.map(nv => {
        const delNivel = regalos.filter((r:any) => r.nivel === nv.id);
        return (
          <div key={nv.id} style={{marginBottom:20,padding:16,background:`${nv.color}08`,border:`1px solid ${nv.color}30`,borderRadius:14}}>
            <div style={{display:'flex',alignItems:'center',marginBottom:12,gap:10}}>
              <span style={{fontSize:24}}>{nv.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,color:nv.color}}>{nv.label}</div>
                <div style={{fontSize:10,color:'#50506A'}}>{delNivel.length} regalo{delNivel.length===1?'':'s'} disponible{delNivel.length===1?'':'s'}</div>
              </div>
              <button onClick={()=>nuevo(nv.id)} style={{padding:'7px 14px',borderRadius:9,border:`1px solid ${nv.color}50`,background:`${nv.color}15`,color:nv.color,fontSize:11,fontWeight:700,cursor:'pointer'}}>+ Agregar</button>
            </div>
            {delNivel.length === 0 ? (
              <div style={{textAlign:'center',padding:18,color:'#50506A',fontSize:11}}>Sin regalos en este nivel</div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10}}>
                {delNivel.map((r:any) => (
                  <button key={r.id} onClick={()=>setEditing(r)} style={{background:'#1a1a26',border:`1px solid ${nv.color}30`,borderRadius:11,padding:12,cursor:'pointer',textAlign:'left'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                      {r.foto_url ? <img src={r.foto_url} alt="" style={{width:36,height:36,borderRadius:8,objectFit:'cover'}}/> : <span style={{fontSize:24}}>{r.emoji||'🎁'}</span>}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.nombre}</div>
                        <div style={{fontSize:10,color:'#50506A',textTransform:'uppercase'}}>{r.tipo}</div>
                      </div>
                    </div>
                    {r.valor_estimado && <div style={{fontSize:10,color:nv.color,fontWeight:700}}>Valor: ${Number(r.valor_estimado).toLocaleString('es-CO')}</div>}
                    {r.veces_canjeado > 0 && <div style={{fontSize:9,color:'#50506A',marginTop:3}}>{r.veces_canjeado}× canjeado</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {editing && (
        <div onClick={()=>setEditing(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0f0f1a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:18,width:'100%',maxWidth:440,padding:24,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:14,color:'#FFE600'}}>{editing.id?'Editar regalo':'Nuevo regalo'} · {NIVELES.find(n=>n.id===editing.nivel)?.label}</div>
            <input type="file" accept="image/*" ref={fileRef} onChange={e=>e.target.files?.[0] && onFile(e.target.files[0])} style={{display:'none'}}/>
            <div onClick={()=>fileRef.current?.click()} style={{height:120,borderRadius:12,marginBottom:14,cursor:'pointer',background:editing.foto_url?`url(${editing.foto_url}) center/cover`:'rgba(255,255,255,0.03)',border:`1px dashed ${editing.foto_url?'transparent':'rgba(255,255,255,0.2)'}`,display:'flex',alignItems:'center',justifyContent:'center',color:'#A0A0B8',fontSize:13}}>
              {editing.foto_url?'🔄 Cambiar foto':'📷 Foto del regalo (opcional)'}
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Nombre del regalo</div>
              <input value={editing.nombre||''} onChange={e=>setEditing((p:any)=>({...p, nombre:e.target.value}))} placeholder="Ej: Copa de espumante de cortesía" style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:13,outline:'none'}}/>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Descripción</div>
              <textarea value={editing.descripcion||''} onChange={e=>setEditing((p:any)=>({...p, descripcion:e.target.value}))} rows={2} style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:12,outline:'none',resize:'vertical'}}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Tipo</div>
                <select value={editing.tipo||'cortesia'} onChange={e=>setEditing((p:any)=>({...p, tipo:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'#1a1a26',color:'#fff',fontSize:12,outline:'none',colorScheme:'dark'}}>
                  {TIPOS_REGALO.map(t => <option key={t} value={t} style={{background:'#1a1a26'}}>{t}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Valor (COP)</div>
                <input type="number" value={editing.valor_estimado||''} onChange={e=>setEditing((p:any)=>({...p, valor_estimado:Number(e.target.value)}))} placeholder="0" style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:12,outline:'none'}}/>
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Condiciones (opcional)</div>
              <input value={editing.condiciones||''} onChange={e=>setEditing((p:any)=>({...p, condiciones:e.target.value}))} placeholder='Ej: "Mín 4 personas", "No aplica fines de semana"' style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:12,outline:'none'}}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              <div>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Emoji</div>
                <input value={editing.emoji||'🎁'} onChange={e=>setEditing((p:any)=>({...p, emoji:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:18,outline:'none',textAlign:'center'}}/>
              </div>
              <div>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Stock / mes</div>
                <input type="number" value={editing.stock_mensual||''} onChange={e=>setEditing((p:any)=>({...p, stock_mensual:Number(e.target.value)}))} placeholder="∞" style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:12,outline:'none'}}/>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              {editing.id && <button onClick={eliminar} style={{padding:'10px 14px',borderRadius:9,border:'1px solid rgba(255,82,82,0.4)',background:'rgba(255,82,82,0.1)',color:'#ff5252',fontSize:12,fontWeight:700,cursor:'pointer'}}>Eliminar</button>}
              <button onClick={()=>setEditing(null)} style={{flex:1,padding:'10px 14px',borderRadius:9,border:'1px solid rgba(255,255,255,0.12)',background:'transparent',color:'#A0A0B8',fontSize:12,fontWeight:700,cursor:'pointer'}}>Cancelar</button>
              <button onClick={guardar} disabled={subiendo} style={{flex:2,padding:'10px 14px',borderRadius:9,border:'none',background:`linear-gradient(135deg,#FFE600,#e6a800)`,color:'#000',fontSize:12,fontWeight:900,cursor:'pointer'}}>{subiendo?'Guardando...':'✓ Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
