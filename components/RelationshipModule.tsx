import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';

// ── Tokens ────────────────────────────────────────────────────────────────
const S = {
  bg:'#08080f', bg2:'#0f0f1a', bg3:'#161624', bg4:'#1e1e2e',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.12)',
  t1:'#FFFFFF', t2:'#A0A0B8', t3:'#50506A',
  gold:'#FFB547', goldD:'#d4943a',
  green:'#00E676', greenD:'#3dba6f',
  red:'#FF5252', blue:'#448AFF',
  purple:'#B388FF', pink:'#FF2D78',
  cyan:'#22d3ee',
};
const inp: React.CSSProperties = {
  background:'rgba(255,255,255,0.05)', border:`1px solid ${S.border2}`,
  borderRadius:8, padding:'9px 14px', color:S.t1, fontSize:13, outline:'none', width:'100%',
};

type CTab = 'lista' | 'perfil' | 'nuevo' | 'analytics' | 'importar';
type Segmento = 'todos' | 'vip' | 'recurrentes' | 'nuevos' | 'dormidos';

interface Customer {
  id:number; name:string; apellido?:string; phone?:string; email?:string;
  notes?:string; vip_status?:boolean; total_visits?:number; total_spent?:number;
  created_at?:string; fecha_nacimiento?:string; alergias?:string[]; preferencias?:string[];
  ultima_visita?:string; score?:number; tags?:string[]; documento?:string;
  tipo_documento?:string; ciudad?:string; origen_captacion?:string;
  promedio_ticket?:number; canal_preferido?:string; activo?:boolean;
  ocasiones_especiales?:any[]; historial_notas?:any[];
  puntos?:number; puntos_historico?:number;
}

const TAGS_PRESET = ['Cumpleañero frecuente','Primera vez','Crítico gastronómico','Influencer','Corporativo','Alérgico crítico','Sommelier','Vegetariano','Sin gluten','Madrugador','Noche larga','Propina generosa'];
const ALERGIAS_PRESET = ['Mariscos','Gluten','Lácteos','Nueces','Huevo','Soya','Pescado','Cerdo','Maní'];
const PREFS_PRESET = ['Mesa ventana','Mesa esquinera','Mesa íntima','Zona VIP','Barra','Terraza','Música baja','Sillas altas','Luz tenue'];
const CANALES = ['walk-in','web','whatsapp','instagram','telefono','oh_yeah','referido'];
const OCASIONES_TIPOS = ['Cumpleaños','Aniversario','Negocio','Primera Cita','Celebración','Graduación','Despedida','Otro'];

const scoreColor = (s:number) => s>=80?S.green:s>=50?S.gold:s>=20?S.goldD:S.red;
const scoreLabel = (s:number) => s>=80?'Embajador':s>=50?'Frecuente':s>=20?'Ocasional':'Nuevo';
const iniciales = (n:string,a?:string) => `${n.charAt(0)}${a?a.charAt(0):''}`.toUpperCase();
const formatFecha = (f?:string) => f ? new Date(f+'T00:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'}) : '—';
const fmtMoney = (n?:number) => n ? `$${Math.round(n).toLocaleString('es-CO')}` : '—';
const hoy = () => new Date().toISOString().split('T')[0];

