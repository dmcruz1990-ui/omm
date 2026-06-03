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
type Segmento = 'todos' | 'ohyeah' | 'vip' | 'recurrentes' | 'nuevos' | 'dormidos';

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
const NIVEL_COLORS: Record<string,string> = { INICIADO:'#a0a0a0', REGULAR:'#448AFF', VIP:'#B388FF', CONSAGRADO:'#FF6B00', ÉLITE:'#FFD700' };
const NIVEL_EMOJI: Record<string,string>  = { INICIADO:'⭐', REGULAR:'🌟', VIP:'💎', CONSAGRADO:'🔥', ÉLITE:'👑' };

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
  const [csvRows, setCsvRows]           = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders]     = useState<string[]>([]);
  const [csvMapping, setCsvMapping]     = useState<Record<string,string>>({});
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvPreview, setCsvPreview]     = useState<any[]>([]);
  const [csvStep, setCsvStep]           = useState<'upload'|'map'|'preview'|'done'>('upload');
  const [csvResultado, setCsvResultado] = useState({ok:0,err:0});
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((m:string)=>{ setToast(m); setTimeout(()=>setToast(''),3000); },[]);
  const setF = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  // ── Fetch clientes NEXUM + Oh Yeah mezclados ───────────────────────────
  const fetchClientes = useCallback(async () => {
    setLoading(true);
    // Clientes NEXUM existentes
    const { data: nexum } = await supabase.from('customers')
      .select('*').order(ordenar as any, {ascending:false});

    // Clientes Oh Yeah — se mapean al formato Customer
    const { data: ohyeah } = await supabase
      .from('nexum_clientes_ohyeah').select('*');

    const ohyeahMapped: Customer[] = (ohyeah||[]).map((cl:any) => ({
      id:               cl.id,
      name:             (cl.nombre||'').split(' ')[0],
      apellido:         (cl.nombre||'').split(' ').slice(1).join(' '),
      email:            cl.email,
      phone:            cl.telefono,
      ciudad:           cl.ciudad,
      total_visits:     cl.visitas || 0,
      created_at:       cl.registro_at,
      ultima_visita:    cl.ultima_reserva,
      origen_captacion: 'oh_yeah',
      vip_status:       ['ÉLITE','CONSAGRADO','VIP'].includes(cl.nivel||''),
      score:            cl.nivel==='ÉLITE'?95:cl.nivel==='CONSAGRADO'?80:cl.nivel==='VIP'?65:cl.nivel==='REGULAR'?40:15,
      tags:             cl.nivel ? [`${NIVEL_EMOJI[cl.nivel]||'⭐'} ${cl.nivel}`] : [],
      notes:            cl.notas || '',
      alergias:         cl.restricciones ? [cl.restricciones] : [],
      preferencias:     cl.preferencias ? [cl.preferencias] : [],
      activo:           true,
      canal_preferido:  'oh_yeah',
      puntos:           (cl.visitas||0) * 50,
    }));

    // No duplicar — si un email de Oh Yeah ya existe en NEXUM, omitir
    const nexumEmails = new Set((nexum||[]).map((n:any) => n.email).filter(Boolean));
    const ohyeahFiltrado = ohyeahMapped.filter(cl => !cl.email || !nexumEmails.has(cl.email));

    // Calificaciones agregadas por cliente (de las encuestas X-CARE)
    const { data: enc } = await supabase.from('xcare_encuestas')
      .select('customer_id,cliente_id,ohyeah_cliente_id,estrellas,estrellas_comida,estrellas_servicio,estrellas_ambiente,created_at')
      .order('created_at', { ascending:false });
    const ratingsById: Record<string, { sum:number; n:number; ult:number; ultimas3:number[] }> = {};
    (enc||[]).forEach((e:any) => {
      // El promedio usa la nota general si existe; si no, hace media de las 3 dimensiones
      const dims = [e.estrellas_comida, e.estrellas_servicio, e.estrellas_ambiente].filter((x:any)=>x!=null);
      const nota = e.estrellas ?? (dims.length ? dims.reduce((s:number,d:number)=>s+d,0)/dims.length : null);
      if (nota == null) return;
      const id = String(e.customer_id || e.cliente_id || e.ohyeah_cliente_id || '');
      if (!id) return;
      if (!ratingsById[id]) ratingsById[id] = { sum:0, n:0, ult:0, ultimas3:[] };
      ratingsById[id].sum += Number(nota);
      ratingsById[id].n += 1;
      if (ratingsById[id].ultimas3.length === 0) ratingsById[id].ult = Number(nota);
      if (ratingsById[id].ultimas3.length < 3) ratingsById[id].ultimas3.push(Math.round(Number(nota)));
    });
    const aplicarRating = (cl:any) => {
      const r = ratingsById[String(cl.id)];
      return r ? { ...cl, rating_avg: r.sum / r.n, rating_count: r.n, rating_ult: r.ult, rating_ultimas3: r.ultimas3 } : cl;
    };

    // ── Tiempo "dentro del restaurante" — minutos sentado en este momento ──
    // Cruzamos reservaciones SENTADAS hoy con los clientes para mostrar live.
    const hoy = new Date().toISOString().split('T')[0];
    const { data: sentadas } = await supabase.from('reservations')
      .select('cliente_telefono,cliente_email,sentado_at,mesa_num,estado')
      .eq('estado','sentada').eq('fecha',hoy).not('sentado_at','is',null);
    const tiempoPorEmail: Record<string,{min:number;mesa:any}> = {};
    const tiempoPorTel: Record<string,{min:number;mesa:any}> = {};
    (sentadas||[]).forEach((r:any) => {
      const min = Math.max(0, Math.floor((Date.now()-new Date(r.sentado_at).getTime())/60000));
      if (r.cliente_email) tiempoPorEmail[String(r.cliente_email).toLowerCase()] = { min, mesa: r.mesa_num };
      if (r.cliente_telefono) tiempoPorTel[String(r.cliente_telefono).trim()] = { min, mesa: r.mesa_num };
    });
    const aplicarSentado = (cl:any) => {
      const e = cl.email ? tiempoPorEmail[String(cl.email).toLowerCase()] : null;
      const t = cl.phone ? tiempoPorTel[String(cl.phone).trim()] : null;
      const m = e || t;
      return m ? { ...cl, sentado_min: m.min, mesa_actual: m.mesa } : cl;
    };

    setClientes([
      ...((nexum||[]).map(aplicarRating).map(aplicarSentado)),
      ...ohyeahFiltrado.map(aplicarRating).map(aplicarSentado),
    ] as Customer[]);
    setLoading(false);
  }, [ordenar]);

  useEffect(()=>{
    fetchClientes();
    // Realtime — nuevo cliente de Oh Yeah aparece instantáneo en el CIM
    const ch = supabase.channel('cim-ohyeah-nuevos')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'ohyeah_clientes' },
        () => { fetchClientes(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  },[fetchClientes]);

  // ── Segmentos ─────────────────────────────────────────────────────────
  const segmentar = (c:Customer) => {
    if (c.vip_status) return 'vip';
    if ((c.total_visits||0) >= 5) return 'recurrentes';
    const dias = c.ultima_visita ? Math.floor((Date.now()-new Date(c.ultima_visita).getTime())/86400000) : 9999;
    if (dias > 60) return 'dormidos';
    return 'nuevos';
  };

  const filtrados = clientes.filter(c => {
    if (segmento === 'ohyeah' && c.origen_captacion !== 'oh_yeah') return false;
    if (segmento !== 'todos' && segmento !== 'ohyeah' && segmentar(c) !== segmento) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (c.name+' '+(c.apellido||'')+' '+(c.phone||'')+' '+(c.email||'')).toLowerCase().includes(q);
    }
    return true;
  });

  const kpis = [
    { l:'Total',       v:clientes.length,                                               c:S.blue   },
    { l:'Oh Yeah',     v:clientes.filter(c=>c.origen_captacion==='oh_yeah').length,     c:'#FFE600'},
    { l:'VIP',         v:clientes.filter(c=>c.vip_status).length,                       c:S.gold   },
    { l:'Recurrentes', v:clientes.filter(c=>segmentar(c)==='recurrentes').length,        c:S.green  },
    { l:'Dormidos',    v:clientes.filter(c=>segmentar(c)==='dormidos').length,           c:S.red    },
  ];

  // ── Guardar cliente ───────────────────────────────────────────────────
  const guardar = async () => {
    if (!form.name) { showToast('⚠️ Nombre requerido'); return; }
    if (selected && editMode) {
      if (selected.origen_captacion === 'oh_yeah') { showToast('⚠️ Cliente de Oh Yeah — solo lectura'); return; }
      const { error } = await supabase.from('customers').update(form).eq('id',selected.id);
      if (error) { showToast('✗ No se pudo actualizar: ' + error.message); return; }
      showToast('✓ Cliente actualizado');
    } else {
      const { error } = await supabase.from('customers').insert({ ...form, score:0, total_visits:0, total_spent:0, puntos:0 });
      if (error) { showToast('✗ No se pudo crear: ' + error.message); return; }
      showToast('✓ Cliente creado');
      setCtab('lista');
    }
    setEditMode(false); fetchClientes();
  };

  const agregarNota = async () => {
    if (!nuevaNota.trim() || !selected) return;
    if (selected.origen_captacion === 'oh_yeah') { showToast('⚠️ Cliente de Oh Yeah — solo lectura'); return; }
    const notas = selected.historial_notas || [];
    const { error } = await supabase.from('customers').update({ historial_notas:[...notas,{fecha:hoy(),nota:nuevaNota,autor:'Staff'}] }).eq('id',selected.id);
    if (error) { showToast('✗ No se pudo guardar la nota'); return; }
    showToast('✓ Nota agregada');
    setNuevaNota('');
    fetchClientes();
    setSelected(p=>p?({...p,historial_notas:[...(p.historial_notas||[]),{fecha:hoy(),nota:nuevaNota,autor:'Staff'}]}):p);
  };

  const abrirPerfil = (c:Customer) => {
    setSelected(c); setForm(c); setEditMode(false); setCtab('perfil');
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
        await supabase.from('customers').insert({ ...row, score:0, total_visits:0, puntos:0 });
        ok++;
      } catch { err++; }
    }
    setCsvResultado({ok,err}); setCsvStep('done'); setCsvImporting(false);
    showToast(`✓ ${ok} importados`); fetchClientes();
  };

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>

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
        <div style={{position:'relative',flex:1,maxWidth:320}}>
          <input placeholder="🔍 Buscar nombre, teléfono, email..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}
            style={{...inp,padding:'8px 14px',fontSize:12}} />
          {busqueda && <button onClick={()=>setBusqueda('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:S.t3,cursor:'pointer'}}>✕</button>}
        </div>
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
              if(k.l==='Oh Yeah')setSegmento('ohyeah');
              else if(k.l==='VIP')setSegmento('vip');
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
          {([
            {s:'todos',      l:'Todos',          c:S.t3},
            {s:'ohyeah',     l:'🦉 Oh Yeah',     c:'#FFE600'},
            {s:'vip',        l:'⭐ VIP',          c:S.gold},
            {s:'recurrentes',l:'🔄 Recurrentes',  c:S.green},
            {s:'nuevos',     l:'🆕 Nuevos',       c:S.blue},
            {s:'dormidos',   l:'💤 Dormidos',     c:S.red},
          ] as {s:Segmento,l:string,c:string}[]).map(({s,l,c})=>(
            <button key={s} onClick={()=>setSegmento(s)}
              style={{padding:'4px 12px',borderRadius:50,border:`1px solid ${segmento===s?c:S.border}`,background:segmento===s?`${c}15`:'transparent',color:segmento===s?c:S.t3,fontSize:10,fontWeight:700,cursor:'pointer',transition:'all .15s'}}>
              {l}
            </button>
          ))}
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
                    {['Cliente','Contacto','Sentado ahora','Score','Calificación','Segmento','Visitas','Gasto total','Ticket prom.','Última visita','Alergias','Preferencias','Origen · Últimas 3','Acciones'].map(h=>(
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
                    const esOhYeah = cliente.origen_captacion === 'oh_yeah';
                    const nivelTag = cliente.tags?.find(t=>Object.values(NIVEL_EMOJI).some(e=>t.includes(e)));
                    return (
                      <tr key={cliente.id}
                        style={{background:i%2===0?S.bg:S.bg2,borderBottom:`1px solid rgba(255,255,255,0.04)`,cursor:'pointer',transition:'background .15s'}}
                        onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background=`${S.pink}08`}
                        onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=i%2===0?S.bg:S.bg2}>

                        {/* Cliente */}
                        <td style={{padding:'11px 14px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <div style={{width:36,height:36,borderRadius:'50%',background:`linear-gradient(135deg,${S.pink}40,${S.purple}40)`,border:`2px solid ${cliente.vip_status?S.gold:S.border2}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900,flexShrink:0}}>
                              {iniciales(cliente.name,cliente.apellido)}
                            </div>
                            <div>
                              <div style={{fontSize:13,fontWeight:700,color:S.t1,display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                                {cliente.name} {cliente.apellido||''}
                                {cliente.vip_status && <span style={{fontSize:10}}>⭐</span>}
                                {esOhYeah && <span style={{fontSize:9,background:'rgba(255,230,0,0.12)',color:'#FFE600',border:'1px solid rgba(255,230,0,0.3)',padding:'1px 6px',borderRadius:10,fontWeight:700}}>🦉 Oh Yeah</span>}
                                {!cliente.activo && <span style={{fontSize:9,color:S.red,background:`${S.red}15`,padding:'1px 6px',borderRadius:10}}>Inactivo</span>}
                              </div>
                              {cliente.ciudad && <div style={{fontSize:10,color:S.t3}}>📍 {cliente.ciudad}</div>}
                              {nivelTag && esOhYeah && <div style={{fontSize:9,color:'#FFE600'}}>{nivelTag}</div>}
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

                        {/* Sentado ahora · tiempo en restaurante (live) */}
                        <td style={{padding:'11px 14px'}}>
                          {(cliente as any).sentado_min != null ? (
                            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                              <div style={{fontSize:18}}>🪑</div>
                              <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,color:(cliente as any).sentado_min>120?S.red:(cliente as any).sentado_min>90?S.gold:S.green,lineHeight:1}}>
                                {(cliente as any).sentado_min} min
                              </div>
                              {(cliente as any).mesa_actual && <div style={{fontSize:9,color:S.t3,fontWeight:700}}>M{(cliente as any).mesa_actual}</div>}
                            </div>
                          ) : (
                            <div style={{fontSize:10,color:S.t3,textAlign:'center'}}>—</div>
                          )}
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

                        {/* Calificación promedio de X-CARE */}
                        <td style={{padding:'11px 14px'}}>
                          {(() => {
                            const avg = (cliente as any).rating_avg;
                            const n = (cliente as any).rating_count || 0;
                            if (!avg || n === 0) {
                              return <div style={{fontSize:10,color:S.t3,textAlign:'center'}}>—</div>;
                            }
                            const color = avg>=4.5?S.green:avg>=3.5?S.gold:avg>=2?'#FF9800':S.red;
                            const fullStars = Math.round(avg);
                            return (
                              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                                <div style={{fontSize:11,letterSpacing:0.5}}>
                                  {Array.from({length:5}).map((_,k)=>(
                                    <span key={k} style={{color: k<fullStars?color:'rgba(255,255,255,0.15)'}}>★</span>
                                  ))}
                                </div>
                                <div style={{fontFamily:"'Syne',sans-serif",fontSize:12,fontWeight:900,color}}>{avg.toFixed(1)}</div>
                                <div style={{fontSize:9,color:S.t3}}>{n} {n===1?'encuesta':'encuestas'}</div>
                              </div>
                            );
                          })()}
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
                          <div style={{fontSize:12,color:diasInactivo&&diasInactivo>60?S.red:S.t2}}>{formatFecha(cliente.ultima_visita)}</div>
                          {diasInactivo!==null && (
                            <div style={{fontSize:9,color:diasInactivo>60?S.red:diasInactivo>30?S.gold:S.green}}>
                              {diasInactivo===0?'Hoy':diasInactivo===1?'Ayer':`Hace ${diasInactivo}d`}
                            </div>
                          )}
                        </td>

                        {/* Alergias */}
                        <td style={{padding:'11px 14px',maxWidth:140}}>
                          {cliente.alergias?.length ? (
                            <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                              {cliente.alergias.slice(0,3).map(a=>(
                                <span key={a} style={{fontSize:9,background:`${S.red}15`,color:S.red,padding:'2px 7px',borderRadius:10,fontWeight:700}}>⚠ {a}</span>
                              ))}
                            </div>
                          ) : <span style={{fontSize:10,color:S.t3}}>—</span>}
                        </td>

                        {/* Preferencias */}
                        <td style={{padding:'11px 14px',maxWidth:140}}>
                          {cliente.preferencias?.length ? (
                            <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                              {cliente.preferencias.slice(0,3).map(p=>(
                                <span key={p} style={{fontSize:9,background:`${S.green}10`,color:S.green,padding:'2px 7px',borderRadius:10}}>✓ {p}</span>
                              ))}
                            </div>
                          ) : <span style={{fontSize:10,color:S.t3}}>—</span>}
                        </td>

                        {/* Origen + Últimas 3 calificaciones */}
                        <td style={{padding:'11px 14px'}}>
                          <div style={{display:'flex',flexDirection:'column',gap:4}}>
                            {esOhYeah ? (
                              <span style={{fontSize:10,color:'#FFE600',background:'rgba(255,230,0,0.1)',border:'1px solid rgba(255,230,0,0.25)',padding:'3px 8px',borderRadius:8,fontWeight:700,alignSelf:'flex-start'}}>
                                🦉 Oh Yeah
                              </span>
                            ) : (
                              <span style={{fontSize:10,color:S.t2,background:S.bg3,padding:'3px 8px',borderRadius:8,alignSelf:'flex-start'}}>
                                {cliente.origen_captacion||'—'}
                              </span>
                            )}
                            {(cliente as any).rating_ultimas3?.length > 0 && (
                              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                                {(cliente as any).rating_ultimas3.map((n:number,k:number)=>{
                                  const col = n>=4?S.green:n>=3?S.gold:S.red;
                                  return (
                                    <span key={k} title={`Visita ${k+1}: ${n}★`} style={{fontSize:11,color:col,fontWeight:800,letterSpacing:0}}>
                                      {'★'.repeat(n)}{'☆'.repeat(Math.max(0,5-n))}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
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
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div style={{background:S.bg2,border:`1px solid ${S.border2}`,borderRadius:18,overflow:'hidden'}}>
                  <div style={{background:`linear-gradient(135deg,${S.pink}30,${S.purple}20)`,padding:'24px 20px',textAlign:'center'}}>
                    <div style={{width:72,height:72,borderRadius:'50%',background:`linear-gradient(135deg,${S.pink},${S.purple})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:900,margin:'0 auto 12px',border:`3px solid ${selected.vip_status?S.gold:S.border2}`}}>
                      {iniciales(selected.name,selected.apellido)}
                    </div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900}}>
                      {selected.name} {selected.apellido||''}
                      {selected.vip_status && <span style={{marginLeft:6}}>⭐</span>}
                    </div>
                    <div style={{fontSize:12,color:S.t3,marginTop:4}}>
                      {selected.ciudad||'Sin ciudad'} ·{' '}
                      {selected.origen_captacion==='oh_yeah'
                        ? <span style={{color:'#FFE600',fontWeight:700}}>🦉 Oh Yeah</span>
                        : selected.origen_captacion||'—'}
                    </div>
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

                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
                  <div style={{fontSize:11,color:S.gold,fontWeight:700,marginBottom:12,textTransform:'uppercase' as const}}>💰 Financiero</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {[
                      {l:'Visitas',      v:selected.total_visits||0,          c:S.blue},
                      {l:'Gasto total',  v:fmtMoney(selected.total_spent),    c:S.gold},
                      {l:'Ticket prom.', v:fmtMoney(selected.promedio_ticket), c:S.purple},
                      {l:'Última visita',v:formatFecha(selected.ultima_visita),c:S.t2},
                    ].map(m=>(
                      <div key={m.l} style={{background:S.bg3,borderRadius:10,padding:'10px 12px'}}>
                        <div style={{fontSize:9,color:S.t3,marginBottom:3,textTransform:'uppercase' as const}}>{m.l}</div>
                        <div style={{fontSize:14,fontWeight:700,color:m.c}}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>

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

                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>{ if(selected.origen_captacion==='oh_yeah'){ showToast('⚠️ Cliente de Oh Yeah — solo lectura'); return; } setEditMode(true); setCtab('nuevo'); }}
                    style={{flex:1,padding:11,borderRadius:10,border:`1px solid ${S.border2}`,background:'transparent',color:selected.origen_captacion==='oh_yeah'?S.t3:S.t2,cursor:'pointer',fontSize:12,fontWeight:700}}>
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
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
                  <div style={{fontSize:11,color:S.t2,fontWeight:700,marginBottom:12,textTransform:'uppercase' as const}}>📝 Notas del equipo</div>
                  <div style={{display:'flex',gap:8,marginBottom:12}}>
                    <input value={nuevaNota} onChange={e=>setNuevaNota(e.target.value)}
                      placeholder="Agregar nota..." onKeyDown={e=>e.key==='Enter'&&agregarNota()}
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

                <div style={{background:`linear-gradient(135deg,${S.pink}08,${S.purple}05)`,border:`1px solid ${S.pink}20`,borderRadius:14,padding:16}}>
                  <div style={{fontSize:11,color:S.pink,fontWeight:700,marginBottom:12,display:'flex',alignItems:'center',gap:6}}>
                    <span>✦</span> Insights CIM™
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {(selected.total_visits||0)>=10 && (
                      <div style={{fontSize:12,color:S.t2,background:S.bg3,borderRadius:8,padding:'8px 12px'}}>
                        🏆 Cliente embajador con {selected.total_visits} visitas — prioridad máxima.
                      </div>
                    )}
                    {(selected.alergias?.length||0)>0 && (
                      <div style={{fontSize:12,color:S.red,background:`${S.red}08`,border:`1px solid ${S.red}20`,borderRadius:8,padding:'8px 12px'}}>
                        ⚠️ CRÍTICO: {selected.alergias!.length} alergia(s). Notificar cocina antes del servicio.
                      </div>
                    )}
                    {selected.origen_captacion==='oh_yeah' && (
                      <div style={{fontSize:12,color:'#FFE600',background:'rgba(255,230,0,0.06)',border:'1px solid rgba(255,230,0,0.2)',borderRadius:8,padding:'8px 12px'}}>
                        🦉 Cliente registrado desde Oh Yeah! — ya tiene historial en la app Gourmand Society.
                      </div>
                    )}
                    {(selected.puntos||0)>50 && (
                      <div style={{fontSize:12,color:S.purple,background:`${S.purple}08`,borderRadius:8,padding:'8px 12px'}}>
                        ✦ {selected.puntos} puntos acumulados — candidato a beneficio Oh Yeah.
                      </div>
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
              </div>
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
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:`1px solid ${S.border}`,fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900}}>🏆 Top por gasto</div>
                {clientes.sort((a,b)=>(b.total_spent||0)-(a.total_spent||0)).slice(0,8).map((c,i)=>(
                  <div key={c.id} style={{padding:'10px 16px',borderBottom:`1px solid rgba(255,255,255,0.03)`,display:'flex',alignItems:'center',gap:10,cursor:'pointer'}} onClick={()=>abrirPerfil(c)}>
                    <div style={{width:22,height:22,borderRadius:7,background:i===0?`${S.gold}20`:S.bg3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:i===0?S.gold:S.t3}}>{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700}}>{c.name} {c.apellido||''}</div>
                      <div style={{fontSize:10,color:S.t3}}>{c.total_visits||0} visitas</div>
                    </div>
                    <div style={{fontSize:13,fontWeight:700,color:S.gold}}>{fmtMoney(c.total_spent)}</div>
                  </div>
                ))}
              </div>
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
                  {/* Oh Yeah */}
                  {(() => {
                    const cnt = clientes.filter(c=>c.origen_captacion==='oh_yeah').length;
                    const pct = clientes.length ? Math.round(cnt/clientes.length*100) : 0;
                    return (
                      <div>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}>
                          <span style={{color:'#FFE600'}}>🦉 Oh Yeah</span>
                          <span style={{fontWeight:700}}>{cnt} ({pct}%)</span>
                        </div>
                        <div style={{height:6,background:S.bg4,borderRadius:3,overflow:'hidden'}}>
                          <div style={{height:'100%',background:'#FFE600',width:`${pct}%`,borderRadius:3}}/>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:`1px solid ${S.border}`,fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900}}>📡 Por origen</div>
                <div style={{padding:16,display:'flex',flexDirection:'column',gap:8}}>
                  {Object.entries(clientes.reduce((acc:any,c)=>{ const k=c.origen_captacion||'desconocido'; acc[k]=(acc[k]||0)+1; return acc; },{})).sort(([,a]:any,[,b]:any)=>b-a).slice(0,6).map(([k,v]:any)=>(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',background:S.bg3,borderRadius:8}}>
                      <span style={{fontSize:11,color:k==='oh_yeah'?'#FFE600':S.t2}}>{k==='oh_yeah'?'🦉 Oh Yeah':k}</span>
                      <span style={{fontSize:13,fontWeight:700,color:k==='oh_yeah'?'#FFE600':S.blue}}>{v}</span>
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
                          {['name','apellido','phone','email','ciudad','documento','origen_captacion','notes'].map(f=><option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>{
                    setCsvPreview(csvRows.map(row=>{ const obj:any={}; Object.entries(csvMapping).forEach(([k,v])=>{ if(v)obj[v]=row[k]; }); return obj; }));
                    setCsvStep('preview');
                  }} style={{padding:'11px 32px',borderRadius:10,border:'none',background:S.pink,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                    Vista previa →
                  </button>
                </div>
              )}
              {csvStep==='preview' && (
                <div>
                  <div style={{fontSize:13,color:S.t2,marginBottom:12}}>Vista previa — {csvPreview.length} clientes</div>
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
