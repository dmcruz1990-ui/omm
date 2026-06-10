import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useRestaurant } from '../contexts/RestaurantContext';

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
  fecha_aniversario?:string; tipo_aniversario?:string;
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
  const { activeRestaurant } = useRestaurant();
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
  // Historial consolidado del cliente en el restaurante activo (pedidos + care + ratings)
  const [perfilHistorial, setPerfilHistorial] = useState<{pedidos:any[]; care:any[]; ratings:any[]}>({pedidos:[], care:[], ratings:[]});

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
  // Todo cliente se puede editar (incluyendo los originados en Oh Yeah).
  // Los originados en Oh Yeah no tienen registro en customers todavía →
  // si el ID no existe en customers, se hace upsert para crear el espejo.
  const guardar = async () => {
    if (!form.name) { showToast('⚠️ Nombre requerido'); return; }
    if (selected && editMode) {
      const esOhYeah = selected.origen_captacion === 'oh_yeah';
      if (esOhYeah) {
        // Upsert: crea o actualiza el cliente como espejo en customers
        const { error } = await supabase.from('customers').upsert({
          ...form, origen_captacion: 'oh_yeah',
          score: form.score || 0,
          total_visits: form.total_visits || 0,
          total_spent: form.total_spent || 0,
          puntos: form.puntos || 0,
        });
        if (error) { showToast('✗ No se pudo guardar: ' + error.message); return; }
        showToast('✓ Cliente actualizado (espejo Oh Yeah)');
      } else {
        const { error } = await supabase.from('customers').update(form).eq('id',selected.id);
        if (error) { showToast('✗ No se pudo actualizar: ' + error.message); return; }
        showToast('✓ Cliente actualizado');
      }
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
    setPerfilHistorial({pedidos:[], care:[], ratings:[]});
    cargarHistorialPerfil(c);
  };

  // ── CSV import ────────────────────────────────────────────────────────
  const parseCsv = (text:string) => {
    const lines = text.split(/\r?\n/).filter(l=>l.trim());
    if (lines.length === 0) { showToast('⚠️ Archivo CSV vacío'); return; }
    const headers = lines[0].split(',').map(h=>h.trim().replace(/"/g,''));
    if (headers.length === 0) { showToast('⚠️ CSV sin encabezados'); return; }
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
        // supabase-js no lanza en errores de BD: devuelve { error }.
        // Hay que chequearlo explícitamente para contar bien.
        const { error } = await supabase.from('customers').insert({ ...row, score:0, total_visits:0, puntos:0 });
        if (error) err++; else ok++;
      } catch { err++; }
    }
    setCsvResultado({ok,err}); setCsvStep('done'); setCsvImporting(false);
    showToast(`✓ ${ok} importados${err>0?` · ${err} con error`:''}`); fetchClientes();
  };

  // Export — solo Nombres / correo / celular / ciudad / documento
  const exportarClientes = () => {
    const cols = ['nombre','apellido','email','celular','ciudad','documento'];
    const rows = filtrados.map(c => [
      (c.name||'').replace(/,/g,' '),
      (c.apellido||'').replace(/,/g,' '),
      (c.email||''),
      (c.phone||''),
      (c.ciudad||'').replace(/,/g,' '),
      (c.documento||''),
    ]);
    const csv = [cols.join(','), ...rows.map(r=>r.map(v=>`"${(v||'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes_${(activeRestaurant as any)?.nombre||'NEXUM'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✓ Exportados ${rows.length} clientes`);
  };

  // Cargar historial consolidado al abrir perfil (pedidos + care + calificaciones del restaurante activo)
  const cargarHistorialPerfil = useCallback(async (c:Customer) => {
    const rid = (activeRestaurant as any)?.id;
    if (!rid) return;
    const orFilter:string[] = [];
    if (c.email) orFilter.push(`cliente_email.eq.${c.email}`);
    if (c.phone) orFilter.push(`cliente_telefono.eq.${c.phone}`);
    // Pedidos (orders) por reservation_id de las reservas del cliente — simplificado: por customer_id si existe
    const [pedidosRes, careRes, ratingsRes] = await Promise.all([
      supabase.from('orders').select('id,created_at,total,estado,mesa_num,items_count').eq('customer_id', c.id).eq('restaurant_id', rid).order('created_at',{ascending:false}).limit(20),
      supabase.from('xcare_alertas').select('id,created_at,tipo,severidad,mensaje,resuelta').eq('customer_id', c.id).eq('restaurant_id', rid).order('created_at',{ascending:false}).limit(15),
      supabase.from('xcare_encuestas').select('id,created_at,estrellas,estrellas_comida,estrellas_servicio,estrellas_ambiente,comentario').eq('customer_id', c.id).eq('restaurant_id', rid).order('created_at',{ascending:false}).limit(15),
    ]);
    setPerfilHistorial({
      pedidos: (pedidosRes.data||[]),
      care:    (careRes.data||[]),
      ratings: (ratingsRes.data||[]),
    });
  }, [activeRestaurant]);

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>

      {toast && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:S.bg4,border:`1px solid ${S.pink}`,color:S.t1,padding:'10px 24px',borderRadius:50,fontSize:13,zIndex:9999,whiteSpace:'nowrap'}}>{toast}</div>}

      {/* Header — solo título + acciones (Import / Export / Nuevo) */}
      <div style={{padding:'14px 24px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:16,flexShrink:0,background:S.bg2,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,flex:1}}>
          <div style={{width:42,height:42,borderRadius:13,background:`linear-gradient(135deg,${S.pink},${S.purple})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,boxShadow:`0 0 20px rgba(255,45,120,0.3)`}}>👥</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,letterSpacing:'-0.02em'}}>CLIENTES</div>
            <div style={{fontSize:10,color:S.t3,letterSpacing:'.1em',textTransform:'uppercase' as const}}>CIM™ — {(activeRestaurant as any)?.nombre || 'NEXUM'}</div>
          </div>
        </div>
        <button onClick={()=>setCtab('importar')}
          style={{padding:'9px 16px',borderRadius:10,border:`1px solid ${S.blue}40`,background:`${S.blue}10`,color:S.blue,fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
          📥 Importar
        </button>
        <button onClick={exportarClientes}
          style={{padding:'9px 16px',borderRadius:10,border:`1px solid ${S.green}40`,background:`${S.green}10`,color:S.green,fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
          📤 Exportar
        </button>
        <button onClick={()=>{ setForm({tipo_documento:'CC',origen_captacion:'walk-in',activo:true}); setCtab('nuevo'); }}
          style={{padding:'9px 20px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.pink},#cc2260)`,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',boxShadow:`0 4px 14px ${S.pink}30`}}>
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
        ] as const).filter(t=>!('hide' in t && t.hide)).map(t=>(
          <button key={t.id} onClick={()=>setCtab(t.id)}
            style={{padding:'10px 16px',background:'none',border:'none',borderBottom:`2px solid ${ctab===t.id?S.pink:'transparent'}`,color:ctab===t.id?S.pink:S.t3,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s'}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Barra de búsqueda + Oh Yeah chip — solo en lista */}
      {ctab==='lista' && (
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 24px',borderBottom:`1px solid ${S.border}`,background:S.bg,flexShrink:0,flexWrap:'wrap'}}>
          <div style={{position:'relative',flex:1,minWidth:240,maxWidth:420}}>
            <input placeholder="🔍 Buscar nombre, teléfono, email..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}
              style={{...inp,padding:'9px 14px',fontSize:13}} />
            {busqueda && <button onClick={()=>setBusqueda('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:S.t3,cursor:'pointer'}}>✕</button>}
          </div>
          <select value={ordenar} onChange={e=>setOrdenar(e.target.value)} style={{...inp,width:'auto',padding:'9px 12px',fontSize:12,cursor:'pointer'}}>
            <option value="total_visits">Por visitas</option>
            <option value="total_spent">Por gasto</option>
            <option value="score">Por score</option>
            <option value="ultima_visita">Última visita</option>
            <option value="created_at">Más nuevos</option>
          </select>
          <div style={{display:'flex',gap:6,alignItems:'center',marginLeft:'auto'}}>
            <button onClick={()=>setSegmento('todos')}
              style={{padding:'6px 14px',borderRadius:50,border:`1px solid ${segmento==='todos'?S.t2:S.border}`,background:segmento==='todos'?`${S.t2}15`:'transparent',color:segmento==='todos'?S.t1:S.t3,fontSize:11,fontWeight:700,cursor:'pointer'}}>
              Todos
            </button>
            <button onClick={()=>setSegmento('ohyeah')}
              style={{padding:'6px 14px',borderRadius:50,border:`1px solid ${segmento==='ohyeah'?'#FFE600':S.border}`,background:segmento==='ohyeah'?'rgba(255,230,0,0.12)':'transparent',color:segmento==='ohyeah'?'#FFE600':S.t3,fontSize:11,fontWeight:700,cursor:'pointer'}}>
              🦉 Oh Yeah
            </button>
          </div>
        </div>
      )}

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
                    {['Cliente','Contacto','Score','Calificación','Segmento','Visitas','Gasto total','Ticket prom.','Última visita','Alergias','Preferencias','Origen · Últimas 3','Acciones'].map(h=>(
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
                      {l:(selected as any).tipo_aniversario ? `${(selected as any).tipo_aniversario}` : 'Aniversario',
                       v:formatFecha((selected as any).fecha_aniversario), icon:'💍'},
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
                  <button onClick={()=>{ setEditMode(true); setCtab('nuevo'); }}
                    style={{flex:1,padding:11,borderRadius:10,border:`1px solid ${S.purple}`,background:`${S.purple}10`,color:S.purple,cursor:'pointer',fontSize:12,fontWeight:700}}>
                    ✏️ Editar cliente
                  </button>
                  <button onClick={()=>setCtab('lista')}
                    style={{flex:1,padding:11,borderRadius:10,border:`1px solid ${S.border}`,background:'transparent',color:S.t3,cursor:'pointer',fontSize:12}}>
                    ← Lista
                  </button>
                </div>
              </div>

              {/* Columna derecha — Historial consolidado en restaurante activo */}
              <div style={{display:'flex',flexDirection:'column',gap:14}}>

                {/* Banner restaurante activo */}
                <div style={{background:`linear-gradient(135deg,${S.pink}15,${S.purple}10)`,border:`1px solid ${S.pink}30`,borderRadius:12,padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:18}}>{(activeRestaurant as any)?.emoji||'🏨'}</span>
                  <div>
                    <div style={{fontSize:10,color:S.t3,textTransform:'uppercase' as const,letterSpacing:'.08em'}}>Historial en</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,color:S.t1}}>{(activeRestaurant as any)?.nombre||'NEXUM'}</div>
                  </div>
                </div>

                {/* Pedidos */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
                  <div style={{fontSize:11,color:S.gold,fontWeight:700,marginBottom:12,textTransform:'uppercase' as const,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span>🍽️ Pedidos · últimos {perfilHistorial.pedidos.length}</span>
                    <span style={{color:S.t3,fontWeight:400}}>{selected.total_visits||0} visitas totales</span>
                  </div>
                  {perfilHistorial.pedidos.length===0 ? (
                    <div style={{fontSize:12,color:S.t3,textAlign:'center',padding:'12px 0'}}>Sin pedidos en este restaurante</div>
                  ) : (
                    <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:240,overflowY:'auto'}}>
                      {perfilHistorial.pedidos.map((p:any,i:number)=>(
                        <div key={p.id||i} style={{background:S.bg3,borderRadius:10,padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
                          <div>
                            <div style={{fontSize:12,color:S.t1,fontWeight:700}}>M{p.mesa_num||'—'} · {p.items_count||0} items</div>
                            <div style={{fontSize:10,color:S.t3}}>{formatFecha((p.created_at||'').split('T')[0])} · {p.estado||'—'}</div>
                          </div>
                          <div style={{fontSize:13,fontWeight:800,color:S.gold}}>{fmtMoney(p.total)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Calificaciones X-CARE */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
                  <div style={{fontSize:11,color:S.purple,fontWeight:700,marginBottom:12,textTransform:'uppercase' as const}}>⭐ Calificaciones X-Care · {perfilHistorial.ratings.length}</div>
                  {perfilHistorial.ratings.length===0 ? (
                    <div style={{fontSize:12,color:S.t3,textAlign:'center',padding:'12px 0'}}>Sin calificaciones aún</div>
                  ) : (
                    <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:200,overflowY:'auto'}}>
                      {perfilHistorial.ratings.map((r:any,i:number)=>{
                        const nota = r.estrellas ?? ((r.estrellas_comida+r.estrellas_servicio+r.estrellas_ambiente)/3);
                        const color = nota>=4.5?S.green:nota>=3.5?S.gold:nota>=2?'#FF9800':S.red;
                        return (
                          <div key={r.id||i} style={{background:S.bg3,borderRadius:10,padding:'8px 12px'}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
                              <div style={{fontSize:12,color}}>
                                {'★'.repeat(Math.round(nota))}{'☆'.repeat(Math.max(0,5-Math.round(nota)))} <span style={{color:S.t3,fontSize:10,marginLeft:4}}>{formatFecha((r.created_at||'').split('T')[0])}</span>
                              </div>
                              <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900,color}}>{Number(nota).toFixed(1)}</div>
                            </div>
                            {r.comentario && <div style={{fontSize:11,color:S.t2,marginTop:4,fontStyle:'italic'}}>"{r.comentario}"</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Historial CARE (alertas + notas del equipo unificadas) */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
                  <div style={{fontSize:11,color:S.cyan,fontWeight:700,marginBottom:12,textTransform:'uppercase' as const}}>💬 Historial Care · Comentarios</div>
                  <div style={{display:'flex',gap:8,marginBottom:12}}>
                    <input value={nuevaNota} onChange={e=>setNuevaNota(e.target.value)}
                      placeholder="Nuevo comentario / nota Care..." onKeyDown={e=>e.key==='Enter'&&agregarNota()}
                      style={{...inp,fontSize:12,padding:'8px 12px'}}/>
                    <button onClick={agregarNota}
                      style={{padding:'8px 16px',borderRadius:8,border:'none',background:S.cyan,color:'#000',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                      + Nota
                    </button>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:280,overflowY:'auto'}}>
                    {/* Alertas X-Care del restaurante activo */}
                    {perfilHistorial.care.map((a:any,i:number)=>(
                      <div key={`a-${a.id||i}`} style={{background:`${S.cyan}08`,border:`1px solid ${S.cyan}20`,borderRadius:10,padding:'8px 12px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',gap:6}}>
                          <div style={{fontSize:11,color:S.cyan,fontWeight:700}}>{a.tipo||'Alerta'} {a.severidad?`· ${a.severidad}`:''}</div>
                          <div style={{fontSize:9,color:a.resuelta?S.green:S.gold}}>{a.resuelta?'✓ resuelta':'pendiente'}</div>
                        </div>
                        <div style={{fontSize:12,color:S.t2,marginTop:3}}>{a.mensaje}</div>
                        <div style={{fontSize:10,color:S.t3,marginTop:3}}>{formatFecha((a.created_at||'').split('T')[0])}</div>
                      </div>
                    ))}
                    {/* Notas del equipo (anteriormente "Notas del equipo") */}
                    {[...(selected.historial_notas||[])].reverse().map((n:any,i)=>(
                      <div key={`n-${i}`} style={{background:S.bg3,borderRadius:10,padding:'10px 14px'}}>
                        <div style={{fontSize:12,color:S.t1,lineHeight:1.5}}>{n.nota}</div>
                        <div style={{fontSize:10,color:S.t3,marginTop:4}}>{n.autor||'Staff'} · {formatFecha(n.fecha)}</div>
                      </div>
                    ))}
                    {perfilHistorial.care.length===0 && (selected.historial_notas||[]).length===0 && (
                      <div style={{fontSize:12,color:S.t3,textAlign:'center',padding:'16px 0'}}>Sin historial Care</div>
                    )}
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

              {/* Fechas memorables — para upselling / saludos automáticos */}
              <div style={{marginBottom:18,padding:14,background:`${S.purple}08`,border:`1px solid ${S.purple}33`,borderRadius:12}}>
                <div style={{fontSize:10,color:S.purple,fontWeight:800,marginBottom:10,textTransform:'uppercase' as const,letterSpacing:'.12em'}}>🎂 Fechas memorables</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                  <div>
                    <div style={{fontSize:10,color:S.t3,marginBottom:4}}>🎂 Cumpleaños</div>
                    <input type="date" style={{...inp, colorScheme:'dark' as const}}
                      value={(form as any).fecha_nacimiento||''}
                      onChange={e=>setF('fecha_nacimiento', e.target.value)}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:S.t3,marginBottom:4}}>💍 Aniversario</div>
                    <input type="date" style={{...inp, colorScheme:'dark' as const}}
                      value={(form as any).fecha_aniversario||''}
                      onChange={e=>setF('fecha_aniversario', e.target.value)}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:S.t3,marginBottom:4}}>Tipo</div>
                    <select style={inp}
                      value={(form as any).tipo_aniversario||''}
                      onChange={e=>setF('tipo_aniversario', e.target.value)}>
                      <option value="">— Tipo —</option>
                      {['Matrimonio','Pareja','Negocio','Amistad','Otro'].map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{fontSize:10,color:S.t3,marginTop:8,lineHeight:1.4}}>
                  💡 Estas fechas habilitan saludos automáticos y ofertas el día (o la semana) del evento.
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

        {/* ── ANALYTICS · Guest Intelligence Dashboard ── */}
        {ctab==='analytics' && (() => {
          // KPIs principales calculados desde el state clientes
          const totalClientes = clientes.length;
          const cntVip   = clientes.filter(c=>c.vip_status || segmentar(c)==='vip').length;
          const cntRec   = clientes.filter(c=>segmentar(c)==='recurrentes').length;
          const cntNue   = clientes.filter(c=>segmentar(c)==='nuevos').length;
          const cntDorm  = clientes.filter(c=>segmentar(c)==='dormidos').length;
          // Satisfacción promedio (de los ratings agregados que ya carga fetchClientes)
          const conRating = clientes.filter((c:any)=>typeof c.rating_avg==='number');
          const satAvg = conRating.length > 0
            ? conRating.reduce((s:number,c:any)=>s+c.rating_avg,0)/conRating.length
            : 0;
          // Mini-trend SVG genérico (chart pequeño debajo de cada KPI)
          const miniTrend = (color:string, seed:number) => {
            const pts = Array.from({length:14},(_,i)=>{
              const x = i*9;
              const y = 24 - (Math.sin(i*0.6 + seed)*8 + 12);
              return `${x},${Math.max(2,Math.min(22,y))}`;
            }).join(' ');
            return (
              <svg width="100%" height="28" viewBox="0 0 126 28" preserveAspectRatio="none" style={{display:'block'}}>
                <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" opacity="0.9"/>
                <polyline points={`0,28 ${pts} 126,28`} fill={`${color}25`}/>
              </svg>
            );
          };

          // Top por valor (gasto total)
          const topGasto = [...clientes].sort((a,b)=>(b.total_spent||0)-(a.total_spent||0)).slice(0,5);
          // Top ticket promedio
          const topTicket = [...clientes].filter(c=>(c.promedio_ticket||0)>0).sort((a,b)=>(b.promedio_ticket||0)-(a.promedio_ticket||0)).slice(0,5);

          // Por origen
          const origenMap: Record<string, number> = {};
          clientes.forEach((c:any) => {
            const k = c.origen_captacion || 'desconocido';
            origenMap[k] = (origenMap[k]||0) + 1;
          });
          const origenOrden = Object.entries(origenMap).sort(([,a],[,b])=>b-a);
          const origenMax = Math.max(...origenOrden.map(([,v])=>v), 1);
          const origenInfo: Record<string,{l:string;c:string;ico:string}> = {
            'walk-in':       { l:'walk-in',       c:'#4a8fd4', ico:'🚶' },
            'instagram':     { l:'Instagram',     c:'#E1306C', ico:'📷' },
            'whatsapp':      { l:'WhatsApp',      c:'#25D366', ico:'💬' },
            'oh_yeah':       { l:'Oh Yeah',       c:'#FFE600', ico:'🦉' },
            'reserva_maitre':{ l:'reserva_maitre',c:S.t2,      ico:'🛎️' },
            'telefono':      { l:'Teléfono',      c:'#FB923C', ico:'📞' },
            'referido':      { l:'Referido',      c:'#9b72ff', ico:'👥' },
            'desconocido':   { l:'desconocido',   c:S.t3,      ico:'·' },
          };

          // Satisfacción por segmento (promedio de rating por bucket)
          const promSeg = (seg:string) => {
            const list = clientes.filter((c:any)=> (seg==='vip' ? (c.vip_status || segmentar(c)==='vip') : segmentar(c)===seg) && typeof c.rating_avg==='number');
            return list.length > 0 ? list.reduce((s:number,c:any)=>s+c.rating_avg,0)/list.length : 0;
          };
          const satVip = promSeg('vip');
          const satRec = promSeg('recurrentes');
          const satNue = promSeg('nuevos');
          const satDor = promSeg('dormidos');

          // Por ciudad
          const ciudadMap: Record<string,number> = {};
          clientes.forEach((c:any) => { if (c.ciudad) { const k = String(c.ciudad).trim(); ciudadMap[k] = (ciudadMap[k]||0)+1; } });
          const ciudadOrden = Object.entries(ciudadMap).sort(([,a],[,b])=>b-a).slice(0,5);
          const ciudadMax = Math.max(...ciudadOrden.map(([,v])=>v), 1);
          const ciudadPrincipal = ciudadOrden[0]?.[0] || '—';

          // Donut satisfacción
          const satPct = Math.min(100, Math.round((satAvg/5)*100));
          const satCirc = 2 * Math.PI * 38;
          const satDash = (satPct/100) * satCirc;

          return (
            <div style={{height:'100%',overflowY:'auto',padding:18,background:S.bg}}>
              <style>{`@keyframes giPulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>

              {/* Header con título */}
              <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Syne',serif",fontSize:11,color:S.t3,letterSpacing:'.22em',fontWeight:800,textTransform:'uppercase'}}>NEXUM · Guest Intelligence</div>
                  <div style={{fontFamily:"'Syne',serif",fontSize:18,fontWeight:900,marginTop:2}}>Dashboard de Clientes</div>
                </div>
              </div>

              {/* FILA 1 · 6 KPIs principales */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10,marginBottom:14}}>
                {([
                  { l:'Clientes',     v:totalClientes.toLocaleString('es-CO'), c:'#4a8fd4', ico:'👥', seed:1 },
                  { l:'VIP',          v:cntVip,    c:S.gold,    ico:'⭐', seed:2 },
                  { l:'Recurrentes',  v:cntRec,    c:S.green,   ico:'🔄', seed:3 },
                  { l:'Nuevos',       v:cntNue,    c:'#4a8fd4', ico:'👤', seed:4 },
                  { l:'Dormidos',     v:cntDorm,   c:S.red,     ico:'💤', seed:5 },
                  { l:'Satisfacción', v:`${satAvg.toFixed(1)}`, sub:'/5', c:S.cyan, ico:'❤', seed:6 },
                ] as any[]).map(k => (
                  <div key={k.l} style={{background:S.bg2,border:`1px solid ${k.c}33`,borderRadius:12,padding:'12px 14px',boxShadow:`0 0 14px ${k.c}15`}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                      <div style={{width:32,height:32,borderRadius:9,background:`${k.c}15`,border:`1px solid ${k.c}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>{k.ico}</div>
                      <div style={{fontSize:10,color:k.c,fontWeight:800,letterSpacing:'.06em'}}>{k.l}</div>
                    </div>
                    <div style={{display:'flex',alignItems:'baseline',gap:3}}>
                      <span style={{fontFamily:"'Syne',serif",fontSize:30,fontWeight:900,color:'#fff',lineHeight:1,letterSpacing:'-0.02em'}}>{k.v}</span>
                      {k.sub && <span style={{fontSize:12,color:S.t3,fontWeight:700}}>{k.sub}</span>}
                    </div>
                    <div style={{marginTop:8}}>{miniTrend(k.c, k.seed)}</div>
                  </div>
                ))}
              </div>

              {/* FILA 2 · Top por valor · Top ticket · Por origen */}
              <div style={{display:'grid',gridTemplateColumns:'1.1fr 1.1fr 1fr',gap:14,marginBottom:14}}>
                {/* Top por valor */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:'14px 16px'}}>
                  <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900,marginBottom:10,display:'flex',alignItems:'center',gap:6}}><span style={{color:S.gold}}>🏆</span> Top por valor</div>
                  <div style={{display:'grid',gridTemplateColumns:'18px 1fr 60px 90px',gap:8,padding:'4px 0',fontSize:9,color:S.t3,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase' as const,borderBottom:`1px solid ${S.border}`,marginBottom:6}}>
                    <span>#</span><span>Cliente</span><span style={{textAlign:'right' as const}}>Visitas</span><span style={{textAlign:'right' as const}}>Gasto total</span>
                  </div>
                  {topGasto.length === 0 && <div style={{textAlign:'center',padding:24,color:S.t3,fontSize:12}}>Sin datos todavía</div>}
                  {topGasto.map((c:any,i) => (
                    <div key={c.id} onClick={()=>abrirPerfil(c)}
                      style={{display:'grid',gridTemplateColumns:'18px 1fr 60px 90px',gap:8,padding:'8px 0',alignItems:'center',cursor:'pointer',borderBottom:`1px solid rgba(255,255,255,0.03)`}}>
                      <div style={{width:18,height:18,borderRadius:'50%',background:i<3?S.gold:S.bg3,color:i<3?'#000':S.t3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900}}>{i+1}</div>
                      <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
                        <div style={{width:26,height:26,borderRadius:'50%',background:`linear-gradient(135deg,${S.pink}40,${S.purple}40)`,border:`1px solid ${S.border2}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,flexShrink:0}}>{iniciales(c.name,c.apellido)}</div>
                        <span style={{fontSize:12,fontWeight:700,color:'#f0f0f0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.name} {c.apellido||''}</span>
                      </div>
                      <div style={{fontSize:11,color:S.t2,textAlign:'right' as const}}>{c.total_visits||0} visitas</div>
                      <div style={{fontSize:12,fontWeight:800,color:S.gold,textAlign:'right' as const}}>{fmtMoney(c.total_spent)}</div>
                    </div>
                  ))}
                </div>

                {/* Top ticket promedio */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:'14px 16px'}}>
                  <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900,marginBottom:10,display:'flex',alignItems:'center',gap:6}}><span style={{color:S.green}}>📊</span> Top ticket promedio</div>
                  <div style={{display:'grid',gridTemplateColumns:'18px 1fr 60px 90px',gap:8,padding:'4px 0',fontSize:9,color:S.t3,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase' as const,borderBottom:`1px solid ${S.border}`,marginBottom:6}}>
                    <span>#</span><span>Cliente</span><span style={{textAlign:'right' as const}}>Visitas</span><span style={{textAlign:'right' as const}}>Ticket</span>
                  </div>
                  {topTicket.length === 0 && <div style={{textAlign:'center',padding:24,color:S.t3,fontSize:12}}>Sin tickets registrados</div>}
                  {topTicket.map((c:any,i) => (
                    <div key={c.id} onClick={()=>abrirPerfil(c)}
                      style={{display:'grid',gridTemplateColumns:'18px 1fr 60px 90px',gap:8,padding:'8px 0',alignItems:'center',cursor:'pointer',borderBottom:`1px solid rgba(255,255,255,0.03)`}}>
                      <div style={{width:18,height:18,borderRadius:'50%',background:i<3?S.green:S.bg3,color:i<3?'#000':S.t3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900}}>{i+1}</div>
                      <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
                        <div style={{width:26,height:26,borderRadius:'50%',background:`linear-gradient(135deg,${S.pink}40,${S.purple}40)`,border:`1px solid ${S.border2}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,flexShrink:0}}>{iniciales(c.name,c.apellido)}</div>
                        <span style={{fontSize:12,fontWeight:700,color:'#f0f0f0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.name} {c.apellido||''}</span>
                      </div>
                      <div style={{fontSize:11,color:S.t2,textAlign:'right' as const}}>{c.total_visits||0} visitas</div>
                      <div style={{fontSize:12,fontWeight:800,color:S.green,textAlign:'right' as const}}>{fmtMoney(c.promedio_ticket)}</div>
                    </div>
                  ))}
                </div>

                {/* Por origen */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:'14px 16px'}}>
                  <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900,marginBottom:14,display:'flex',alignItems:'center',gap:6}}><span style={{color:S.blue}}>📍</span> Por origen</div>
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {origenOrden.length === 0 && <div style={{textAlign:'center',padding:20,color:S.t3,fontSize:12}}>Sin orígenes registrados</div>}
                    {origenOrden.slice(0,6).map(([k,v]) => {
                      const info = origenInfo[k] || { l:k, c:S.t3, ico:'·' };
                      const w = Math.round((v/origenMax)*100);
                      return (
                        <div key={k} style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:24,height:24,borderRadius:7,background:`${info.c}18`,border:`1px solid ${info.c}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>{info.ico}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:11,color:'#f0f0f0',fontWeight:700,marginBottom:4}}>{info.l}</div>
                            <div style={{height:6,background:S.bg4,borderRadius:3,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${w}%`,background:info.c,borderRadius:3}}/>
                            </div>
                          </div>
                          <div style={{fontSize:13,fontWeight:800,color:'#f0f0f0',fontFamily:"'Syne',serif",minWidth:36,textAlign:'right' as const}}>{v}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* FILA 3 · Satisfacción por cliente · Donut central · Por ciudad */}
              <div style={{display:'grid',gridTemplateColumns:'1.2fr 0.7fr 1.4fr',gap:14}}>
                {/* Satisfacción por cliente */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:'14px 16px'}}>
                  <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900,marginBottom:14,display:'flex',alignItems:'center',gap:6}}><span>😊</span> Satisfacción por cliente</div>
                  <div style={{display:'flex',flexDirection:'column',gap:14}}>
                    {([
                      { l:'VIP',         v:satVip, ico:'⭐', c:S.gold },
                      { l:'Recurrentes', v:satRec, ico:'🔄', c:S.green },
                      { l:'Nuevos',      v:satNue, ico:'👤', c:S.blue },
                      { l:'Dormidos',    v:satDor, ico:'💤', c:S.red },
                    ] as any[]).map(s => {
                      const w = Math.round((s.v/5)*100);
                      return (
                        <div key={s.l} style={{display:'flex',alignItems:'center',gap:10}}>
                          <span style={{fontSize:16,width:18,textAlign:'center' as const}}>{s.ico}</span>
                          <div style={{minWidth:80,fontSize:12,color:'#f0f0f0',fontWeight:700}}>{s.l}</div>
                          <div style={{flex:1,height:8,background:S.bg4,borderRadius:4,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${w}%`,background:s.c,borderRadius:4,boxShadow:`0 0 8px ${s.c}55`}}/>
                          </div>
                          <div style={{fontFamily:"'Syne',serif",fontSize:16,fontWeight:900,color:s.c,minWidth:32,textAlign:'right' as const}}>{s.v.toFixed(1)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Donut central · satisfacción promedio */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:'14px 16px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                  <svg width="120" height="120" viewBox="0 0 90 90">
                    <circle cx={45} cy={45} r={38} fill="none" stroke={S.bg4} strokeWidth={6}/>
                    <circle cx={45} cy={45} r={38} fill="none" stroke={S.cyan} strokeWidth={6}
                      strokeDasharray={`${satDash} ${satCirc - satDash}`}
                      strokeDashoffset={satCirc * 0.25}
                      strokeLinecap="round"
                      style={{filter:`drop-shadow(0 0 6px ${S.cyan})`}}/>
                    <text x={45} y={42} textAnchor="middle" fill={S.cyan} fontSize={9} fontFamily="DM Sans">❤</text>
                    <text x={45} y={56} textAnchor="middle" fill="#fff" fontSize={16} fontWeight="900" fontFamily="Syne,serif">{satAvg.toFixed(1)}</text>
                    <text x={45} y={66} textAnchor="middle" fill={S.t3} fontSize={6}>/5</text>
                  </svg>
                  <div style={{fontSize:11,color:S.cyan,fontWeight:800,marginTop:10}}>Promedio general: {satAvg.toFixed(1)}</div>
                </div>

                {/* Por ciudad */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:'14px 16px',display:'flex',flexDirection:'column'}}>
                  <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900,marginBottom:14,display:'flex',alignItems:'center',gap:6}}><span style={{color:S.gold}}>📊</span> Por ciudad</div>
                  <div style={{display:'flex',flexDirection:'column',gap:10,flex:1}}>
                    {ciudadOrden.length === 0 && <div style={{textAlign:'center',padding:20,color:S.t3,fontSize:12}}>Sin ciudades registradas</div>}
                    {ciudadOrden.map(([nombre,v],i) => {
                      const w = Math.round((v/ciudadMax)*100);
                      return (
                        <div key={nombre} style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:20,height:20,borderRadius:'50%',background:i===0?S.gold:S.bg3,color:i===0?'#000':S.t3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,flexShrink:0}}>{i+1}</div>
                          <div style={{minWidth:90,fontSize:12,color:'#f0f0f0',fontWeight:700}}>{nombre}</div>
                          <div style={{flex:1,height:8,background:S.bg4,borderRadius:4,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${w}%`,background:S.blue,borderRadius:4}}/>
                          </div>
                          <div style={{fontFamily:"'Syne',serif",fontSize:14,fontWeight:900,color:'#f0f0f0',minWidth:46,textAlign:'right' as const}}>{v}</div>
                        </div>
                      );
                    })}
                  </div>
                  {ciudadOrden.length > 0 && (
                    <div style={{marginTop:14,padding:'8px 12px',background:S.bg3,borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11,color:S.t2}}>
                      <span>📍 Ciudad principal: <span style={{color:S.cyan,fontWeight:800}}>{ciudadPrincipal}</span></span>
                      <span style={{color:S.cyan,fontWeight:700}}>📊 {ciudadOrden.length} ciudades activas</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

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