export default function CustomersModule() {
  const [ctab, setCtab]           = useState<CTab>('lista');
  const [clientes, setClientes]   = useState<Customer[]>([]);
  const [selected, setSelected]   = useState<Customer|null>(null);
  const [loading, setLoading]     = useState(true);
  const [busqueda, setBusqueda]   = useState('');
  const [segmento, setSegmento]   = useState<Segmento>('todos');
  const [ordenar, setOrdenar]     = useState('total_visits');
  const [toast, setToast]         = useState('');
  const [editMode, setEditMode]   = useState(false);
  const [nuevaNota, setNuevaNota] = useState('');
  const [form, setForm]           = useState<Partial<Customer>>({ tipo_documento:'CC', origen_captacion:'walk-in', activo:true });
  // CSV
  const [csvRows, setCsvRows]       = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string,string>>({});
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvStep, setCsvStep]     = useState<'upload'|'map'|'preview'|'done'>('upload');
  const [csvResultado, setCsvResultado] = useState({ok:0,err:0});
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((m:string)=>{ setToast(m); setTimeout(()=>setToast(''),3000); },[]);
  const setF = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  const fetchClientes = async () => {
    const { data } = await supabase.from('customers')
      .select('*').order(ordenar as any, {ascending:false});
    if (data) setClientes(data as Customer[]);
    setLoading(false);
  };

  useEffect(()=>{ fetchClientes(); },[ordenar]);

  // ── Segmentos ─────────────────────────────────────────────────────────
  const segmentar = (c:Customer) => {
    if (c.vip_status) return 'vip';
    if ((c.total_visits||0) >= 5) return 'recurrentes';
    const dias = c.ultima_visita ? Math.floor((Date.now()-new Date(c.ultima_visita).getTime())/86400000) : 9999;
    if (dias > 60) return 'dormidos';
    return 'nuevos';
  };

  const filtrados = clientes.filter(c => {
    if (segmento !== 'todos' && segmentar(c) !== segmento) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (c.name+' '+(c.apellido||'')+' '+(c.phone||'')+' '+(c.email||'')).toLowerCase().includes(q);
    }
    return true;
  });

  const kpis = [
    { l:'Total',       v:clientes.length,                                               c:S.blue   },
    { l:'VIP',         v:clientes.filter(c=>c.vip_status).length,                       c:S.gold   },
    { l:'Recurrentes', v:clientes.filter(c=>segmentar(c)==='recurrentes').length,        c:S.green  },
    { l:'Dormidos',    v:clientes.filter(c=>segmentar(c)==='dormidos').length,           c:S.red    },
    { l:'Ticket prom', v:fmtMoney(clientes.reduce((a,c)=>a+(c.promedio_ticket||0),0)/Math.max(clientes.length,1)), c:S.purple },
  ];

  // ── Guardar cliente ───────────────────────────────────────────────────
  const guardar = async () => {
    if (!form.name) { showToast('⚠️ Nombre requerido'); return; }
    if (selected && editMode) {
      await supabase.from('customers').update(form).eq('id',selected.id);
      showToast('✓ Cliente actualizado');
    } else {
      await supabase.from('customers').insert({ ...form, restaurante_id:6, score:0, total_visits:0, total_spent:0, puntos:0 });
      showToast('✓ Cliente creado');
      setCtab('lista');
    }
    setEditMode(false); fetchClientes();
  };

  const agregarNota = async () => {
    if (!nuevaNota.trim() || !selected) return;
    const notas = selected.historial_notas || [];
    await supabase.from('customers').update({ historial_notas:[...notas,{fecha:hoy(),nota:nuevaNota,autor:'Staff'}] }).eq('id',selected.id);
    showToast('✓ Nota agregada');
    setNuevaNota('');
    fetchClientes();
    setSelected(p=>p?({...p,historial_notas:[...(p.historial_notas||[]),{fecha:hoy(),nota:nuevaNota,autor:'Staff'}]}):p);
  };

  // ── Abrir perfil ──────────────────────────────────────────────────────
  const abrirPerfil = (c:Customer) => {
    setSelected(c);
    setForm(c);
    setEditMode(false);
    setCtab('perfil');
  };

  // ── CSV import ────────────────────────────────────────────────────────
  const parseCsv = (text:string) => {
    const lines = text.split('\n').filter(l=>l.trim());
    const headers = lines[0].split(',').map(h=>h.trim().replace(/"/g,''));
    const rows = lines.slice(1).map(l=>{ const vals=l.split(','); return Object.fromEntries(headers.map((h,i)=>[h,vals[i]?.trim().replace(/"/g,'')])); });
    setCsvHeaders(headers); setCsvRows(rows); setCsvStep('map');
    const auto:Record<string,string> = {};
    headers.forEach(h=>{
      const hl=h.toLowerCase();
      if(hl.includes('nombre')||hl.includes('name'))auto[h]='name';
      else if(hl.includes('apellido'))auto[h]='apellido';
      else if(hl.includes('tel')||hl.includes('phone')||hl.includes('celular'))auto[h]='phone';
      else if(hl.includes('email')||hl.includes('correo'))auto[h]='email';
      else if(hl.includes('ciudad'))auto[h]='ciudad';
    });
    setCsvMapping(auto);
  };

  const importarCsv = async () => {
    setCsvImporting(true);
    let ok=0, err=0;
    for (const row of csvPreview.slice(0,200)) {
      try {
        await supabase.from('customers').insert({ ...row, restaurante_id:6, score:0, total_visits:0, puntos:0 });
        ok++;
      } catch { err++; }
    }
    setCsvResultado({ok,err}); setCsvStep('done'); setCsvImporting(false);
    showToast(`✓ ${ok} importados`); fetchClientes();
  };

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>

      {/* Toast */}
      {toast && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:S.bg4,border:`1px solid ${S.pink}`,color:S.t1,padding:'10px 24px',borderRadius:50,fontSize:13,zIndex:9999,whiteSpace:'nowrap'}}>{toast}</div>}

      {/* Header */}
      <div style={{padding:'14px 24px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:16,flexShrink:0,background:S.bg2,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:42,height:42,borderRadius:13,background:`linear-gradient(135deg,${S.pink},${S.purple})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,boxShadow:`0 0 20px rgba(255,45,120,0.3)`}}>👥</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,letterSpacing:'-0.02em'}}>CLIENTES</div>
            <div style={{fontSize:10,color:S.t3,letterSpacing:'.1em',textTransform:'uppercase' as const}}>CIM™ — Customer Intelligence</div>
          </div>
        </div>
        {/* Buscar */}
        <div style={{position:'relative',flex:1,maxWidth:320}}>
          <input placeholder="🔍 Buscar por nombre, teléfono, email..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}
            style={{...inp,padding:'8px 14px',fontSize:12}} />
          {busqueda && <button onClick={()=>setBusqueda('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:S.t3,cursor:'pointer'}}>✕</button>}
        </div>
        {/* Ordenar */}
        <select value={ordenar} onChange={e=>setOrdenar(e.target.value)} style={{...inp,width:'auto',padding:'8px 12px',fontSize:12,cursor:'pointer'}}>
          <option value="total_visits">Por visitas</option>
          <option value="total_spent">Por gasto</option>
          <option value="score">Por score</option>
          <option value="ultima_visita">Última visita</option>
          <option value="created_at">Más nuevos</option>
        </select>
        <button onClick={()=>{ setForm({tipo_documento:'CC',origen_captacion:'walk-in',activo:true}); setCtab('nuevo'); }}
          style={{padding:'9px 20px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.pink},#cc2260)`,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
          + Nuevo cliente
        </button>
      </div>

      {/* KPIs */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,flexShrink:0,background:S.bg2}}>
        {kpis.map((k,i)=>(
          <div key={k.l} style={{flex:1,padding:'10px 16px',borderRight:i<kpis.length-1?`1px solid ${S.border}`:'none',cursor:'pointer'}}
            onClick={()=>{
              if(k.l==='VIP')setSegmento('vip');
              else if(k.l==='Recurrentes')setSegmento('recurrentes');
              else if(k.l==='Dormidos')setSegmento('dormidos');
              else setSegmento('todos');
            }}>
            <div style={{fontSize:9,color:S.t3,textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:3}}>{k.l}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:k.c}}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,flexShrink:0,background:S.bg2,padding:'0 24px'}}>
        {([
          {id:'lista',    l:'📋 Lista'},
          {id:'perfil',   l:'👤 Perfil', hide:!selected},
          {id:'analytics',l:'📊 Analytics'},
          {id:'importar', l:'📥 Importar CSV'},
          {id:'nuevo',    l:'✦ Nuevo'},
        ] as const).filter(t=>!('hide' in t && t.hide)).map(t=>(
          <button key={t.id} onClick={()=>setCtab(t.id)}
            style={{padding:'10px 16px',background:'none',border:'none',borderBottom:`2px solid ${ctab===t.id?S.pink:'transparent'}`,color:ctab===t.id?S.pink:S.t3,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s'}}>
            {t.l}
          </button>
        ))}
        {/* Segmento filtro */}
        <div style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center',paddingBottom:4}}>
          {(['todos','vip','recurrentes','nuevos','dormidos'] as Segmento[]).map(s=>{
            const lbl = {todos:'Todos',vip:'⭐ VIP',recurrentes:'🔄 Recurrentes',nuevos:'🆕 Nuevos',dormidos:'💤 Dormidos'}[s];
            const col = {todos:S.t3,vip:S.gold,recurrentes:S.green,nuevos:S.blue,dormidos:S.red}[s];
            return (
              <button key={s} onClick={()=>setSegmento(s)}
                style={{padding:'4px 12px',borderRadius:50,border:`1px solid ${segmento===s?col:S.border}`,background:segmento===s?`${col}15`:'transparent',color:segmento===s?col:S.t3,fontSize:10,fontWeight:700,cursor:'pointer',transition:'all .15s'}}>
                {lbl}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ CONTENIDO ══ */}
      <div style={{flex:1,overflow:'hidden'}}>

        {/* ── LISTA ── */}
        {ctab==='lista' && (
          <div style={{height:'100%',overflowY:'auto'}}>
            {loading && <div style={{padding:40,textAlign:'center',color:S.t3}}>Cargando clientes...</div>}
            {!loading && filtrados.length===0 && (
              <div style={{textAlign:'center',padding:60,color:S.t3}}>
                <div style={{fontSize:40,marginBottom:12}}>👥</div>
                <div style={{fontSize:15,fontWeight:700}}>Sin clientes {segmento!=='todos'?`en "${segmento}"`:''}</div>
              </div>
            )}
            {!loading && filtrados.length>0 && (
              <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:13}}>
                <thead>
                  <tr style={{background:S.bg2,position:'sticky',top:0,zIndex:5}}>
                    {['Cliente','Contacto','Score','Segmento','Visitas','Gasto total','Ticket prom.','Última visita','Puntos','Alergias / Prefs','Origen','Acciones'].map(h=>(
                      <th key={h} style={{padding:'10px 14px',textAlign:'left' as const,fontSize:10,color:S.t3,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.06em',borderBottom:`1px solid ${S.border}`,whiteSpace:'nowrap'}}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((cliente,i)=>{
                    const seg = segmentar(cliente);
                    const segColor = {vip:S.gold,recurrentes:S.green,nuevos:S.blue,dormidos:S.red}[seg]||S.t3;
                    const segLabel = {vip:'⭐ VIP',recurrentes:'🔄 Recurrente',nuevos:'🆕 Nuevo',dormidos:'💤 Dormido'}[seg]||seg;
                    const sc = cliente.score||0;
                    const diasInactivo = cliente.ultima_visita ? Math.floor((Date.now()-new Date(cliente.ultima_visita).getTime())/86400000) : null;
                    return (
                      <tr key={cliente.id}
                        style={{background:i%2===0?S.bg:S.bg2,borderBottom:`1px solid rgba(255,255,255,0.04)`,cursor:'pointer',transition:'background .15s'}}
                        onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background=`${S.pink}08`}
                        onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=i%2===0?S.bg:S.bg2}>

                        {/* Cliente — nombre + avatar */}
                        <td style={{padding:'11px 14px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <div style={{width:36,height:36,borderRadius:'50%',background:`linear-gradient(135deg,${S.pink}40,${S.purple}40)`,border:`2px solid ${cliente.vip_status?S.gold:S.border2}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900,flexShrink:0}}>
                              {iniciales(cliente.name,cliente.apellido)}
                            </div>
                            <div>
                              <div style={{fontSize:13,fontWeight:700,color:S.t1,display:'flex',alignItems:'center',gap:5}}>
                                {cliente.name} {cliente.apellido||''}
                                {cliente.vip_status && <span style={{fontSize:10}}>⭐</span>}
                                {!cliente.activo && <span style={{fontSize:9,color:S.red,background:`${S.red}15`,padding:'1px 6px',borderRadius:10}}>Inactivo</span>}
                              </div>
                              {cliente.ciudad && <div style={{fontSize:10,color:S.t3}}>📍 {cliente.ciudad}</div>}
                              {cliente.fecha_nacimiento && (() => {
                                const hoy = new Date();
                                const nac = new Date(cliente.fecha_nacimiento+'T00:00:00');
                                const esCumple = nac.getDate()===hoy.getDate()&&nac.getMonth()===hoy.getMonth();
                                return esCumple ? <div style={{fontSize:10,color:S.gold}}>🎂 ¡Cumpleaños hoy!</div> : null;
                              })()}
                            </div>
                          </div>
                        </td>

                        {/* Contacto */}
                        <td style={{padding:'11px 14px'}}>
                          <div style={{display:'flex',flexDirection:'column',gap:3}}>
                            {cliente.phone && (
                              <a href={`https://wa.me/${cliente.phone.replace(/\D/g,'')}`} target="_blank" onClick={e=>e.stopPropagation()}
                                style={{fontSize:11,color:S.green,textDecoration:'none',display:'flex',alignItems:'center',gap:4}}>
                                💬 {cliente.phone}
                              </a>
                            )}
                            {cliente.email && <div style={{fontSize:11,color:S.t3,overflow:'hidden',textOverflow:'ellipsis',maxWidth:160}}>✉ {cliente.email}</div>}
                          </div>
                        </td>

                        {/* Score */}
                        <td style={{padding:'11px 14px'}}>
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                            <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:scoreColor(sc)}}>{sc}</div>
                            <div style={{width:40,height:3,background:S.bg4,borderRadius:2,overflow:'hidden'}}>
                              <div style={{height:'100%',background:scoreColor(sc),width:`${Math.min(sc,100)}%`}}/>
                            </div>
                            <div style={{fontSize:9,color:scoreColor(sc),fontWeight:700}}>{scoreLabel(sc)}</div>
                          </div>
                        </td>

                        {/* Segmento */}
                        <td style={{padding:'11px 14px'}}>
                          <span style={{fontSize:10,background:`${segColor}15`,color:segColor,border:`1px solid ${segColor}30`,padding:'3px 10px',borderRadius:50,fontWeight:700,whiteSpace:'nowrap'}}>
                            {segLabel}
                          </span>
                        </td>

                        {/* Visitas */}
                        <td style={{padding:'11px 14px',textAlign:'center' as const}}>
                          <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:S.blue}}>{cliente.total_visits||0}</div>
                          <div style={{fontSize:9,color:S.t3}}>visitas</div>
                        </td>

                        {/* Gasto total */}
                        <td style={{padding:'11px 14px'}}>
                          <div style={{fontSize:13,fontWeight:700,color:S.gold}}>{fmtMoney(cliente.total_spent)}</div>
                        </td>

                        {/* Ticket promedio */}
                        <td style={{padding:'11px 14px'}}>
                          <div style={{fontSize:13,fontWeight:700,color:S.purple}}>{fmtMoney(cliente.promedio_ticket)}</div>
                        </td>

                        {/* Última visita */}
                        <td style={{padding:'11px 14px'}}>
                          <div style={{fontSize:12,color:diasInactivo&&diasInactivo>60?S.red:S.t2}}>
                            {formatFecha(cliente.ultima_visita)}
                          </div>
                          {diasInactivo!==null && (
                            <div style={{fontSize:9,color:diasInactivo>60?S.red:diasInactivo>30?S.gold:S.green}}>
                              {diasInactivo===0?'Hoy':diasInactivo===1?'Ayer':`Hace ${diasInactivo}d`}
                            </div>
                          )}
                        </td>

                        {/* Puntos */}
                        <td style={{padding:'11px 14px',textAlign:'center' as const}}>
                          <div style={{fontSize:13,fontWeight:700,color:S.purple}}>✦ {cliente.puntos||0}</div>
                          <div style={{fontSize:9,color:S.t3}}>pts</div>
                        </td>

                        {/* Alergias / Preferencias */}
                        <td style={{padding:'11px 14px',maxWidth:180}}>
                          <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                            {cliente.alergias?.slice(0,2).map(a=>(
                              <span key={a} style={{fontSize:9,background:`${S.red}15`,color:S.red,padding:'1px 6px',borderRadius:10,fontWeight:700}}>⚠ {a}</span>
                            ))}
                            {cliente.preferencias?.slice(0,2).map(p=>(
                              <span key={p} style={{fontSize:9,background:`${S.green}10`,color:S.green,padding:'1px 6px',borderRadius:10}}>✓ {p}</span>
                            ))}
                            {(cliente.alergias?.length||0)+(cliente.preferencias?.length||0)>4 && (
                              <span style={{fontSize:9,color:S.t3}}>+{(cliente.alergias?.length||0)+(cliente.preferencias?.length||0)-4}</span>
                            )}
                          </div>
                          {/* Tags */}
                          <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:3}}>
                            {cliente.tags?.slice(0,2).map(t=>(
                              <span key={t} style={{fontSize:9,background:`${S.purple}10`,color:S.purple,padding:'1px 6px',borderRadius:10}}>#{t}</span>
                            ))}
                          </div>
                        </td>

                        {/* Origen */}
                        <td style={{padding:'11px 14px'}}>
                          <span style={{fontSize:10,color:S.t2,background:S.bg3,padding:'3px 8px',borderRadius:8}}>
                            {cliente.origen_captacion||'—'}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td style={{padding:'11px 14px'}}>
                          <div style={{display:'flex',gap:6}}>
                            <button onClick={()=>abrirPerfil(cliente)}
                              style={{padding:'5px 12px',borderRadius:8,border:`1px solid ${S.pink}40`,background:`${S.pink}10`,color:S.pink,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                              Ver perfil
                            </button>
                            {cliente.phone && (
                              <a href={`https://wa.me/${cliente.phone.replace(/\D/g,'')}`} target="_blank"
                                style={{padding:'5px 10px',borderRadius:8,border:`1px solid ${S.green}40`,background:`${S.green}08`,color:S.green,fontSize:11,fontWeight:700,textDecoration:'none'}}>
                                💬
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── PERFIL ── */}
        {ctab==='perfil' && selected && (
          <div style={{height:'100%',overflowY:'auto',padding:24}}>
            <div style={{display:'grid',gridTemplateColumns:'340px 1fr',gap:20,alignItems:'start'}}>

              {/* Columna izquierda */}
              <div style={{display:'flex',flexDirection:'column',gap:14}}>

                {/* Card principal */}
                <div style={{background:S.bg2,border:`1px solid ${S.border2}`,borderRadius:18,overflow:'hidden'}}>
                  <div style={{background:`linear-gradient(135deg,${S.pink}30,${S.purple}20)`,padding:'24px 20px',textAlign:'center'}}>
                    <div style={{width:72,height:72,borderRadius:'50%',background:`linear-gradient(135deg,${S.pink},${S.purple})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:900,margin:'0 auto 12px',border:`3px solid ${selected.vip_status?S.gold:S.border2}`}}>
                      {iniciales(selected.name,selected.apellido)}
                    </div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900}}>
                      {selected.name} {selected.apellido||''}
                      {selected.vip_status && <span style={{marginLeft:6}}>⭐</span>}
                    </div>
                    <div style={{fontSize:12,color:S.t3,marginTop:4}}>{selected.ciudad||'Sin ciudad'} · {selected.origen_captacion||'—'}</div>
                    {/* Score grande */}
                    <div style={{marginTop:14,display:'flex',alignItems:'center',justifyContent:'center',gap:12}}>
                      <div style={{textAlign:'center'}}>
                        <div style={{fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:900,color:scoreColor(selected.score||0)}}>{selected.score||0}</div>
                        <div style={{fontSize:10,color:scoreColor(selected.score||0),fontWeight:700}}>{scoreLabel(selected.score||0)}</div>
                      </div>
                      <div style={{width:1,height:40,background:S.border}}/>
                      <div style={{textAlign:'center'}}>
                        <div style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:900,color:S.purple}}>✦ {selected.puntos||0}</div>
                        <div style={{fontSize:10,color:S.t3}}>puntos</div>
                      </div>
                    </div>
                  </div>
                  <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:10}}>
                    {[
                      {l:'Teléfono', v:selected.phone, icon:'📱'},
                      {l:'Email', v:selected.email, icon:'✉️'},
                      {l:'Documento', v:selected.documento?`${selected.tipo_documento}: ${selected.documento}`:null, icon:'🪪'},
                      {l:'Cumpleaños', v:formatFecha(selected.fecha_nacimiento), icon:'🎂'},
                      {l:'Canal', v:selected.canal_preferido, icon:'📡'},
                    ].filter(x=>x.v&&x.v!=='—').map(x=>(
                      <div key={x.l} style={{display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:14}}>{x.icon}</span>
                        <div>
                          <div style={{fontSize:9,color:S.t3,textTransform:'uppercase' as const,letterSpacing:'.06em'}}>{x.l}</div>
                          <div style={{fontSize:12,color:S.t1}}>{x.v}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stats financieros */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
                  <div style={{fontSize:11,color:S.gold,fontWeight:700,marginBottom:12,textTransform:'uppercase' as const}}>💰 Financiero</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {[
                      {l:'Visitas',       v:selected.total_visits||0,         c:S.blue,   suf:''},
                      {l:'Gasto total',   v:fmtMoney(selected.total_spent),   c:S.gold,   suf:''},
                      {l:'Ticket prom.',  v:fmtMoney(selected.promedio_ticket),c:S.purple, suf:''},
                      {l:'Última visita', v:formatFecha(selected.ultima_visita),c:S.t2,   suf:''},
                    ].map(m=>(
                      <div key={m.l} style={{background:S.bg3,borderRadius:10,padding:'10px 12px'}}>
                        <div style={{fontSize:9,color:S.t3,marginBottom:3,textTransform:'uppercase' as const}}>{m.l}</div>
                        <div style={{fontSize:14,fontWeight:700,color:m.c}}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alergias */}
                {(selected.alergias?.length||0)>0 && (
                  <div style={{background:`${S.red}08`,border:`1px solid ${S.red}30`,borderRadius:14,padding:14}}>
                    <div style={{fontSize:11,color:S.red,fontWeight:700,marginBottom:8}}>⚠️ ALERGIAS — Avisar a cocina</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {selected.alergias!.map(a=>(
                        <span key={a} style={{fontSize:11,background:`${S.red}20`,color:S.red,border:`1px solid ${S.red}40`,padding:'3px 10px',borderRadius:50,fontWeight:700}}>{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preferencias */}
                {(selected.preferencias?.length||0)>0 && (
                  <div style={{background:`${S.green}08`,border:`1px solid ${S.green}20`,borderRadius:14,padding:14}}>
                    <div style={{fontSize:11,color:S.green,fontWeight:700,marginBottom:8}}>✓ Preferencias</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {selected.preferencias!.map(p=>(
                        <span key={p} style={{fontSize:11,background:`${S.green}15`,color:S.green,padding:'3px 10px',borderRadius:50}}>{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {(selected.tags?.length||0)>0 && (
                  <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:14}}>
                    <div style={{fontSize:11,color:S.purple,fontWeight:700,marginBottom:8}}># Tags CIM</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {selected.tags!.map(t=>(
                        <span key={t} style={{fontSize:11,background:`${S.purple}15`,color:S.purple,padding:'3px 10px',borderRadius:50}}>#{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botones */}
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>{ setEditMode(true); setCtab('nuevo'); }}
                    style={{flex:1,padding:11,borderRadius:10,border:`1px solid ${S.border2}`,background:'transparent',color:S.t2,cursor:'pointer',fontSize:12,fontWeight:700}}>
                    ✏️ Editar
                  </button>
                  <button onClick={()=>setCtab('lista')}
                    style={{flex:1,padding:11,borderRadius:10,border:`1px solid ${S.border}`,background:'transparent',color:S.t3,cursor:'pointer',fontSize:12}}>
                    ← Lista
                  </button>
                </div>
              </div>

              {/* Columna derecha */}
              <div style={{display:'flex',flexDirection:'column',gap:14}}>

                {/* Ocasiones especiales */}
                {(selected.ocasiones_especiales?.length||0)>0 && (
                  <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
                    <div style={{fontSize:11,color:S.gold,fontWeight:700,marginBottom:12,textTransform:'uppercase' as const}}>🎉 Ocasiones especiales</div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {selected.ocasiones_especiales!.map((o:any,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:S.bg3,borderRadius:10}}>
                          <span style={{fontSize:16}}>{o.tipo==='Cumpleaños'?'🎂':o.tipo==='Aniversario'?'💑':'🎉'}</span>
                          <div>
                            <div style={{fontSize:12,fontWeight:700}}>{o.tipo}</div>
                            {o.fecha && <div style={{fontSize:11,color:S.t3}}>{formatFecha(o.fecha)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historial de notas */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
                  <div style={{fontSize:11,color:S.t2,fontWeight:700,marginBottom:12,textTransform:'uppercase' as const}}>📝 Notas del equipo</div>
                  <div style={{display:'flex',gap:8,marginBottom:12}}>
                    <input value={nuevaNota} onChange={e=>setNuevaNota(e.target.value)}
                      placeholder="Agregar nota..."
                      onKeyDown={e=>e.key==='Enter'&&agregarNota()}
                      style={{...inp,fontSize:12,padding:'8px 12px'}}/>
                    <button onClick={agregarNota}
                      style={{padding:'8px 16px',borderRadius:8,border:'none',background:S.pink,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                      + Nota
                    </button>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:280,overflowY:'auto'}}>
                    {(selected.historial_notas||[]).length===0 && (
                      <div style={{fontSize:12,color:S.t3,textAlign:'center',padding:'16px 0'}}>Sin notas aún</div>
                    )}
                    {[...(selected.historial_notas||[])].reverse().map((n:any,i)=>(
                      <div key={i} style={{background:S.bg3,borderRadius:10,padding:'10px 14px'}}>
                        <div style={{fontSize:12,color:S.t1,lineHeight:1.5}}>{n.nota}</div>
                        <div style={{fontSize:10,color:S.t3,marginTop:4}}>{n.autor||'Staff'} · {formatFecha(n.fecha)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notas generales */}
                {selected.notes && (
                  <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
                    <div style={{fontSize:11,color:S.t3,fontWeight:700,marginBottom:8}}>💬 Observaciones</div>
                    <div style={{fontSize:13,color:S.t2,lineHeight:1.6}}>{selected.notes}</div>
                  </div>
                )}

                {/* Insights IA */}
                <div style={{background:`linear-gradient(135deg,${S.pink}08,${S.purple}05)`,border:`1px solid ${S.pink}20`,borderRadius:14,padding:16}}>
                  <div style={{fontSize:11,color:S.pink,fontWeight:700,marginBottom:12,display:'flex',alignItems:'center',gap:6}}>
                    <span>✦</span> Insights CIM™
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {/* Insight automático por datos */}
                    {(selected.total_visits||0)>=10 && (
                      <div style={{fontSize:12,color:S.t2,background:S.bg3,borderRadius:8,padding:'8px 12px'}}>
                        🏆 Cliente embajador con {selected.total_visits} visitas — prioridad máxima de atención.
                      </div>
                    )}
                    {(selected.promedio_ticket||0)>150000 && (
                      <div style={{fontSize:12,color:S.t2,background:S.bg3,borderRadius:8,padding:'8px 12px'}}>
                        💰 Alto valor — ticket promedio {fmtMoney(selected.promedio_ticket)}. Ofrecer experiencias premium.
                      </div>
                    )}
                    {(selected.alergias?.length||0)>0 && (
                      <div style={{fontSize:12,color:S.red,background:`${S.red}08`,border:`1px solid ${S.red}20`,borderRadius:8,padding:'8px 12px'}}>
                        ⚠️ CRÍTICO: Tiene {selected.alergias!.length} alergia(s). Notificar cocina antes del servicio.
                      </div>
                    )}
                    {(() => {
                      const dias = selected.ultima_visita ? Math.floor((Date.now()-new Date(selected.ultima_visita).getTime())/86400000) : null;
                      if (dias!==null && dias>60) return (
                        <div style={{fontSize:12,color:S.gold,background:`${S.gold}08`,borderRadius:8,padding:'8px 12px'}}>
                          💤 Inactivo hace {dias} días. Considerar campaña de reactivación personalizada.
                        </div>
                      );
                      return null;
                    })()}
                    {(selected.puntos||0)>50 && (
                      <div style={{fontSize:12,color:S.purple,background:`${S.purple}08`,borderRadius:8,padding:'8px 12px'}}>
                        ✦ Tiene {selected.puntos} puntos acumulados — candidato a canjear beneficio Oh Yeah.
                      </div>
                    )}
                    {!(selected.total_visits||0) && !(selected.promedio_ticket||0) && !(selected.alergias?.length) && (
                      <div style={{fontSize:12,color:S.t3,textAlign:'center',padding:'8px 0'}}>Agrega visitas y datos para generar insights.</div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ── NUEVO / EDITAR ── */}
        {ctab==='nuevo' && (
          <div style={{height:'100%',overflowY:'auto',padding:24}}>
            <div style={{maxWidth:720,margin:'0 auto'}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,marginBottom:20}}>
                {editMode?'Editar cliente':'Nuevo cliente'}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                {[
                  {k:'name',l:'Nombre *'},{k:'apellido',l:'Apellido'},
                  {k:'phone',l:'Teléfono/WhatsApp'},{k:'email',l:'Email'},
                  {k:'ciudad',l:'Ciudad'},{k:'documento',l:'Documento'},
                ].map(f=>(
                  <div key={f.k}>
                    <div style={{fontSize:10,color:S.t3,marginBottom:4}}>{f.l}</div>
                    <input style={inp} value={(form as any)[f.k]||''} onChange={e=>setF(f.k,e.target.value)}/>
                  </div>
                ))}
                <div>
                  <div style={{fontSize:10,color:S.t3,marginBottom:4}}>Tipo doc.</div>
                  <select style={inp} value={form.tipo_documento||'CC'} onChange={e=>setF('tipo_documento',e.target.value)}>
                    {['CC','NIT','CE','Pasaporte'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,color:S.t3,marginBottom:4}}>Origen captación</div>
                  <select style={inp} value={form.origen_captacion||'walk-in'} onChange={e=>setF('origen_captacion',e.target.value)}>
                    {CANALES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,color:S.t3,marginBottom:4}}>Canal preferido</div>
                  <select style={inp} value={form.canal_preferido||''} onChange={e=>setF('canal_preferido',e.target.value)}>
                    <option value="">Sin preferencia</option>
                    {CANALES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,color:S.t3,marginBottom:4}}>Fecha de nacimiento</div>
                  <input type="date" style={inp} value={form.fecha_nacimiento||''} onChange={e=>setF('fecha_nacimiento',e.target.value)}/>
                </div>
              </div>
              {/* Alergias */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,color:S.red,fontWeight:700,marginBottom:8}}>⚠️ Alergias</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {ALERGIAS_PRESET.map(a=>{
                    const sel=(form.alergias||[]).includes(a);
                    return <button key={a} onClick={()=>setF('alergias',sel?(form.alergias||[]).filter((x:string)=>x!==a):[...(form.alergias||[]),a])}
                      style={{padding:'5px 12px',borderRadius:50,border:`1px solid ${sel?S.red:S.border}`,background:sel?`${S.red}15`:'transparent',color:sel?S.red:S.t3,fontSize:11,cursor:'pointer'}}>{a}</button>;
                  })}
                </div>
              </div>
              {/* Preferencias */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,color:S.green,fontWeight:700,marginBottom:8}}>✓ Preferencias</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {PREFS_PRESET.map(p=>{
                    const sel=(form.preferencias||[]).includes(p);
                    return <button key={p} onClick={()=>setF('preferencias',sel?(form.preferencias||[]).filter((x:string)=>x!==p):[...(form.preferencias||[]),p])}
                      style={{padding:'5px 12px',borderRadius:50,border:`1px solid ${sel?S.green:S.border}`,background:sel?`${S.green}10`:'transparent',color:sel?S.green:S.t3,fontSize:11,cursor:'pointer'}}>{p}</button>;
                  })}
                </div>
              </div>
              {/* Tags */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,color:S.purple,fontWeight:700,marginBottom:8}}># Tags</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
                  {TAGS_PRESET.map(t=>{
                    const sel=(form.tags||[]).includes(t);
                    return <button key={t} onClick={()=>setF('tags',sel?(form.tags||[]).filter((x:string)=>x!==t):[...(form.tags||[]),t])}
                      style={{padding:'5px 12px',borderRadius:50,border:`1px solid ${sel?S.purple:S.border}`,background:sel?`${S.purple}15`:'transparent',color:sel?S.purple:S.t3,fontSize:11,cursor:'pointer'}}>{t}</button>;
                  })}
                </div>
              </div>
              {/* VIP toggle */}
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20,padding:'12px 16px',background:S.bg2,borderRadius:12,border:`1px solid ${S.border}`}}>
                <input type="checkbox" checked={form.vip_status||false} onChange={e=>setF('vip_status',e.target.checked)} style={{width:16,height:16,cursor:'pointer'}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:S.gold}}>⭐ Cliente VIP</div>
                  <div style={{fontSize:11,color:S.t3}}>Atención prioritaria en todos los módulos</div>
                </div>
              </div>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setCtab(selected?'perfil':'lista')} style={{flex:1,padding:12,borderRadius:10,border:`1px solid ${S.border}`,background:'transparent',color:S.t3,cursor:'pointer',fontSize:13}}>Cancelar</button>
                <button onClick={guardar} style={{flex:2,padding:12,borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.pink},#cc2260)`,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700}}>
                  {editMode?'✓ Actualizar':'✓ Crear cliente'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {ctab==='analytics' && (
          <div style={{height:'100%',overflowY:'auto',padding:24}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
              {/* Top spenders */}
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:`1px solid ${S.border}`,fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900}}>🏆 Top por gasto</div>
                {clientes.sort((a,b)=>(b.total_spent||0)-(a.total_spent||0)).slice(0,8).map((c,i)=>(
                  <div key={c.id} style={{padding:'10px 16px',borderBottom:`1px solid rgba(255,255,255,0.03)`,display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}
                    onClick={()=>abrirPerfil(c)}>
                    <div style={{width:22,height:22,borderRadius:7,background:i===0?`${S.gold}20`:S.bg3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:i===0?S.gold:S.t3}}>{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700}}>{c.name} {c.apellido||''}</div>
                      <div style={{fontSize:10,color:S.t3}}>{c.total_visits||0} visitas</div>
                    </div>
                    <div style={{fontSize:13,fontWeight:700,color:S.gold}}>{fmtMoney(c.total_spent)}</div>
                  </div>
                ))}
              </div>
              {/* Por segmento */}
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:`1px solid ${S.border}`,fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900}}>📊 Por segmento</div>
                <div style={{padding:16,display:'flex',flexDirection:'column',gap:10}}>
                  {([['vip','⭐ VIP',S.gold],['recurrentes','🔄 Recurrentes',S.green],['nuevos','🆕 Nuevos',S.blue],['dormidos','💤 Dormidos',S.red]] as const).map(([seg,lbl,col])=>{
                    const cnt = clientes.filter(c=>segmentar(c)===seg).length;
                    const pct = clientes.length ? Math.round(cnt/clientes.length*100) : 0;
                    return (
                      <div key={seg}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}>
                          <span style={{color:col}}>{lbl}</span>
                          <span style={{fontWeight:700}}>{cnt} ({pct}%)</span>
                        </div>
                        <div style={{height:6,background:S.bg4,borderRadius:3,overflow:'hidden'}}>
                          <div style={{height:'100%',background:col,width:`${pct}%`,borderRadius:3}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Por origen */}
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:`1px solid ${S.border}`,fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900}}>📡 Por origen</div>
                <div style={{padding:16,display:'flex',flexDirection:'column',gap:8}}>
                  {Object.entries(clientes.reduce((acc:any,c)=>{ const k=c.origen_captacion||'desconocido'; acc[k]=(acc[k]||0)+1; return acc; },{})).sort(([,a]:any,[,b]:any)=>b-a).slice(0,6).map(([k,v]:any)=>(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',background:S.bg3,borderRadius:8}}>
                      <span style={{fontSize:11,color:S.t2}}>{k}</span>
                      <span style={{fontSize:13,fontWeight:700,color:S.blue}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── IMPORTAR CSV ── */}
        {ctab==='importar' && (
          <div style={{height:'100%',overflowY:'auto',padding:24}}>
            <div style={{maxWidth:700,margin:'0 auto'}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,marginBottom:20}}>📥 Importar CSV</div>
              <input type="file" accept=".csv" ref={fileRef} style={{display:'none'}}
                onChange={e=>{ const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>parseCsv(ev.target?.result as string); r.readAsText(f); }}/>
              {csvStep==='upload' && (
                <div style={{border:`2px dashed ${S.border2}`,borderRadius:16,padding:48,textAlign:'center',cursor:'pointer'}} onClick={()=>fileRef.current?.click()}>
                  <div style={{fontSize:40,marginBottom:12}}>📁</div>
                  <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>Arrastra tu CSV o haz click</div>
                  <div style={{fontSize:12,color:S.t3}}>Columnas: nombre, apellido, teléfono, email, ciudad...</div>
                </div>
              )}
              {csvStep==='map' && (
                <div>
                  <div style={{fontSize:13,color:S.t2,marginBottom:16}}>{csvRows.length} filas detectadas. Mapea las columnas:</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
                    {csvHeaders.map(h=>(
                      <div key={h}>
                        <div style={{fontSize:10,color:S.t3,marginBottom:4}}>{h}</div>
                        <select style={inp} value={csvMapping[h]||''} onChange={e=>setCsvMapping(p=>({...p,[h]:e.target.value}))}>
                          <option value="">No importar</option>
                          {['name','apellido','phone','email','ciudad','documento','origen_captacion','notas'].map(f=><option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>{
                    const prev=csvRows.slice(0,5).map(row=>{ const obj:any={}; Object.entries(csvMapping).forEach(([k,v])=>{ if(v)obj[v]=row[k]; }); return obj; });
                    setCsvPreview(csvRows.map(row=>{ const obj:any={}; Object.entries(csvMapping).forEach(([k,v])=>{ if(v)obj[v]=row[k]; }); return obj; }));
                    setCsvStep('preview');
                  }} style={{padding:'11px 32px',borderRadius:10,border:'none',background:S.pink,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                    Vista previa →
                  </button>
                </div>
              )}
              {csvStep==='preview' && (
                <div>
                  <div style={{fontSize:13,color:S.t2,marginBottom:12}}>Vista previa — {csvPreview.length} clientes a importar</div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,marginBottom:20}}>
                    <thead><tr>{Object.keys(csvPreview[0]||{}).map(k=><th key={k} style={{padding:'8px',textAlign:'left',color:S.t3,fontSize:10,borderBottom:`1px solid ${S.border}`}}>{k}</th>)}</tr></thead>
                    <tbody>{csvPreview.slice(0,5).map((r,i)=><tr key={i}>{Object.values(r).map((v:any,j)=><td key={j} style={{padding:'8px',color:S.t2,borderBottom:`1px solid rgba(255,255,255,0.03)`}}>{v}</td>)}</tr>)}</tbody>
                  </table>
                  <div style={{display:'flex',gap:10}}>
                    <button onClick={()=>setCsvStep('map')} style={{flex:1,padding:11,borderRadius:10,border:`1px solid ${S.border}`,background:'transparent',color:S.t3,cursor:'pointer',fontSize:13}}>← Volver</button>
                    <button onClick={importarCsv} disabled={csvImporting}
                      style={{flex:2,padding:11,borderRadius:10,border:'none',background:S.green,color:'#000',cursor:'pointer',fontSize:13,fontWeight:700}}>
                      {csvImporting?'Importando...':'✓ Importar todos'}
                    </button>
                  </div>
                </div>
              )}
              {csvStep==='done' && (
                <div style={{textAlign:'center',padding:40}}>
                  <div style={{fontSize:48,marginBottom:16}}>🎉</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,marginBottom:8}}>¡Importación completada!</div>
                  <div style={{fontSize:14,color:S.t2,marginBottom:24}}>✓ {csvResultado.ok} importados · {csvResultado.err} errores</div>
                  <button onClick={()=>{ setCsvStep('upload'); setCsvRows([]); fetchClientes(); setCtab('lista'); }}
                    style={{padding:'12px 32px',borderRadius:50,border:'none',background:S.pink,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                    Ver clientes
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
