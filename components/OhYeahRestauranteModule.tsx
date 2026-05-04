import React, { useState } from 'react';
import { supabase } from '../lib/supabase.ts';

const C = {
  bg:'#06060c', bg2:'#0e0e1c', card:'#141424',
  border:'rgba(255,255,255,0.08)', border2:'rgba(255,255,255,0.14)',
  t1:'#FFF', t2:'#B0B0C8', t3:'#505068',
  yellow:'#FFE600', pink:'#FF2D78', green:'#00E676',
  blue:'#448AFF', purple:'#B388FF',
};
const inp: React.CSSProperties = {
  background:'rgba(255,255,255,0.05)', border:`1px solid rgba(255,255,255,0.12)`,
  borderRadius:10, padding:'11px 14px', color:'#fff', fontSize:13,
  outline:'none', width:'100%', fontFamily:"'DM Sans',sans-serif",
};
const lbl: React.CSSProperties = {
  fontSize:10, color:'#505068', fontWeight:700, marginBottom:5,
  display:'block', textTransform:'uppercase', letterSpacing:'.08em',
};

type Step = 'intro'|'basico'|'detalle'|'horarios'|'amenidades'|'fotos'|'contacto'|'revision'|'ok';

const STEPS: {id:Step, label:string, n:number}[] = [
  {id:'intro',     label:'Bienvenida', n:0},
  {id:'basico',    label:'Básicos',    n:1},
  {id:'detalle',   label:'Detalle',    n:2},
  {id:'horarios',  label:'Horarios',   n:3},
  {id:'amenidades',label:'Amenidades', n:4},
  {id:'fotos',     label:'Fotos',      n:5},
  {id:'contacto',  label:'Contacto',   n:6},
  {id:'revision',  label:'Revisión',   n:7},
];

const DIAS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const COCINAS = ['Italiana','Japonesa','Nikkei','Mediterránea','Colombiana','Francesa','Peruana','Mexicana','Bar & Cócteles','Mariscos','Carnes','Vegetariana','Fusión','Brunch','Pizza','Sushi','Panadería & Café'];
const CIUDADES = ['Bogotá','Medellín','Cali','Barranquilla','Cartagena','Santa Marta','Bucaramanga','Pereira','Manizales','Cúcuta'];
const ETIQUETAS = ['Informal','Elegante','Informal y elegante','Smart casual','Fine dining','Familiar','Romántico','Negocios'];
const PRECIOS = [{v:'$',l:'Económico · < $30k'},{v:'$$',l:'Moderado · $30–80k'},{v:'$$$',l:'Exclusivo · $80–150k'},{v:'$$$$',l:'Premium · > $150k'}];
const AMENIDADES = [
  {k:'acceso_silla_ruedas',l:'♿ Acceso silla de ruedas'},
  {k:'banos_unisex',l:'🚻 Baños unisex'},
  {k:'bar_completo',l:'🍺 Bar completo'},
  {k:'cocteles',l:'🍹 Cócteles'},
  {k:'terraza',l:'🌿 Terraza exterior'},
  {k:'sin_gluten',l:'🌾 Opciones sin gluten'},
  {k:'vinos',l:'🍷 Carta de vinos'},
  {k:'vista',l:'🌅 Vista / paisaje'},
  {k:'wifi',l:'📶 WiFi gratis'},
  {k:'musica_en_vivo',l:'🎵 Música en vivo'},
  {k:'estacionamiento',l:'🅿️ Estacionamiento'},
  {k:'eventos_privados',l:'🎉 Sala para eventos'},
  {k:'cargo_descorche',l:'🍾 Cargo descorche'},
  {k:'asientos_barra',l:'🪑 Asientos en barra'},
];

