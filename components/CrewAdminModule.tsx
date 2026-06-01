import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext';
import { useRestaurant } from '../contexts/RestaurantContext';

// ═══════════════════════════════════════════════════════════════════════
// CREW ADMIN — Backoffice de la app Seratta Crew dentro de NEXUM.
// 7 pestañas: Empleados · Comunicados · Reconocimientos · Foro ·
// Denuncias · Academia · Clima Organizacional.
// ═══════════════════════════════════════════════════════════════════════

const S = {
  bg:'#08080f', bg2:'#0f0f1a', bg3:'#161624', bg4:'#1e1e2e',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.12)',
  t1:'#fff', t2:'#A0A0B8', t3:'#50506A',
  gold:'#FFB547', green:'#00E676', red:'#FF5252',
  blue:'#448AFF', purple:'#B388FF', pink:'#FF2D78', cyan:'#22d3ee',
  crew:'#FF5C35',
};

const fmtCOP = (n:number) => `$${Math.round(n||0).toLocaleString('es-CO')}`;

type Tab = 'empleados' | 'comunicados' | 'reconocimientos' | 'foro' | 'denuncias' | 'academia' | 'clima';

export default function CrewAdminModule() {
  const { profile } = useAuth();
  const { activeId: restauranteId, activeRestaurant } = useRestaurant();
  const isGerencia = ['admin','gerencia','desarrollo'].includes(profile?.role || '');
  const miNombre = profile?.nombre_completo || profile?.full_name || 'Admin';
  const [tab, setTab] = useState<Tab>('empleados');
  const [toast, setToast] = useState('');
  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''), 3500); };

  // KPIs del header — datos en vivo de cada área
  const [kpis, setKpis] = useState({ empleadosActivos:0, sinLogin:0, comunicadosPub:0, denunciasPend:0, reconocimientosMes:0, climaProm:0 });
  useEffect(() => {
    (async () => {
      const mesStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const [emp, com, den, rec, cli] = await Promise.all([
        supabase.from('vista_empleados_crew').select('*'),
        supabase.from('crew_comunicados').select('id').eq('restaurante_id', restauranteId).eq('publicado', true),
        supabase.from('crew_denuncias').select('id').eq('restaurante_id', restauranteId).in('estado', ['recibido','revisando']),
        supabase.from('reconocimientos').select('id').gte('created_at', mesStart),
        supabase.from('clima_encuestas').select('score_general').eq('restaurante_id', restauranteId).gte('fecha_respuesta', mesStart),
      ]);
      const empleadosTodos = (emp.data || []).filter((e:any)=>e.activo);
      const sinLogin = empleadosTodos.filter((e:any) => !e.tiene_login).length;
      const climaScores = (cli.data || []).map((c:any) => c.score_general).filter((x:any) => x>0);
      const climaProm = climaScores.length > 0 ? Math.round(climaScores.reduce((s:number,x:number)=>s+x,0) / climaScores.length * 10) / 10 : 0;
      setKpis({
        empleadosActivos: empleadosTodos.length,
        sinLogin,
        comunicadosPub: (com.data || []).length,
        denunciasPend: (den.data || []).length,
        reconocimientosMes: (rec.data || []).length,
        climaProm,
      });
    })();
  }, [restauranteId, tab]);

  return (
    <div style={{height:'100%', display:'flex', flexDirection:'column', background:S.bg, color:S.t1, fontFamily:"'DM Sans',sans-serif", overflow:'hidden'}}>
      {toast && <div style={{position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:S.bg4, border:`1px solid ${S.crew}`, color:S.t1, padding:'10px 28px', borderRadius:50, fontSize:13, fontWeight:700, zIndex:9999}}>{toast}</div>}

      {/* Header */}
      <div style={{padding:'14px 24px', borderBottom:`1px solid ${S.border}`, background:S.bg2, display:'flex', alignItems:'center', gap:14, flexShrink:0, flexWrap:'wrap'}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <div style={{width:44, height:44, borderRadius:13, background:`linear-gradient(135deg,${S.crew},#d44525)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22}}>📱</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900}}>SERATTA CREW · ADMIN</div>
            <div style={{fontSize:10, color:S.t3, letterSpacing:'.1em', textTransform:'uppercase'}}>Backoffice app del crew · {activeRestaurant.nombre}</div>
          </div>
        </div>
        <div style={{marginLeft:'auto', display:'flex', gap:16}}>
          <Kpi label="Empleados"  value={String(kpis.empleadosActivos)} color={S.crew}/>
          <Kpi label="Sin login"  value={String(kpis.sinLogin)}        color={kpis.sinLogin>0?S.gold:S.green}/>
          <Kpi label="Comunic."   value={String(kpis.comunicadosPub)}  color={S.cyan}/>
          <Kpi label="Denuncias"  value={String(kpis.denunciasPend)}   color={kpis.denunciasPend>0?S.red:S.green} pulse={kpis.denunciasPend>0}/>
          <Kpi label="Recon. mes" value={String(kpis.reconocimientosMes)} color={S.gold}/>
          <Kpi label="Clima"      value={kpis.climaProm>0?String(kpis.climaProm)+'/10':'—'} color={kpis.climaProm>=7?S.green:kpis.climaProm>=5?S.gold:kpis.climaProm>0?S.red:S.t2}/>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex', borderBottom:`1px solid ${S.border}`, background:S.bg2, padding:'0 24px', flexShrink:0, overflowX:'auto'}}>
        {[
          {id:'empleados'       as const, label:'👥 Empleados'},
          {id:'comunicados'     as const, label:'📢 Comunicados'},
          {id:'reconocimientos' as const, label:'🏆 Reconocimientos'},
          {id:'foro'            as const, label:'💬 Foro'},
          {id:'denuncias'       as const, label:`🛡️ Denuncias${kpis.denunciasPend>0?` · ${kpis.denunciasPend}`:''}`},
          {id:'academia'        as const, label:'🎓 Academia'},
          {id:'clima'           as const, label:'❤️ Clima'},
        ].map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:'12px 18px', background:'none', border:'none', borderBottom:`2px solid ${tab===t.id?S.crew:'transparent'}`, color:tab===t.id?S.crew:S.t3, fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap'}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{flex:1, overflow:'hidden'}}>
        {tab==='empleados'       && <EmpleadosTab restauranteId={restauranteId} isGerencia={isGerencia} showToast={showToast}/>}
        {tab==='comunicados'     && <ComunicadosTab restauranteId={restauranteId} isGerencia={isGerencia} miNombre={miNombre} showToast={showToast}/>}
        {tab==='reconocimientos' && <ReconocimientosTab restauranteId={restauranteId}/>}
        {tab==='foro'            && <ForoTab restauranteId={restauranteId} isGerencia={isGerencia} showToast={showToast}/>}
        {tab==='denuncias'       && <DenunciasTab restauranteId={restauranteId} isGerencia={isGerencia} miNombre={miNombre} showToast={showToast}/>}
        {tab==='academia'        && <AcademiaTab restauranteId={restauranteId} isGerencia={isGerencia} showToast={showToast}/>}
        {tab==='clima'           && <ClimaTab restauranteId={restauranteId}/>}
      </div>
    </div>
  );
}

function Kpi({label, value, color, pulse}: {label:string, value:string, color:string, pulse?:boolean}) {
  return (
    <div style={{textAlign:'center', minWidth:64}}>
      <div style={{fontSize:9, color:S.t3, textTransform:'uppercase'}}>{label}</div>
      <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900, color, animation: pulse?'pulse 1.5s ease-in-out infinite':'none'}}>{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 1 · EMPLEADOS
// ═══════════════════════════════════════════════════════════════════════
function EmpleadosTab({ restauranteId, isGerencia, showToast }: any) {
  const [emp, setEmp] = useState<any[]>([]);
  const [filtroRol, setFiltroRol] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [editing, setEditing] = useState<any|null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('vista_empleados_crew').select('*').order('nombre_completo');
    setEmp(data || []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const roles = Array.from(new Set(emp.map((e:any)=>e.rol).filter(Boolean)));
  const filtrados = emp
    .filter(e => filtroRol==='todos' || e.rol===filtroRol)
    .filter(e => !busca || (e.nombre_completo||'').toLowerCase().includes(busca.toLowerCase()) || (e.email||'').toLowerCase().includes(busca.toLowerCase()));

  const sendMagicLink = async (e:any) => {
    if (!e.email) { showToast('⚠ Sin email'); return; }
    const { error } = await supabase.auth.signInWithOtp({ email: e.email });
    if (error) showToast(`⚠ ${error.message}`);
    else showToast(`📧 Magic link enviado a ${e.email}`);
  };

  const toggleActivo = async (e:any) => {
    await supabase.from('empleados').update({ activo: !e.activo }).eq('id', e.id);
    cargar();
  };

  return (
    <div style={{height:'100%', overflowY:'auto', padding:24}}>
      <div style={{display:'flex', alignItems:'center', marginBottom:14, gap:10, flexWrap:'wrap'}}>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por nombre o email…"
          style={{flex:1, minWidth:200, padding:'10px 14px', borderRadius:10, border:`1px solid ${S.border2}`, background:'rgba(255,255,255,0.04)', color:S.t1, fontSize:13, outline:'none'}}/>
        <select value={filtroRol} onChange={e=>setFiltroRol(e.target.value)} style={{padding:'10px 14px', borderRadius:10, border:`1px solid ${S.border2}`, background:S.bg4, color:S.t1, fontSize:12, outline:'none', colorScheme:'dark'}}>
          <option value="todos" style={{background:S.bg4}}>Todos los roles</option>
          {roles.map(r => <option key={r} value={r} style={{background:S.bg4}}>{r}</option>)}
        </select>
      </div>

      <div style={{background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, overflow:'hidden'}}>
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead style={{background:S.bg3}}>
            <tr>
              {['Empleado','Rol','Email','App','NX','Estado','Acciones'].map(h => (
                <th key={h} style={{padding:'12px 14px', textAlign:'left', fontSize:10, color:S.t3, textTransform:'uppercase', letterSpacing:'.05em', fontWeight:700}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((e, i) => (
              <tr key={e.id} style={{borderTop:`1px solid ${S.border}`, background: i%2===0?'transparent':'rgba(255,255,255,0.015)'}}>
                <td style={{padding:'11px 14px', display:'flex', alignItems:'center', gap:10}}>
                  <div style={{width:32, height:32, borderRadius:'50%', background:`${S.crew}25`, color:S.crew, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:11}}>{e.avatar_iniciales || (e.nombre_completo||'?').slice(0,2).toUpperCase()}</div>
                  <div>
                    <div style={{fontSize:13, color:S.t1, fontWeight:700}}>{e.nombre_completo || '—'}</div>
                    <div style={{fontSize:10, color:S.t3}}>{e.cargo_display || ''}</div>
                  </div>
                </td>
                <td style={{padding:'11px 14px', fontSize:11, color:S.t2}}>{e.rol}</td>
                <td style={{padding:'11px 14px', fontSize:11, color:S.t3}}>{e.email || '—'}</td>
                <td style={{padding:'11px 14px', textAlign:'center'}}>
                  {e.tiene_login
                    ? <span style={{fontSize:9, padding:'3px 8px', borderRadius:50, background:`${S.green}20`, color:S.green, fontWeight:900}}>✓ Activo</span>
                    : <span style={{fontSize:9, padding:'3px 8px', borderRadius:50, background:`${S.gold}20`, color:S.gold, fontWeight:900}}>Sin login</span>}
                </td>
                <td style={{padding:'11px 14px', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:900, color:S.crew}}>{(e.nx_saldo||0).toLocaleString('es-CO')}</td>
                <td style={{padding:'11px 14px'}}>
                  <button onClick={()=>toggleActivo(e)} style={{padding:'4px 10px', borderRadius:7, border:`1px solid ${e.activo?S.green:S.red}40`, background:'transparent', color:e.activo?S.green:S.red, fontSize:10, fontWeight:700, cursor:'pointer'}}>
                    {e.activo?'Activo':'Inactivo'}
                  </button>
                </td>
                <td style={{padding:'11px 14px'}}>
                  <div style={{display:'flex', gap:6}}>
                    {e.email && (
                      <button onClick={()=>sendMagicLink(e)} title="Enviar magic link"
                        style={{padding:'5px 9px', borderRadius:7, border:`1px solid ${S.blue}40`, background:`${S.blue}10`, color:S.blue, fontSize:10, fontWeight:700, cursor:'pointer'}}>📧 Magic link</button>
                    )}
                    <button onClick={()=>setEditing(e)} title="Ver detalle"
                      style={{padding:'5px 9px', borderRadius:7, border:`1px solid ${S.border2}`, background:'transparent', color:S.t2, fontSize:10, fontWeight:700, cursor:'pointer'}}>Ver</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && <div style={{padding:40, textAlign:'center', color:S.t3, fontSize:12}}>Sin empleados que coincidan</div>}
      </div>

      {editing && (
        <div onClick={()=>setEditing(null)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0f0f1a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, width:'100%', maxWidth:420, padding:24}}>
            <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:18}}>
              <div style={{width:54, height:54, borderRadius:'50%', background:`${S.crew}30`, color:S.crew, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:18}}>{editing.avatar_iniciales}</div>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900}}>{editing.nombre_completo}</div>
                <div style={{fontSize:11, color:S.t3}}>{editing.cargo_display} · {editing.rol}</div>
              </div>
            </div>
            <Row k="Email" v={editing.email || '—'}/>
            <Row k="Cédula" v={editing.cedula || '—'}/>
            <Row k="Ingreso" v={editing.fecha_ingreso ? new Date(editing.fecha_ingreso).toLocaleDateString('es-CO') : '—'}/>
            <Row k="Vacaciones" v={`${editing.vacaciones_dias || 0} días`}/>
            <Row k="Salario base" v={fmtCOP(editing.salario_base || 0)}/>
            <Row k="Complejo" v={editing.complejo || '—'}/>
            <Row k="Puntos NX" v={`${(editing.nx_saldo||0).toLocaleString('es-CO')} pts`}/>
            <Row k="App login" v={editing.tiene_login ? '✓ Activo' : 'Sin login'}/>
            <button onClick={()=>setEditing(null)} style={{marginTop:14, width:'100%', padding:'10px', borderRadius:9, border:`1px solid ${S.border2}`, background:'transparent', color:S.t2, fontSize:12, fontWeight:700, cursor:'pointer'}}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({k, v}: {k:string; v:string}) {
  return (
    <div style={{display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${S.border}`}}>
      <span style={{fontSize:11, color:S.t3}}>{k}</span>
      <span style={{fontSize:12, color:S.t1, fontWeight:700}}>{v}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 2 · COMUNICADOS
// ═══════════════════════════════════════════════════════════════════════
function ComunicadosTab({ restauranteId, isGerencia, miNombre, showToast }: any) {
  const [data, setData] = useState<any[]>([]);
  const [editing, setEditing] = useState<any|null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('crew_comunicados').select('*').eq('restaurante_id', restauranteId).order('created_at', { ascending:false });
    setData(data || []);
  }, [restauranteId]);
  useEffect(() => { cargar(); }, [cargar]);

  const nuevo = () => setEditing({ restaurante_id: restauranteId, titulo:'', mensaje:'', prioridad:'normal', publicado:false });
  const guardar = async () => {
    if (!editing.titulo || !editing.mensaje) { showToast('⚠ Título y mensaje requeridos'); return; }
    const payload = { ...editing };
    if (payload.publicado && !payload.publicado_en) { payload.publicado_en = new Date().toISOString(); payload.publicado_por = miNombre; }
    if (payload.id) await supabase.from('crew_comunicados').update(payload).eq('id', payload.id);
    else await supabase.from('crew_comunicados').insert(payload);
    setEditing(null); cargar();
    showToast('✓ Comunicado guardado');
  };
  const eliminar = async () => {
    if (!editing?.id) { setEditing(null); return; }
    if (!confirm(`¿Eliminar "${editing.titulo}"?`)) return;
    await supabase.from('crew_comunicados').delete().eq('id', editing.id);
    setEditing(null); cargar();
  };

  const PRIO = { normal:{c:S.blue,l:'Normal'}, importante:{c:S.gold,l:'⚡ Importante'}, urgente:{c:S.red,l:'🔥 Urgente'} } as const;

  return (
    <div style={{height:'100%', overflowY:'auto', padding:24}}>
      <div style={{display:'flex', alignItems:'center', marginBottom:18, gap:12}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900}}>📢 Comunicados al crew</div>
          <div style={{fontSize:11, color:S.t3}}>Anuncios que aparecen en la home de la app Seratta Crew</div>
        </div>
        {isGerencia && <button onClick={nuevo} style={{marginLeft:'auto', padding:'9px 18px', borderRadius:10, border:'none', background:`linear-gradient(135deg,${S.crew},#d44525)`, color:'#fff', fontSize:12, fontWeight:900, cursor:'pointer'}}>+ Nuevo comunicado</button>}
      </div>

      {data.length === 0 && <div style={{padding:60, textAlign:'center', color:S.t3}}><div style={{fontSize:50, marginBottom:12}}>📢</div><div>Sin comunicados aún</div></div>}

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12}}>
        {data.map(c => {
          const pr = PRIO[c.prioridad as keyof typeof PRIO] || PRIO.normal;
          return (
            <button key={c.id} onClick={()=>isGerencia && setEditing(c)}
              style={{background:S.bg2, border:`1px solid ${pr.c}30`, borderLeft:`4px solid ${pr.c}`, borderRadius:11, padding:14, cursor:isGerencia?'pointer':'default', textAlign:'left' as const}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                <span style={{fontSize:9, padding:'2px 8px', borderRadius:50, background:`${pr.c}20`, color:pr.c, fontWeight:800}}>{pr.l}</span>
                {c.publicado
                  ? <span style={{fontSize:9, padding:'2px 8px', borderRadius:50, background:`${S.green}20`, color:S.green, fontWeight:800}}>✓ Publicado</span>
                  : <span style={{fontSize:9, padding:'2px 8px', borderRadius:50, background:`${S.t3}20`, color:S.t3, fontWeight:800}}>Borrador</span>}
                <span style={{marginLeft:'auto', fontSize:10, color:S.t3}}>{c.vistas||0} 👁</span>
              </div>
              <div style={{fontSize:14, color:S.t1, fontWeight:700, marginBottom:5}}>{c.titulo}</div>
              <div style={{fontSize:11, color:S.t2, lineHeight:1.4}}>{(c.mensaje||'').slice(0,120)}{(c.mensaje||'').length>120?'…':''}</div>
            </button>
          );
        })}
      </div>

      {editing && (
        <div onClick={()=>setEditing(null)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0f0f1a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, width:'100%', maxWidth:480, padding:24, maxHeight:'90vh', overflowY:'auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900, marginBottom:14, color:S.crew}}>{editing.id?'Editar':'Nuevo'} comunicado</div>
            <Field label="Título"><input value={editing.titulo||''} onChange={e=>setEditing((p:any)=>({...p, titulo:e.target.value}))} style={inp}/></Field>
            <Field label="Mensaje"><textarea value={editing.mensaje||''} onChange={e=>setEditing((p:any)=>({...p, mensaje:e.target.value}))} rows={5} style={{...inp, resize:'vertical'}}/></Field>
            <Field label="Prioridad">
              <div style={{display:'flex', gap:6}}>
                {(['normal','importante','urgente'] as const).map(p => (
                  <button key={p} onClick={()=>setEditing((x:any)=>({...x, prioridad:p}))} style={{flex:1, padding:'9px', borderRadius:8, border:`1px solid ${editing.prioridad===p?PRIO[p].c:S.border2}`, background:editing.prioridad===p?`${PRIO[p].c}20`:'transparent', color:editing.prioridad===p?PRIO[p].c:S.t2, fontSize:11, fontWeight:700, cursor:'pointer'}}>{PRIO[p].l}</button>
                ))}
              </div>
            </Field>
            <Field label="Link (opcional)"><input value={editing.link_url||''} onChange={e=>setEditing((p:any)=>({...p, link_url:e.target.value}))} placeholder="https://..." style={inp}/></Field>
            <label style={{display:'flex', alignItems:'center', gap:8, marginBottom:14, color:S.t1, fontSize:12, cursor:'pointer'}}>
              <input type="checkbox" checked={!!editing.publicado} onChange={e=>setEditing((p:any)=>({...p, publicado:e.target.checked}))}/>
              <span><strong>Publicar al crew</strong> · visible en la app inmediatamente</span>
            </label>
            <div style={{display:'flex', gap:8}}>
              {editing.id && <button onClick={eliminar} style={{padding:'10px 14px', borderRadius:9, border:'1px solid rgba(255,82,82,0.4)', background:'rgba(255,82,82,0.1)', color:S.red, fontSize:12, fontWeight:700, cursor:'pointer'}}>Eliminar</button>}
              <button onClick={()=>setEditing(null)} style={{flex:1, padding:'10px 14px', borderRadius:9, border:`1px solid ${S.border2}`, background:'transparent', color:S.t2, fontSize:12, fontWeight:700, cursor:'pointer'}}>Cancelar</button>
              <button onClick={guardar} style={{flex:2, padding:'10px 14px', borderRadius:9, border:'none', background:`linear-gradient(135deg,${S.crew},#d44525)`, color:'#fff', fontSize:12, fontWeight:900, cursor:'pointer'}}>{editing.publicado?'✓ Publicar':'Guardar borrador'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 3 · RECONOCIMIENTOS
// ═══════════════════════════════════════════════════════════════════════
function ReconocimientosTab({ restauranteId }: any) {
  const [data, setData] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<Record<number, any>>({});

  useEffect(() => {
    (async () => {
      const [r, e] = await Promise.all([
        supabase.from('reconocimientos').select('*').order('created_at', { ascending:false }).limit(200),
        supabase.from('empleados').select('id,nombre_completo,avatar_iniciales,rol').eq('restaurante_id', restauranteId),
      ]);
      setData(r.data || []);
      const map: Record<number, any> = {};
      (e.data || []).forEach((x:any) => { map[x.id] = x; });
      setEmpleados(map);
    })();
  }, [restauranteId]);

  // Ranking: cuenta veces que cada empleado recibió reconocimiento
  const ranking = useMemo(() => {
    const c: Record<number, number> = {};
    data.forEach(r => { c[r.a_empleado_id] = (c[r.a_empleado_id]||0) + 1; });
    return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,5);
  }, [data]);

  return (
    <div style={{height:'100%', overflowY:'auto', padding:24}}>
      <div style={{display:'flex', alignItems:'center', marginBottom:18, gap:12, flexWrap:'wrap'}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900}}>🏆 Reconocimientos entre el crew</div>
          <div style={{fontSize:11, color:S.t3}}>Los empleados se reconocen desde la app · {data.length} totales</div>
        </div>
      </div>

      {/* Top reconocidos */}
      {ranking.length > 0 && (
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11, color:S.t2, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8}}>👑 Top reconocidos</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10}}>
            {ranking.map(([id, count]:any, i) => {
              const emp = empleados[id];
              if (!emp) return null;
              const colorRk = i===0?S.gold:i===1?S.cyan:i===2?S.purple:S.t2;
              return (
                <div key={id} style={{background:S.bg2, border:`1px solid ${colorRk}40`, borderRadius:11, padding:12, display:'flex', alignItems:'center', gap:10}}>
                  <div style={{width:36, height:36, borderRadius:'50%', background:`${colorRk}25`, color:colorRk, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontFamily:"'Syne',sans-serif"}}>#{i+1}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:12, fontWeight:700, color:S.t1}}>{emp.nombre_completo}</div>
                    <div style={{fontSize:10, color:S.t3}}>{emp.rol}</div>
                  </div>
                  <div style={{fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:900, color:colorRk}}>{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feed completo */}
      <div style={{fontSize:11, color:S.t2, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8}}>📜 Feed reciente</div>
      <div style={{background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, overflow:'hidden'}}>
        {data.length === 0 ? (
          <div style={{padding:40, textAlign:'center', color:S.t3, fontSize:12}}>Aún sin reconocimientos</div>
        ) : data.slice(0, 50).map((r, i) => {
          const de = empleados[r.de_empleado_id];
          const a = empleados[r.a_empleado_id];
          return (
            <div key={r.id} style={{padding:'12px 18px', borderTop:i===0?'none':`1px solid ${S.border}`, display:'flex', alignItems:'center', gap:12}}>
              <span style={{fontSize:22}}>{r.tipo === 'estrella' ? '⭐' : r.tipo === 'fuego' ? '🔥' : r.tipo === 'cohete' ? '🚀' : '🏆'}</span>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:12, color:S.t1}}>
                  <span style={{fontWeight:700, color:S.cyan}}>{de?.nombre_completo || 'Anónimo'}</span>
                  <span style={{color:S.t3}}> → </span>
                  <span style={{fontWeight:700, color:S.gold}}>{a?.nombre_completo || '—'}</span>
                </div>
                {r.mensaje && <div style={{fontSize:11, color:S.t2, fontStyle:'italic', marginTop:3}}>"{r.mensaje}"</div>}
              </div>
              <div style={{fontSize:10, color:S.t3, whiteSpace:'nowrap'}}>{new Date(r.created_at).toLocaleDateString('es-CO',{day:'numeric',month:'short'})}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 4 · FORO (moderación)
// ═══════════════════════════════════════════════════════════════════════
function ForoTab({ restauranteId, isGerencia, showToast }: any) {
  const [data, setData] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<'todos'|'pendientes'|'aprobados'>('todos');

  const cargar = useCallback(async () => {
    let q: any = supabase.from('foro_posts').select('*').order('created_at', { ascending:false }).limit(200);
    if (filtro==='pendientes') q = q.eq('moderado', false);
    else if (filtro==='aprobados') q = q.eq('moderado', true);
    const { data } = await q;
    setData(data || []);
  }, [filtro]);
  useEffect(() => { cargar(); }, [cargar]);

  const aprobar = async (post:any) => {
    await supabase.from('foro_posts').update({ moderado: true }).eq('id', post.id);
    cargar();
    showToast('✓ Post aprobado');
  };
  const eliminar = async (post:any) => {
    if (!confirm('¿Eliminar este post del foro?')) return;
    await supabase.from('foro_posts').delete().eq('id', post.id);
    cargar();
    showToast('Post eliminado');
  };

  return (
    <div style={{height:'100%', overflowY:'auto', padding:24}}>
      <div style={{display:'flex', alignItems:'center', marginBottom:14, gap:12, flexWrap:'wrap'}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900}}>💬 Foro del crew</div>
          <div style={{fontSize:11, color:S.t3}}>Posts en "Mi Equipo" desde la app · {data.length} publicados</div>
        </div>
        <div style={{marginLeft:'auto', display:'flex', gap:6}}>
          {(['todos','pendientes','aprobados'] as const).map(f => (
            <button key={f} onClick={()=>setFiltro(f)} style={{padding:'7px 14px', borderRadius:9, border:`1px solid ${filtro===f?S.crew:S.border2}`, background:filtro===f?`${S.crew}18`:'transparent', color:filtro===f?S.crew:S.t2, fontSize:11, fontWeight:700, cursor:'pointer', textTransform:'capitalize'}}>{f}</button>
          ))}
        </div>
      </div>

      <div style={{background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, overflow:'hidden'}}>
        {data.length === 0 ? (
          <div style={{padding:40, textAlign:'center', color:S.t3, fontSize:12}}>Sin posts</div>
        ) : data.map((post, i) => (
          <div key={post.id} style={{padding:'14px 18px', borderTop:i===0?'none':`1px solid ${S.border}`, display:'flex', gap:12, alignItems:'flex-start'}}>
            <div style={{width:32, height:32, borderRadius:'50%', background:'#1e1e2e', color:S.t2, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0}}>{post.anonimo?'?':'👤'}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap'}}>
                <span style={{fontSize:10, padding:'2px 8px', borderRadius:50, background:'rgba(255,255,255,0.05)', color:S.t2, fontWeight:700}}>{post.categoria || 'general'}</span>
                {post.anonimo && <span style={{fontSize:10, padding:'2px 8px', borderRadius:50, background:`${S.purple}20`, color:S.purple, fontWeight:700}}>🎭 Anónimo</span>}
                {!post.moderado && <span style={{fontSize:10, padding:'2px 8px', borderRadius:50, background:`${S.gold}20`, color:S.gold, fontWeight:800}}>Sin moderar</span>}
                <span style={{marginLeft:'auto', fontSize:10, color:S.t3}}>{post.likes || 0} 👍 · {new Date(post.created_at).toLocaleDateString('es-CO',{day:'numeric',month:'short'})}</span>
              </div>
              <div style={{fontSize:12, color:S.t1, lineHeight:1.5}}>{post.contenido}</div>
              {isGerencia && (
                <div style={{display:'flex', gap:6, marginTop:8}}>
                  {!post.moderado && <button onClick={()=>aprobar(post)} style={{padding:'5px 11px', borderRadius:7, border:'none', background:S.green, color:'#000', fontSize:10, fontWeight:700, cursor:'pointer'}}>✓ Aprobar</button>}
                  <button onClick={()=>eliminar(post)} style={{padding:'5px 11px', borderRadius:7, border:`1px solid ${S.red}40`, background:'transparent', color:S.red, fontSize:10, fontWeight:700, cursor:'pointer'}}>🗑 Eliminar</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 5 · DENUNCIAS
// ═══════════════════════════════════════════════════════════════════════
function DenunciasTab({ restauranteId, isGerencia, miNombre, showToast }: any) {
  const [data, setData] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<string>('recibido');
  const [editing, setEditing] = useState<any|null>(null);

  const cargar = useCallback(async () => {
    let q: any = supabase.from('crew_denuncias').select('*').eq('restaurante_id', restauranteId);
    if (filtro !== 'todas') q = q.eq('estado', filtro);
    q = q.order('created_at', { ascending:false });
    const { data } = await q;
    setData(data || []);
  }, [restauranteId, filtro]);
  useEffect(() => { cargar(); }, [cargar]);

  const cambiarEstado = async (d:any, nuevoEstado:string, resolucion?:string) => {
    await supabase.from('crew_denuncias').update({
      estado: nuevoEstado,
      revisado_por: miNombre,
      ...(['resuelto','cerrado_sin_accion'].includes(nuevoEstado) && resolucion ? { resolucion, fecha_resolucion: new Date().toISOString() } : {}),
    }).eq('id', d.id);
    setEditing(null); cargar();
    showToast(`✓ Marcado como ${nuevoEstado}`);
  };

  const ESTADOS = [
    { id:'recibido', label:'Recibidos', color:S.gold },
    { id:'revisando', label:'Revisando', color:S.blue },
    { id:'resuelto', label:'Resueltos', color:S.green },
    { id:'escalado', label:'Escalados', color:S.red },
    { id:'cerrado_sin_accion', label:'Cerrados', color:S.t2 },
    { id:'todas', label:'Todas', color:S.t3 },
  ];

  return (
    <div style={{height:'100%', overflowY:'auto', padding:24}}>
      <div style={{display:'flex', alignItems:'center', marginBottom:14, gap:12, flexWrap:'wrap'}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900}}>🛡️ Denuncias y reportes</div>
          <div style={{fontSize:11, color:S.t3}}>Casos enviados desde la app · confidencialidad estricta</div>
        </div>
        <div style={{marginLeft:'auto', display:'flex', gap:6, flexWrap:'wrap'}}>
          {ESTADOS.map(e => (
            <button key={e.id} onClick={()=>setFiltro(e.id)} style={{padding:'7px 14px', borderRadius:9, border:`1px solid ${filtro===e.id?e.color:S.border2}`, background:filtro===e.id?`${e.color}18`:'transparent', color:filtro===e.id?e.color:S.t2, fontSize:11, fontWeight:700, cursor:'pointer'}}>{e.label}</button>
          ))}
        </div>
      </div>

      <div style={{background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, overflow:'hidden'}}>
        {data.length === 0 ? (
          <div style={{padding:60, textAlign:'center', color:S.t3}}><div style={{fontSize:50, marginBottom:12}}>🛡️</div><div style={{fontSize:13, fontWeight:700}}>Sin denuncias en este filtro</div></div>
        ) : data.map((d, i) => {
          const estCol = d.estado==='recibido'?S.gold:d.estado==='revisando'?S.blue:d.estado==='resuelto'?S.green:d.estado==='escalado'?S.red:S.t2;
          const priCol = d.prioridad==='urgente'?S.red:d.prioridad==='alta'?S.gold:S.t2;
          return (
            <button key={d.id} onClick={()=>setEditing(d)} style={{width:'100%', padding:'14px 18px', borderTop:i===0?'none':`1px solid ${S.border}`, background:'transparent', border:'none', cursor:'pointer', textAlign:'left' as const}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap'}}>
                <span style={{fontSize:10, padding:'2px 8px', borderRadius:50, background:`${estCol}20`, color:estCol, fontWeight:800, textTransform:'uppercase'}}>{d.estado}</span>
                <span style={{fontSize:10, padding:'2px 8px', borderRadius:50, background:`${priCol}20`, color:priCol, fontWeight:700}}>{d.prioridad}</span>
                {d.anonima && <span style={{fontSize:10, padding:'2px 8px', borderRadius:50, background:`${S.purple}20`, color:S.purple, fontWeight:700}}>🎭 Anónima</span>}
                <span style={{fontSize:10, padding:'2px 8px', borderRadius:50, background:'rgba(255,255,255,0.05)', color:S.t2, fontWeight:700}}>{d.tipo}</span>
                <span style={{marginLeft:'auto', fontSize:10, color:S.t3}}>{d.numero_reporte || `#${d.id}`} · {new Date(d.created_at).toLocaleDateString('es-CO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
              </div>
              <div style={{fontSize:13, color:S.t1, fontWeight:700, marginBottom:3}}>{d.asunto}</div>
              {d.descripcion && <div style={{fontSize:11, color:S.t2, lineHeight:1.4}}>{d.descripcion.slice(0,180)}{d.descripcion.length>180?'…':''}</div>}
            </button>
          );
        })}
      </div>

      {editing && (
        <div onClick={()=>setEditing(null)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0f0f1a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, width:'100%', maxWidth:520, padding:24, maxHeight:'90vh', overflowY:'auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900, marginBottom:6, color:S.crew}}>{editing.numero_reporte || `Reporte #${editing.id}`}</div>
            <div style={{fontSize:11, color:S.t3, marginBottom:14}}>{editing.anonima ? '🎭 Anónima' : `Por ${editing.empleado_nombre}`} · {editing.tipo}</div>
            <div style={{padding:12, background:S.bg3, borderRadius:9, marginBottom:14}}>
              <div style={{fontSize:13, fontWeight:700, color:S.t1, marginBottom:6}}>{editing.asunto}</div>
              <div style={{fontSize:12, color:S.t2, lineHeight:1.6, whiteSpace:'pre-wrap'}}>{editing.descripcion}</div>
            </div>
            {editing.resolucion && (
              <div style={{padding:12, background:`${S.green}10`, border:`1px solid ${S.green}30`, borderRadius:9, marginBottom:14}}>
                <div style={{fontSize:10, color:S.green, fontWeight:800, marginBottom:4, textTransform:'uppercase'}}>Resolución</div>
                <div style={{fontSize:12, color:S.t1}}>{editing.resolucion}</div>
                <div style={{fontSize:10, color:S.t3, marginTop:4}}>Por {editing.revisado_por} · {new Date(editing.fecha_resolucion).toLocaleString('es-CO')}</div>
              </div>
            )}
            {isGerencia && (
              <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                {['recibido','revisando','escalado'].map(es => (
                  <button key={es} onClick={()=>cambiarEstado(editing, es)} style={{padding:'8px 14px', borderRadius:9, border:`1px solid ${S.border2}`, background:'transparent', color:S.t2, fontSize:11, fontWeight:700, cursor:'pointer', textTransform:'capitalize'}}>{es}</button>
                ))}
                <button onClick={()=>{ const r = prompt('Describe la resolución:'); if (r) cambiarEstado(editing, 'resuelto', r); }} style={{padding:'8px 14px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#3dba6f,#00B050)', color:'#fff', fontSize:11, fontWeight:900, cursor:'pointer'}}>✓ Resolver</button>
                <button onClick={()=>{ const r = prompt('Motivo del cierre sin acción:'); if (r) cambiarEstado(editing, 'cerrado_sin_accion', r); }} style={{padding:'8px 14px', borderRadius:9, border:`1px solid ${S.border2}`, background:'transparent', color:S.t3, fontSize:11, fontWeight:700, cursor:'pointer'}}>Cerrar sin acción</button>
              </div>
            )}
            <button onClick={()=>setEditing(null)} style={{marginTop:12, width:'100%', padding:'8px', borderRadius:9, border:`1px solid ${S.border2}`, background:'transparent', color:S.t3, fontSize:11, fontWeight:700, cursor:'pointer'}}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 6 · ACADEMIA
// ═══════════════════════════════════════════════════════════════════════
function AcademiaTab({ restauranteId, isGerencia, showToast }: any) {
  const [cursos, setCursos] = useState<any[]>([]);
  const [editing, setEditing] = useState<any|null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('academia_cursos').select('*').eq('restaurante_id', restauranteId).order('orden_ux', { ascending: true, nullsFirst: false }).order('titulo');
    setCursos(data || []);
  }, [restauranteId]);
  useEffect(() => { cargar(); }, [cargar]);

  const nuevo = () => setEditing({ restaurante_id:restauranteId, titulo:'', categoria:'servicio', nivel:'basico', puntos:50, emoji:'🎓', activo:true });
  const guardar = async () => {
    if (!editing.titulo) { showToast('⚠ Título requerido'); return; }
    const payload = { ...editing, updated_at: new Date().toISOString() };
    if (payload.id) await supabase.from('academia_cursos').update(payload).eq('id', payload.id);
    else await supabase.from('academia_cursos').insert(payload);
    setEditing(null); cargar();
    showToast('✓ Curso guardado');
  };
  const eliminar = async () => {
    if (!editing?.id) { setEditing(null); return; }
    if (!confirm(`¿Eliminar "${editing.titulo}"?`)) return;
    await supabase.from('academia_cursos').delete().eq('id', editing.id);
    setEditing(null); cargar();
  };

  const CATS = ['servicio','cocina','bar','liderazgo','salud','otros'];
  const NIVS = ['basico','intermedio','avanzado'];

  return (
    <div style={{height:'100%', overflowY:'auto', padding:24}}>
      <div style={{display:'flex', alignItems:'center', marginBottom:18, gap:12}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900}}>🎓 Academia</div>
          <div style={{fontSize:11, color:S.t3}}>Cursos visibles en la app · {cursos.length} catálogo</div>
        </div>
        {isGerencia && <button onClick={nuevo} style={{marginLeft:'auto', padding:'9px 18px', borderRadius:10, border:'none', background:`linear-gradient(135deg,${S.gold},#d4943a)`, color:'#000', fontSize:12, fontWeight:900, cursor:'pointer'}}>+ Nuevo curso</button>}
      </div>

      {cursos.length === 0 && <div style={{padding:60, textAlign:'center', color:S.t3}}><div style={{fontSize:50, marginBottom:12}}>🎓</div><div style={{fontSize:14, fontWeight:700}}>Catálogo vacío</div><div style={{fontSize:11, color:S.t3, marginTop:6}}>Crea cursos para que aparezcan en la pestaña Academia de la app.</div></div>}

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:12}}>
        {cursos.map(c => (
          <button key={c.id} onClick={()=>isGerencia && setEditing(c)} style={{background:S.bg2, border:`1px solid ${c.activo?S.gold+'30':S.border}`, borderRadius:12, padding:14, cursor:isGerencia?'pointer':'default', textAlign:'left' as const, opacity:c.activo?1:0.5}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
              <span style={{fontSize:24}}>{c.emoji||'🎓'}</span>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:13, fontWeight:700, color:S.t1}}>{c.titulo}</div>
                <div style={{fontSize:10, color:S.t3}}>{c.categoria} · {c.nivel}</div>
              </div>
              {c.obligatorio && <span style={{fontSize:9, padding:'2px 7px', borderRadius:50, background:`${S.red}20`, color:S.red, fontWeight:800}}>OBLIG</span>}
            </div>
            {c.descripcion && <div style={{fontSize:11, color:S.t2, lineHeight:1.4, marginBottom:8}}>{c.descripcion.slice(0,80)}{c.descripcion.length>80?'…':''}</div>}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:10, color:S.t3}}>
              <span>{c.duracion_min ? `${c.duracion_min} min` : ''}</span>
              <span style={{color:S.gold, fontWeight:700}}>+{c.puntos||0} pts</span>
            </div>
          </button>
        ))}
      </div>

      {editing && (
        <div onClick={()=>setEditing(null)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0f0f1a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, width:'100%', maxWidth:460, padding:24, maxHeight:'90vh', overflowY:'auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900, marginBottom:14, color:S.gold}}>{editing.id?'Editar':'Nuevo'} curso</div>
            <Field label="Título"><input value={editing.titulo||''} onChange={e=>setEditing((p:any)=>({...p, titulo:e.target.value}))} style={inp}/></Field>
            <Field label="Descripción"><textarea value={editing.descripcion||''} onChange={e=>setEditing((p:any)=>({...p, descripcion:e.target.value}))} rows={3} style={{...inp, resize:'vertical'}}/></Field>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              <Field label="Categoría">
                <select value={editing.categoria||'servicio'} onChange={e=>setEditing((p:any)=>({...p, categoria:e.target.value}))} style={{...inp, colorScheme:'dark'}}>
                  {CATS.map(c => <option key={c} value={c} style={{background:S.bg4}}>{c}</option>)}
                </select>
              </Field>
              <Field label="Nivel">
                <select value={editing.nivel||'basico'} onChange={e=>setEditing((p:any)=>({...p, nivel:e.target.value}))} style={{...inp, colorScheme:'dark'}}>
                  {NIVS.map(n => <option key={n} value={n} style={{background:S.bg4}}>{n}</option>)}
                </select>
              </Field>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10}}>
              <Field label="Emoji"><input value={editing.emoji||'🎓'} onChange={e=>setEditing((p:any)=>({...p, emoji:e.target.value}))} style={{...inp, fontSize:18, textAlign:'center'}}/></Field>
              <Field label="Duración (min)"><input type="number" value={editing.duracion_min||''} onChange={e=>setEditing((p:any)=>({...p, duracion_min:Number(e.target.value)}))} style={inp}/></Field>
              <Field label="Puntos"><input type="number" value={editing.puntos||0} onChange={e=>setEditing((p:any)=>({...p, puntos:Number(e.target.value)}))} style={inp}/></Field>
            </div>
            <Field label="Link contenido"><input value={editing.contenido_url||''} onChange={e=>setEditing((p:any)=>({...p, contenido_url:e.target.value}))} placeholder="https://..." style={inp}/></Field>
            <div style={{display:'flex', gap:14, marginBottom:14, marginTop:6}}>
              <label style={{display:'flex', alignItems:'center', gap:6, color:S.t2, fontSize:12, cursor:'pointer'}}>
                <input type="checkbox" checked={!!editing.obligatorio} onChange={e=>setEditing((p:any)=>({...p, obligatorio:e.target.checked}))}/>Obligatorio
              </label>
              <label style={{display:'flex', alignItems:'center', gap:6, color:S.t2, fontSize:12, cursor:'pointer'}}>
                <input type="checkbox" checked={!!editing.activo} onChange={e=>setEditing((p:any)=>({...p, activo:e.target.checked}))}/>Activo
              </label>
            </div>
            <div style={{display:'flex', gap:8}}>
              {editing.id && <button onClick={eliminar} style={{padding:'10px 14px', borderRadius:9, border:'1px solid rgba(255,82,82,0.4)', background:'rgba(255,82,82,0.1)', color:S.red, fontSize:12, fontWeight:700, cursor:'pointer'}}>Eliminar</button>}
              <button onClick={()=>setEditing(null)} style={{flex:1, padding:'10px 14px', borderRadius:9, border:`1px solid ${S.border2}`, background:'transparent', color:S.t2, fontSize:12, fontWeight:700, cursor:'pointer'}}>Cancelar</button>
              <button onClick={guardar} style={{flex:2, padding:'10px 14px', borderRadius:9, border:'none', background:`linear-gradient(135deg,${S.gold},#d4943a)`, color:'#000', fontSize:12, fontWeight:900, cursor:'pointer'}}>✓ Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 7 · CLIMA ORGANIZACIONAL
// ═══════════════════════════════════════════════════════════════════════
function ClimaTab({ restauranteId }: any) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('clima_encuestas').select('*').eq('restaurante_id', restauranteId).order('fecha_respuesta', { ascending:false }).limit(500);
      setData(data || []);
      setLoading(false);
    })();
  }, [restauranteId]);

  const dims = useMemo(() => {
    const calc = (k: string) => {
      const arr = data.map((d:any) => d[k]).filter((x:any) => x>0);
      return arr.length > 0 ? Math.round(arr.reduce((s:number,x:number)=>s+x,0) / arr.length * 10) / 10 : 0;
    };
    const enpsArr = data.map((d:any) => d.enps).filter((x:any) => x>=0 && x<=10);
    let enps = 0;
    if (enpsArr.length > 0) {
      const promotores = enpsArr.filter((x:number) => x>=9).length;
      const detractores = enpsArr.filter((x:number) => x<=6).length;
      enps = Math.round(((promotores - detractores) / enpsArr.length) * 100);
    }
    return {
      jefe: calc('score_jefe'),
      equipo: calc('score_equipo'),
      carga: calc('score_carga'),
      comunicacion: calc('score_comunicacion'),
      general: calc('score_general'),
      enps,
      total: data.length,
      comentarios: data.filter((d:any) => d.comentario).slice(0, 10),
    };
  }, [data]);

  const DIMS = [
    { k:'jefe', l:'👨‍💼 Jefe directo', color:S.blue },
    { k:'equipo', l:'👥 Equipo', color:S.green },
    { k:'carga', l:'⚖️ Carga laboral', color:S.gold },
    { k:'comunicacion', l:'💬 Comunicación', color:S.purple },
    { k:'general', l:'❤️ Sentimiento general', color:S.crew },
  ];

  return (
    <div style={{height:'100%', overflowY:'auto', padding:24}}>
      <div style={{marginBottom:18}}>
        <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900}}>❤️ Clima organizacional</div>
        <div style={{fontSize:11, color:S.t3}}>Encuestas anónimas del crew · {dims.total} respuestas</div>
      </div>

      {loading && <div style={{padding:40, textAlign:'center', color:S.t3}}>Cargando…</div>}

      {!loading && dims.total === 0 && (
        <div style={{padding:60, textAlign:'center', color:S.t3}}>
          <div style={{fontSize:50, marginBottom:12}}>❤️</div>
          <div style={{fontSize:14, fontWeight:700}}>Sin encuestas aún</div>
          <div style={{fontSize:11, color:S.t3, marginTop:6}}>Cuando el crew responda desde la app aparecerán aquí los resultados agregados.</div>
        </div>
      )}

      {!loading && dims.total > 0 && (
        <>
          {/* eNPS gigante */}
          <div style={{padding:20, background:`linear-gradient(135deg, ${dims.enps>=30?'#3dba6f15':'#FFB54715'}, transparent)`, border:`1px solid ${dims.enps>=30?S.green:dims.enps>=0?S.gold:S.red}40`, borderRadius:14, marginBottom:16, display:'flex', alignItems:'center', gap:20}}>
            <div>
              <div style={{fontSize:10, color:S.t3, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4}}>eNPS · ¿Recomendarías Seratta?</div>
              <div style={{fontFamily:"'Syne',sans-serif", fontSize:48, fontWeight:900, color:dims.enps>=30?S.green:dims.enps>=0?S.gold:S.red, lineHeight:1}}>{dims.enps>0?'+':''}{dims.enps}</div>
              <div style={{fontSize:11, color:S.t2, marginTop:4}}>{dims.enps>=30?'Excelente':dims.enps>=0?'Aceptable':'Requiere atención'}</div>
            </div>
            <div style={{flex:1, fontSize:11, color:S.t2, lineHeight:1.6}}>
              <div>Promotores (9-10) vs Detractores (0-6).</div>
              <div style={{fontSize:10, color:S.t3, marginTop:4}}>Meta industria restaurantes: <strong style={{color:S.t1}}>+40</strong></div>
            </div>
          </div>

          {/* Promedios por dimensión */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:10, marginBottom:18}}>
            {DIMS.map(d => {
              const val = dims[d.k as keyof typeof dims] as number;
              const color = val>=7?S.green:val>=5?S.gold:val>0?S.red:S.t3;
              return (
                <div key={d.k} style={{padding:14, background:S.bg2, border:`1px solid ${color}30`, borderRadius:12}}>
                  <div style={{fontSize:11, color:S.t2, marginBottom:6}}>{d.l}</div>
                  <div style={{fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:900, color, lineHeight:1}}>{val>0?val.toFixed(1):'—'}<span style={{fontSize:14, color:S.t3, fontWeight:500}}>{val>0?' / 10':''}</span></div>
                  <div style={{height:4, background:'rgba(255,255,255,0.05)', borderRadius:50, overflow:'hidden', marginTop:8}}>
                    <div style={{height:'100%', background:color, width:`${(val/10)*100}%`}}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comentarios recientes */}
          {dims.comentarios.length > 0 && (
            <div>
              <div style={{fontSize:11, color:S.t2, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8}}>💬 Comentarios recientes</div>
              <div style={{background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, overflow:'hidden'}}>
                {dims.comentarios.map((c:any, i:number) => (
                  <div key={c.id} style={{padding:'12px 18px', borderTop:i===0?'none':`1px solid ${S.border}`}}>
                    <div style={{fontSize:10, color:S.t3, marginBottom:4, display:'flex', justifyContent:'space-between'}}>
                      <span>{c.anonima ? '🎭 Anónimo' : c.empleado_nombre} · {c.rol||'—'}</span>
                      <span>General: <strong style={{color: c.score_general>=7?S.green:c.score_general>=5?S.gold:S.red}}>{c.score_general}/10</strong> · {new Date(c.fecha_respuesta).toLocaleDateString('es-CO',{day:'numeric',month:'short'})}</span>
                    </div>
                    <div style={{fontSize:12, color:S.t1, fontStyle:'italic', lineHeight:1.5}}>"{c.comentario}"</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Estilos compartidos
// ═══════════════════════════════════════════════════════════════════════
const inp: React.CSSProperties = {
  width:'100%', padding:'10px 12px', borderRadius:9,
  border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.04)',
  color:'#fff', fontSize:13, outline:'none',
};
function Field({ label, children }: { label:string; children: React.ReactNode }) {
  return (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:10, color:S.t3, fontWeight:700, marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em'}}>{label}</div>
      {children}
    </div>
  );
}