const emptyForm = () => ({
  nombre:'', descripcion:'', descripcion_corta:'', plato_insignia:'', plato_insignia_desc:'',
  direccion:'', ciudad:'Bogotá', web:'', maps_url:'', instagram:'', facebook:'', tiktok:'',
  cocinas:[] as string[], etiqueta:'Informal y elegante', precio_rango:'$$',
  foto_portada:'', foto_logo:'', fotos:[] as string[],
  nombre_contacto:'', cargo_contacto:'', email_contacto:'', telefono:'', whatsapp:'',
  amenidades:{} as Record<string,boolean>,
  notas_adicionales:'',
});

const emptyHorarios = () => Object.fromEntries(
  DIAS.map(d=>[d,{abre:'12:00',cierra:'22:00',cerrado:false}])
);

export default function OhYeahRestauranteModule() {
  const [step, setStep]     = useState<Step>('intro');
  const [form, setForm]     = useState(emptyForm());
  const [horarios, setHor]  = useState<Record<string,any>>(emptyHorarios());
  const [sending, setSend]  = useState(false);
  const [toast, setToast]   = useState('');
  const [fotoUrl, setFoto]  = useState('');

  const show = (m:string) => { setToast(m); setTimeout(()=>setToast(''),3000); };
  const setF = (k:string, v:any) => setForm(p=>({...p,[k]:v}));
  const toggleCocina = (c:string) => {
    const cur = form.cocinas;
    setF('cocinas', cur.includes(c) ? cur.filter(x=>x!==c) : [...cur,c]);
  };
  const toggleAm = (k:string) => setF('amenidades',{...form.amenidades,[k]:!form.amenidades[k]});
  const slugify = (s:string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');

  const ORDER: Step[] = ['intro','basico','detalle','horarios','amenidades','fotos','contacto','revision'];
  const curN = STEPS.find(s=>s.id===step)?.n ?? 0;

  const validar = (): string|null => {
    if (step==='basico') {
      if (!form.nombre.trim()) return '⚠️ Nombre del restaurante requerido';
      if (form.cocinas.length === 0) return '⚠️ Selecciona al menos un tipo de cocina';
      if (!form.ciudad) return '⚠️ Ciudad requerida';
    }
    if (step==='contacto') {
      if (!form.nombre_contacto.trim()) return '⚠️ Nombre del contacto requerido';
      if (!form.email_contacto.trim()) return '⚠️ Email requerido';
      if (!form.email_contacto.includes('@')) return '⚠️ Email inválido';
      if (!form.telefono.trim()) return '⚠️ Teléfono requerido';
    }
    return null;
  };

  const next = () => {
    const err = validar();
    if (err) { show(err); return; }
    const i = ORDER.indexOf(step);
    if (i < ORDER.length-1) setStep(ORDER[i+1]);
  };
  const prev = () => {
    const i = ORDER.indexOf(step);
    if (i > 0) setStep(ORDER[i-1]);
  };

  const enviar = async () => {
    setSend(true);
    try {
      await supabase.from('ohyeah_solicitudes').insert({
        nombre: form.nombre,
        slug: slugify(form.nombre),
        descripcion: form.descripcion,
        descripcion_corta: form.descripcion_corta,
        plato_insignia: form.plato_insignia,
        direccion: form.direccion,
        ciudad: form.ciudad,
        web: form.web,
        maps_url: form.maps_url,
        instagram: form.instagram,
        facebook: form.facebook,
        tiktok: form.tiktok,
        cocinas: form.cocinas,
        etiqueta: form.etiqueta,
        precio_rango: form.precio_rango,
        foto_portada: form.foto_portada,
        foto_logo: form.foto_logo,
        fotos: form.fotos,
        nombre_contacto: form.nombre_contacto,
        cargo_contacto: form.cargo_contacto,
        email_contacto: form.email_contacto,
        telefono: form.telefono,
        whatsapp: form.whatsapp,
        amenidades: form.amenidades,
        horarios,
        estado: 'pendiente',
      });
      setStep('ok');
    } catch(e) {
      show('Error al enviar. Intenta de nuevo.');
    }
    setSend(false);
  };

  // ── Progress ──────────────────────────────────────────────────────────────
  const visibleSteps = STEPS.filter(s=>s.n>0 && s.id!=='ok');

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:C.bg,color:C.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>

      {toast && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'#1a1a2e',border:`1px solid ${C.pink}`,padding:'10px 28px',borderRadius:50,fontSize:13,fontWeight:700,zIndex:9999,whiteSpace:'nowrap'}}>{toast}</div>}

      {/* Header */}
      <div style={{background:'#08081a',borderBottom:`1px solid rgba(255,230,0,0.12)`,padding:'14px 28px',display:'flex',alignItems:'center',gap:14,flexShrink:0}}>
        <div style={{width:42,height:42,borderRadius:13,background:`linear-gradient(135deg,${C.yellow},#e6a800)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>🦉</div>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>OH YEAH <span style={{color:C.yellow}}>RESTAURANTE</span></div>
          <div style={{fontSize:10,color:C.t3,letterSpacing:'.1em',textTransform:'uppercase'}}>Registro de restaurante · Plataforma Oh Yeah Colombia</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center'}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:C.green}}/>
          <span style={{fontSize:10,color:C.green,fontWeight:700}}>Registro abierto</span>
        </div>
      </div>

      {/* Progress bar */}
      {step!=='intro' && step!=='ok' && (
        <div style={{padding:'14px 28px',borderBottom:`1px solid ${C.border}`,background:C.bg2,flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:0,maxWidth:680,margin:'0 auto'}}>
            {visibleSteps.map((s,i)=>(
              <React.Fragment key={s.id}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                  <div style={{width:26,height:26,borderRadius:'50%',
                    background:curN>=s.n?C.yellow:'rgba(255,255,255,0.06)',
                    color:curN>=s.n?'#000':C.t3,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:10,fontWeight:900,
                    border:curN===s.n?`2px solid ${C.yellow}`:'2px solid transparent',
                    boxShadow:curN>=s.n?`0 0 10px ${C.yellow}50`:'none',
                    transition:'all .25s'}}>
                    {curN>s.n?'✓':s.n}
                  </div>
                  <div style={{fontSize:8,color:curN>=s.n?C.yellow:C.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',whiteSpace:'nowrap'}}>{s.label}</div>
                </div>
                {i<visibleSteps.length-1 && <div style={{flex:1,height:2,background:curN>s.n?C.yellow:'rgba(255,255,255,0.07)',transition:'background .25s',margin:'0 3px 14px'}}/>}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Contenido scrollable */}
      <div style={{flex:1,overflowY:'auto',padding:'32px 28px'}}>
        <div style={{maxWidth:680,margin:'0 auto'}}>

          {/* ── INTRO ── */}
          {step==='intro' && (
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:64,marginBottom:20}}>🦉</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,marginBottom:10,letterSpacing:'-0.03em'}}>
                Únete a <span style={{color:C.yellow}}>Oh Yeah</span>
              </div>
              <div style={{fontSize:14,color:C.t2,lineHeight:1.7,maxWidth:460,margin:'0 auto 32px'}}>
                La plataforma de reservas y descubrimiento gastronómico más exclusiva de Colombia. Regístra tu restaurante gratis y llega a miles de nuevos comensales.
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:36,textAlign:'left'}}>
                {[
                  {e:'📈',t:'Más reservas',d:'Aparece en búsquedas de miles de usuarios activos en Colombia'},
                  {e:'⭐',t:'Reputación digital',d:'Gestiona reseñas y calificaciones Oh Yeah en tiempo real'},
                  {e:'🎯',t:'Perfil completo',d:'Galería, menú, experiencias y concierge personalizado'},
                  {e:'🚀',t:'Sin costo inicial',d:'Registro gratuito. Comisión solo en reservas confirmadas'},
                ].map(b=>(
                  <div key={b.t} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'16px 18px'}}>
                    <div style={{fontSize:22,marginBottom:8}}>{b.e}</div>
                    <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{b.t}</div>
                    <div style={{fontSize:11,color:C.t3,lineHeight:1.5}}>{b.d}</div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setStep('basico')}
                style={{padding:'14px 48px',borderRadius:50,border:'none',background:`linear-gradient(135deg,${C.yellow},#e6a800)`,color:'#000',fontSize:15,fontWeight:900,cursor:'pointer',boxShadow:`0 8px 28px ${C.yellow}40`,letterSpacing:'.02em'}}>
                Comenzar registro →
              </button>
              <div style={{fontSize:11,color:C.t3,marginTop:12}}>~5 minutos · Totalmente gratuito</div>
            </div>
          )}

          {/* ── BÁSICO ── */}
          {step==='basico' && (
            <div style={{display:'flex',flexDirection:'column',gap:18}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,marginBottom:4}}>Cuéntanos sobre tu restaurante</div>
              <div>
                <div style={lbl}>Nombre del restaurante *</div>
                <input style={inp} value={form.nombre} onChange={e=>setF('nombre',e.target.value)} placeholder="Ej: OMM · Bogotá"/>
              </div>
              <div>
                <div style={lbl}>Descripción corta (aparece en búsquedas)</div>
                <input style={inp} value={form.descripcion_corta} onChange={e=>setF('descripcion_corta',e.target.value)} placeholder="Ej: Japonés Nikkei · Robata · Cócteles · Bogotá"/>
              </div>
              <div>
                <div style={lbl}>Descripción completa</div>
                <textarea style={{...inp,height:100,resize:'vertical'}} value={form.descripcion} onChange={e=>setF('descripcion',e.target.value)} placeholder="Describe la experiencia única de tu restaurante, la propuesta gastronómica, el ambiente..."/>
              </div>
              <div>
                <div style={lbl}>🍽️ Plato insignia (estrella del menú)</div>
                <input style={inp} value={form.plato_insignia} onChange={e=>setF('plato_insignia',e.target.value)} placeholder="Ej: Ton Katsu Don, Pizza Margherita, Ceviche Nikkei..."/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div>
                  <div style={lbl}>Ciudad *</div>
                  <select style={inp} value={form.ciudad} onChange={e=>setF('ciudad',e.target.value)}>
                    {CIUDADES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div style={lbl}>💰 Rango de precio por persona</div>
                  <div style={{display:'flex',gap:6}}>
                    {PRECIOS.map(p=>(
                      <button key={p.v} onClick={()=>setF('precio_rango',p.v)} title={p.l}
                        style={{flex:1,padding:'11px 4px',borderRadius:10,border:`1px solid ${form.precio_rango===p.v?C.yellow:C.border}`,background:form.precio_rango===p.v?`${C.yellow}15`:'transparent',color:form.precio_rango===p.v?C.yellow:C.t3,fontSize:13,fontWeight:700,cursor:'pointer'}}>
                        {p.v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div style={lbl}>👔 Estilo / ambiente</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {ETIQUETAS.map(e=>(
                    <button key={e} onClick={()=>setF('etiqueta',e)}
                      style={{padding:'6px 14px',borderRadius:50,border:`1px solid ${form.etiqueta===e?C.yellow:C.border}`,background:form.etiqueta===e?`${C.yellow}15`:'transparent',color:form.etiqueta===e?C.yellow:C.t3,fontSize:12,cursor:'pointer',transition:'all .15s'}}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={lbl}>🍴 Tipos de cocina * (selecciona los que apliquen)</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {COCINAS.map(cc=>{
                    const sel=form.cocinas.includes(cc);
                    return <button key={cc} onClick={()=>toggleCocina(cc)}
                      style={{padding:'6px 14px',borderRadius:50,border:`1px solid ${sel?C.blue:C.border}`,background:sel?`${C.blue}15`:'transparent',color:sel?C.blue:C.t3,fontSize:12,cursor:'pointer',transition:'all .15s'}}>
                      {cc}
                    </button>;
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── DETALLE ── */}
          {step==='detalle' && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,marginBottom:4}}>Datos de ubicación y contacto</div>
              <div>
                <div style={lbl}>📍 Dirección completa</div>
                <input style={inp} value={form.direccion} onChange={e=>setF('direccion',e.target.value)} placeholder="Cra. 38 #9A-13, Bogotá D.C."/>
              </div>
              <div>
                <div style={lbl}>📍 URL Google Maps (opcional)</div>
                <input style={inp} value={form.maps_url} onChange={e=>setF('maps_url',e.target.value)} placeholder="https://maps.google.com/..."/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div>
                  <div style={lbl}>🌐 Sitio web</div>
                  <input style={inp} value={form.web} onChange={e=>setF('web',e.target.value)} placeholder="www.mirestaurante.com"/>
                </div>
                <div>
                  <div style={lbl}>📸 Instagram</div>
                  <input style={inp} value={form.instagram} onChange={e=>setF('instagram',e.target.value)} placeholder="@mirestaurante"/>
                </div>
                <div>
                  <div style={lbl}>👍 Facebook</div>
                  <input style={inp} value={form.facebook} onChange={e=>setF('facebook',e.target.value)} placeholder="facebook.com/mirestaurante"/>
                </div>
                <div>
                  <div style={lbl}>🎵 TikTok</div>
                  <input style={inp} value={form.tiktok} onChange={e=>setF('tiktok',e.target.value)} placeholder="@mirestaurante"/>
                </div>
              </div>
              <div>
                <div style={lbl}>📝 Algo más que quieras contarnos</div>
                <textarea style={{...inp,height:80,resize:'vertical'}} value={form.notas_adicionales} onChange={e=>setF('notas_adicionales',e.target.value)} placeholder="Eventos especiales, concierge personalizado, restricciones, etc."/>
              </div>
            </div>
          )}

          {/* ── HORARIOS ── */}
          {step==='horarios' && (
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,marginBottom:4}}>Horarios de atención</div>
              <div style={{fontSize:12,color:C.t3,marginBottom:20}}>Configura el horario de apertura y cierre de cada día.</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {DIAS.map(dia=>{
                  const h=horarios[dia]||{abre:'12:00',cierra:'22:00',cerrado:false};
                  return (
                    <div key={dia} style={{background:C.card,border:`1px solid ${h.cerrado?C.border:`${C.yellow}20`}`,borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:80,fontSize:13,fontWeight:700,color:h.cerrado?C.t3:C.t1}}>{dia}</div>
                      {!h.cerrado ? (
                        <div style={{display:'flex',alignItems:'center',gap:8,flex:1}}>
                          <input type="time" value={h.abre} onChange={e=>setHor(p=>({...p,[dia]:{...h,abre:e.target.value}}))}
                            style={{...inp,width:110,padding:'7px 10px',fontSize:13}}/>
                          <span style={{color:C.t3}}>—</span>
                          <input type="time" value={h.cierra} onChange={e=>setHor(p=>({...p,[dia]:{...h,cierra:e.target.value}}))}
                            style={{...inp,width:110,padding:'7px 10px',fontSize:13}}/>
                        </div>
                      ) : (
                        <div style={{flex:1,fontSize:12,color:C.t3,fontStyle:'italic'}}>Cerrado</div>
                      )}
                      <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:11,color:h.cerrado?'#FF5252':C.t3}}>
                        <input type="checkbox" checked={h.cerrado} onChange={e=>setHor(p=>({...p,[dia]:{...h,cerrado:e.target.checked}}))} style={{cursor:'pointer'}}/>
                        Cerrado
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── AMENIDADES ── */}
          {step==='amenidades' && (
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,marginBottom:4}}>¿Qué ofrece tu restaurante?</div>
              <div style={{fontSize:12,color:C.t3,marginBottom:20}}>Selecciona todas las características y servicios disponibles.</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
                {AMENIDADES.map(a=>{
                  const on=!!form.amenidades[a.k];
                  return (
                    <button key={a.k} onClick={()=>toggleAm(a.k)}
                      style={{padding:'13px 16px',borderRadius:12,border:`1px solid ${on?C.yellow:C.border}`,background:on?`${C.yellow}10`:'transparent',color:on?C.yellow:C.t2,cursor:'pointer',display:'flex',alignItems:'center',gap:10,transition:'all .15s',textAlign:'left'}}>
                      <span style={{fontSize:18}}>{a.l.split(' ')[0]}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700}}>{a.l.slice(a.l.indexOf(' ')+1)}</div>
                        <div style={{fontSize:10,color:on?`${C.yellow}90`:C.t3}}>{on?'Disponible':'Seleccionar'}</div>
                      </div>
                      {on && <span style={{fontSize:14,color:C.yellow}}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── FOTOS ── */}
          {step==='fotos' && (
            <div style={{display:'flex',flexDirection:'column',gap:20}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,marginBottom:4}}>Imágenes del restaurante</div>
              <div>
                <div style={lbl}>Logo (URL de imagen)</div>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <input style={{...inp,flex:1}} value={form.foto_logo} onChange={e=>setF('foto_logo',e.target.value)} placeholder="https://...logo.png"/>
                  {form.foto_logo && <img src={form.foto_logo} alt="" style={{width:48,height:48,borderRadius:10,objectFit:'cover',border:`1px solid ${C.border}`}}/>}
                </div>
              </div>
              <div>
                <div style={lbl}>Foto de portada (URL de imagen)</div>
                <input style={inp} value={form.foto_portada} onChange={e=>setF('foto_portada',e.target.value)} placeholder="https://...cover.jpg"/>
                {form.foto_portada && <div style={{marginTop:10,height:160,borderRadius:12,background:`url(${form.foto_portada}) center/cover no-repeat`,border:`1px solid ${C.border}`}}/>}
              </div>
              <div>
                <div style={lbl}>Galería de fotos (URLs adicionales)</div>
                <div style={{display:'flex',gap:8,marginBottom:10}}>
                  <input style={{...inp,flex:1}} value={fotoUrl} onChange={e=>setFoto(e.target.value)} placeholder="https://...foto.jpg" onKeyDown={e=>{ if(e.key==='Enter'&&fotoUrl.trim()){ setF('fotos',[...form.fotos,fotoUrl.trim()]); setFoto(''); }}}/>
                  <button onClick={()=>{ if(fotoUrl.trim()){ setF('fotos',[...form.fotos,fotoUrl.trim()]); setFoto(''); }}}
                    style={{padding:'0 18px',borderRadius:10,border:'none',background:C.yellow,color:'#000',fontWeight:700,cursor:'pointer',fontSize:13,flexShrink:0}}>
                    + Agregar
                  </button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:8}}>
                  {form.fotos.map((f,i)=>(
                    <div key={i} style={{position:'relative',borderRadius:10,overflow:'hidden',aspectRatio:'1',background:`url(${f}) center/cover no-repeat`,border:`1px solid ${C.border}`}}>
                      <button onClick={()=>setF('fotos',form.fotos.filter((_,j)=>j!==i))}
                        style={{position:'absolute',top:4,right:4,width:22,height:22,borderRadius:'50%',border:'none',background:'rgba(0,0,0,0.7)',color:'#fff',cursor:'pointer',fontSize:11}}>✕</button>
                    </div>
                  ))}
                  {form.fotos.length===0 && (
                    <div style={{gridColumn:'1/-1',textAlign:'center',padding:28,color:C.t3,border:`2px dashed ${C.border}`,borderRadius:12,fontSize:12}}>
                      Agrega URLs de fotos del restaurante
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── CONTACTO ── */}
          {step==='contacto' && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,marginBottom:4}}>Datos de contacto</div>
              <div style={{fontSize:12,color:C.t3,marginBottom:4}}>¿Con quién nos comunicamos para completar el registro?</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div>
                  <div style={lbl}>Nombre completo *</div>
                  <input style={inp} value={form.nombre_contacto} onChange={e=>setF('nombre_contacto',e.target.value)} placeholder="Diego Cruz"/>
                </div>
                <div>
                  <div style={lbl}>Cargo</div>
                  <input style={inp} value={form.cargo_contacto} onChange={e=>setF('cargo_contacto',e.target.value)} placeholder="Gerente, Propietario, Chef..."/>
                </div>
                <div>
                  <div style={lbl}>Email *</div>
                  <input type="email" style={inp} value={form.email_contacto} onChange={e=>setF('email_contacto',e.target.value)} placeholder="contacto@mirestaurante.com"/>
                </div>
                <div>
                  <div style={lbl}>Teléfono / WhatsApp *</div>
                  <input type="tel" style={inp} value={form.telefono} onChange={e=>setF('telefono',e.target.value)} placeholder="+57 300 000 0000"/>
                </div>
              </div>
              <div style={{background:`${C.yellow}08`,border:`1px solid ${C.yellow}20`,borderRadius:12,padding:'14px 16px',marginTop:8}}>
                <div style={{fontSize:12,color:C.yellow,fontWeight:700,marginBottom:4}}>✓ Proceso de aprobación</div>
                <div style={{fontSize:11,color:C.t2,lineHeight:1.6}}>
                  Una vez recibamos tu solicitud, nuestro equipo la revisará en máximo <strong>48 horas</strong>. Te contactaremos al email registrado para confirmar los detalles y activar tu perfil en Oh Yeah.
                </div>
              </div>
            </div>
          )}

          {/* ── REVISIÓN ── */}
          {step==='revision' && (
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,marginBottom:20}}>Revisa tu solicitud</div>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {/* Card resumen */}
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden'}}>
                  {form.foto_portada && <div style={{height:120,background:`url(${form.foto_portada}) center/cover no-repeat`}}/>}
                  <div style={{padding:'16px 18px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                      {form.foto_logo && <img src={form.foto_logo} alt="" style={{width:44,height:44,borderRadius:10,objectFit:'cover'}}/>}
                      <div>
                        <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:900}}>{form.nombre||'Sin nombre'}</div>
                        <div style={{fontSize:11,color:C.t3}}>{form.ciudad} · {form.precio_rango} · {form.etiqueta}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
                      {form.cocinas.map(c=><span key={c} style={{fontSize:10,background:`${C.blue}15`,color:C.blue,padding:'3px 10px',borderRadius:50}}>{c}</span>)}
                    </div>
                    {form.descripcion_corta && <div style={{fontSize:12,color:C.t2,lineHeight:1.5}}>{form.descripcion_corta}</div>}
                  </div>
                </div>
                {/* Secciones completadas */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {[
                    {l:'Dirección',v:form.direccion},
                    {l:'Contacto',v:`${form.nombre_contacto} · ${form.email_contacto}`},
                    {l:'Cocinas',v:form.cocinas.join(', ')},
                    {l:'Amenidades',v:`${Object.values(form.amenidades).filter(Boolean).length} seleccionadas`},
                    {l:'Fotos',v:`${form.fotos.length} en galería + portada ${form.foto_portada?'✓':'✗'}`},
                    {l:'Horarios',v:`${DIAS.filter(d=>!horarios[d]?.cerrado).length} días activos`},
                  ].map(r=>(
                    <div key={r.l} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 14px'}}>
                      <div style={{fontSize:9,color:C.t3,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:3}}>{r.l}</div>
                      <div style={{fontSize:12,color:r.v?C.t1:C.t3}}>{r.v||'No completado'}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:`${C.green}08`,border:`1px solid ${C.green}20`,borderRadius:12,padding:'14px 16px',fontSize:12,color:C.green,lineHeight:1.6}}>
                  ✓ Al enviar esta solicitud, aceptas los Términos y Condiciones de Oh Yeah y autorizas el uso de la información para la creación de tu perfil en la plataforma.
                </div>
                <button onClick={enviar} disabled={sending}
                  style={{padding:'14px',borderRadius:12,border:'none',background:sending?'#333':`linear-gradient(135deg,${C.yellow},#e6a800)`,color:'#000',fontSize:14,fontWeight:900,cursor:'pointer',boxShadow:sending?'none':`0 8px 24px ${C.yellow}40`,transition:'all .2s'}}>
                  {sending?'Enviando solicitud...':'✓ Enviar solicitud a Oh Yeah'}
                </button>
              </div>
            </div>
          )}

          {/* ── ENVIADO / OK ── */}
          {step==='ok' && (
            <div style={{textAlign:'center',paddingTop:40}}>
              <div style={{fontSize:72,marginBottom:20}}>🎉</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,marginBottom:12}}>¡Solicitud enviada!</div>
              <div style={{fontSize:14,color:C.t2,lineHeight:1.7,maxWidth:420,margin:'0 auto 32px'}}>
                Hemos recibido la solicitud de <strong style={{color:C.yellow}}>{form.nombre}</strong>. Nuestro equipo la revisará en las próximas <strong>48 horas</strong> y te contactaremos a <strong style={{color:C.yellow}}>{form.email_contacto}</strong> para confirmar la activación.
              </div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:'20px 24px',maxWidth:400,margin:'0 auto 32px',textAlign:'left'}}>
                <div style={{fontSize:12,color:C.yellow,fontWeight:700,marginBottom:12}}>¿Qué sigue?</div>
                {[
                  {n:1,t:'Revisión',d:'Nuestro equipo valida la información'},
                  {n:2,t:'Contacto',d:'Te llamamos o escribimos para coordinar'},
                  {n:3,t:'Activación',d:'Tu perfil queda activo en Oh Yeah'},
                  {n:4,t:'Primeras reservas',d:'Empieza a recibir clientes nuevos'},
                ].map(s=>(
                  <div key={s.n} style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:12}}>
                    <div style={{width:24,height:24,borderRadius:'50%',background:C.yellow,color:'#000',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,flexShrink:0}}>{s.n}</div>
                    <div>
                      <div style={{fontSize:12,fontWeight:700}}>{s.t}</div>
                      <div style={{fontSize:11,color:C.t3}}>{s.d}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={()=>{ setStep('intro'); setForm(emptyForm()); setHor(emptyHorarios()); }}
                style={{padding:'11px 32px',borderRadius:50,border:`1px solid ${C.border}`,background:'transparent',color:C.t2,fontSize:13,cursor:'pointer'}}>
                Registrar otro restaurante
              </button>
            </div>
          )}

          {/* Botones navegación */}
          {step!=='intro' && step!=='ok' && (
            <div style={{display:'flex',gap:10,marginTop:28,paddingTop:20,borderTop:`1px solid ${C.border}`}}>
              <button onClick={prev}
                style={{flex:1,padding:'12px',borderRadius:12,border:`1px solid ${C.border}`,background:'transparent',color:C.t2,fontSize:13,fontWeight:700,cursor:'pointer'}}>
                ← Anterior
              </button>
              {step!=='revision' && (
                <button onClick={next}
                  style={{flex:2,padding:'12px',borderRadius:12,border:'none',background:`linear-gradient(135deg,${C.yellow},#e6a800)`,color:'#000',fontSize:13,fontWeight:900,cursor:'pointer',boxShadow:`0 4px 16px ${C.yellow}30`}}>
                  Continuar →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
