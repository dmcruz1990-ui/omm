import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext';
import { useRestaurant } from '../contexts/RestaurantContext';

const S = {
  bg:'#08080f', bg2:'#0f0f1a', bg3:'#161624', bg4:'#1e1e2e',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.12)',
  t1:'#FFFFFF', t2:'#A0A0B8', t3:'#50506A',
  gold:'#FFB547', green:'#00E676', red:'#FF5252',
  blue:'#448AFF', purple:'#B388FF', pink:'#FF2D78', cyan:'#22d3ee',
};
const inp: React.CSSProperties = {
  background:'rgba(255,255,255,0.05)', border:`1px solid rgba(255,255,255,0.12)`,
  borderRadius:10, padding:'10px 14px', color:'#fff', fontSize:13, outline:'none', width:'100%',
};
const lbl: React.CSSProperties = { fontSize:10, color:S.t3, fontWeight:700, marginBottom:5, display:'block', textTransform:'uppercase', letterSpacing:'.08em' };
const fmt = (n:number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtDate = (d:string) => new Date(d).toLocaleDateString('es-CO',{day:'numeric',month:'short'});

type Tab = 'egresos' | 'arqueo' | 'historial' | 'ocr';

const CATEGORIAS_EGRESO = [
  { id:'propina_efectivo', label:'💵 Propina Efectivo', color:S.green,   desc:'Liquidar propinas recaudadas al personal' },
  { id:'compra_menor',     label:'🛒 Compra Menor',    color:S.blue,    desc:'Mercado rápido, insumos urgentes' },
  { id:'mantenimiento',    label:'🔧 Mantenimiento',   color:S.gold,    desc:'Reparaciones y servicios' },
  { id:'transporte',       label:'🚗 Transporte',      color:S.cyan,    desc:'Domicilios, mensajería' },
  { id:'otro',             label:'📋 Otro',            color:S.t2,      desc:'Gastos varios etiquetados' },
];

// Conceptos sugeridos por categoría — el responsable elige uno o "Otro" para
// escribir libre. Evita conceptos como "asdfas" y agrupa para reportes.
const CONCEPTOS_POR_CATEGORIA: Record<string,string[]> = {
  propina_efectivo: ['Liquidación turno noche','Liquidación turno medio día','Pago propina sala','Pago propina barra','Pago propina cocina','Adelanto propina','Otro'],
  compra_menor: ['Aguacates','Limones','Cilantro','Hierbas frescas','Pan','Leche','Huevos','Frutas','Verduras','Hielo','Servilletas','Bolsas','Detergente','Otro'],
  mantenimiento: ['Reparación nevera','Reparación estufa/plancha','Reparación lavavajillas','Aire acondicionado','Plomería','Electricista','Cambio bombillos','Mantenimiento POS/internet','Fumigación','Otro'],
  transporte: ['Domicilio mercado','Taxi compra urgente','Mensajería documentos','Combustible','Parqueadero','Otro'],
  otro: ['Arriendo','Servicios públicos (agua/luz/gas)','Internet/teléfono','Impuestos','Contador','Abogado','Publicidad/marketing','Limpieza profunda','Decoración','Música/SAYCO','Lavandería uniformes','Otro'],
};

export default function FinanceHub() {
  const { profile } = useAuth();
  const { activeId: restauranteId } = useRestaurant();
  const [tab, setTab] = useState<Tab>('egresos');
  const [egresos, setEgresos] = useState<any[]>([]);
  const [arqueo, setArqueo] = useState<any>(null);
  const [facturasOcr, setFacturasOcr] = useState<any[]>([]);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  // Form egresos
  const [formEgreso, setFormEgreso] = useState({ categoria:'propina_efectivo', concepto:'', conceptoCustom:'', valor:'', responsable:'', notas:'' });
  const [guardandoEgreso, setGuardandoEgreso] = useState(false);
  // Foto comprobante (factura/recibo)
  const [comprobanteFile, setComprobanteFile] = useState<File|null>(null);
  const [comprobantePreview, setComprobantePreview] = useState<string>('');
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const comprobanteRef = useRef<HTMLInputElement>(null);
  // Arqueo
  const [arqueoForm, setArqueoForm] = useState({ efectivo_real:'', tarjeta_real:'', datafono_real:'', notas:'' });
  const [guardandoArqueo, setGuardandoArqueo] = useState(false);
  // OCR
  const [ocrFile, setOcrFile] = useState<File|null>(null);
  const [ocrPreview, setOcrPreview] = useState('');
  const [procesandoOcr, setProcesandoOcr] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const show = (m:string) => { setToast(m); setTimeout(()=>setToast(''),3500); };
  const setFE = (k:string,v:string) => setFormEgreso(p=>({...p,[k]:v}));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const [eg, arq, ocr] = await Promise.all([
      supabase.from('egresos').select('*').eq('restaurante_id', restauranteId).eq('fecha',today).order('created_at',{ascending:false}),
      supabase.from('arqueos').select('*').eq('restaurante_id', restauranteId).eq('fecha',today).order('created_at',{ascending:false}).limit(1),
      supabase.from('facturas_ocr').select('*').eq('restaurante_id', restauranteId).order('created_at',{ascending:false}).limit(20),
    ]);
    if (eg.data) setEgresos(eg.data);
    if (arq.data?.[0]) { setArqueo(arq.data[0]); }
    if (ocr.data) setFacturasOcr(ocr.data);
    setLoading(false);
  }, [restauranteId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // El "concepto" final que se guarda: si eligió "Otro" usa el custom, si no usa el del dropdown
  const conceptoFinal = formEgreso.concepto === 'Otro' || formEgreso.concepto === ''
    ? formEgreso.conceptoCustom.trim()
    : formEgreso.concepto;

  const onSelectComprobante = (file: File | null) => {
    setComprobanteFile(file);
    if (!file) { setComprobantePreview(''); return; }
    const reader = new FileReader();
    reader.onload = ev => setComprobantePreview(String(ev.target?.result || ''));
    reader.readAsDataURL(file);
  };

  // ── GUARDAR EGRESO ──────────────────────────────────────────────────────
  const guardarEgreso = async () => {
    if (!conceptoFinal) { show('⚠️ Concepto requerido (elige uno o escribe en Otro)'); return; }
    if (!formEgreso.valor || isNaN(Number(formEgreso.valor))) { show('⚠️ Valor requerido'); return; }
    setGuardandoEgreso(true);
    let comprobanteUrl: string | null = null;
    // Subir foto si la hay
    if (comprobanteFile) {
      setSubiendoFoto(true);
      const ext = comprobanteFile.name.split('.').pop() || 'jpg';
      const path = `egresos/${restauranteId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('ohyeah-fotos').upload(path, comprobanteFile, { upsert:false, contentType: comprobanteFile.type });
      if (!upErr) {
        const { data: pub } = supabase.storage.from('ohyeah-fotos').getPublicUrl(path);
        comprobanteUrl = pub?.publicUrl || null;
      } else {
        show('⚠️ Foto no se pudo subir, guardando egreso sin comprobante');
      }
      setSubiendoFoto(false);
    }
    const ahora = new Date();
    const { error: insErr } = await supabase.from('egresos').insert({
      restaurante_id: restauranteId,
      categoria: formEgreso.categoria,
      concepto: conceptoFinal,
      valor: Number(formEgreso.valor),
      responsable: formEgreso.responsable || profile?.nombre_completo || 'Staff',
      notas: formEgreso.notas,
      factura_foto: comprobanteUrl,
      fecha: ahora.toISOString().split('T')[0],
      hora: ahora.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}),
    });
    if (insErr) {
      show(`⚠️ Error: ${insErr.message}`);
      setGuardandoEgreso(false);
      return;
    }
    show('✓ Egreso registrado');
    setFormEgreso({ categoria:'propina_efectivo', concepto:'', conceptoCustom:'', valor:'', responsable:'', notas:'' });
    onSelectComprobante(null);
    setGuardandoEgreso(false);
    fetchData();
  };

  // ── GUARDAR / CERRAR ARQUEO ─────────────────────────────────────────────
  const cerrarArqueo = async () => {
    setGuardandoArqueo(true);
    const today = new Date().toISOString().split('T')[0];
    // Obtener ventas del sistema
    const { data: facturas } = await supabase.from('facturacion').select('total').eq('restaurante_id', restauranteId).eq('fecha',today);
    const ventasSistema = facturas?.reduce((s:number,f:any) => s+(f.total||0), 0) || 0;
    const egresosTotal = egresos.reduce((s:number,e:any) => s+(e.valor||0), 0);
    const efectivo = Number(arqueoForm.efectivo_real)||0;
    const tarjeta = Number(arqueoForm.tarjeta_real)||0;
    const datafono = Number(arqueoForm.datafono_real)||0;
    const totalReal = efectivo + tarjeta + datafono;
    const diferencia = totalReal - ventasSistema;
    const estado = Math.abs(diferencia) > 20000 ? 'con_diferencia' : 'cerrado';

    const payload = {
      restaurante_id: restauranteId, fecha:today, turno:'noche',
      responsable: profile?.nombre_completo||'Admin',
      ventas_sistema: ventasSistema, efectivo_real:efectivo,
      tarjeta_real:tarjeta, datafono_real:datafono,
      egresos_total: egresosTotal, diferencia,
      estado, notas:arqueoForm.notas,
      cerrado_en: new Date().toISOString(),
    };

    if (arqueo?.id) {
      await supabase.from('arqueos').update(payload).eq('id',arqueo.id);
    } else {
      await supabase.from('arqueos').insert(payload);
    }

    if (estado === 'con_diferencia') {
      show(`⚠️ Diferencia de ${fmt(Math.abs(diferencia))} — Alerta enviada al JP`);
      // Insertar notificación
      await supabase.from('notifications').insert({
        restaurante_id: restauranteId, tipo:'arqueo_diferencia',
        titulo:'Diferencia de caja',
        mensaje:`Diferencia de ${fmt(Math.abs(diferencia))} en el arqueo del turno. Revisar.`,
        urgente:true, leida:false,
      }).then(()=>{}).catch(()=>{});
    } else {
      show('✓ Arqueo cerrado correctamente');
    }
    setGuardandoArqueo(false);
    fetchData();
  };

  // ── OCR CON CLAUDE VISION ───────────────────────────────────────────────
  const procesarOcr = async () => {
    if (!ocrFile) return;
    setProcesandoOcr(true);
    try {
      // Convertir a base64
      const b64 = await new Promise<string>((res,rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(ocrFile);
      });
      const ext = ocrFile.type;
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514', max_tokens:1500,
          messages:[{ role:'user', content:[
            { type:'image', source:{ type:'base64', media_type:ext, data:b64 } },
            { type:'text', text:`Analiza esta factura de proveedor colombiana. Extrae SOLO un JSON sin texto adicional:
{
  "proveedor": "nombre del proveedor",
  "nit_proveedor": "NIT si aparece",
  "numero_factura": "número de factura",
  "fecha_factura": "YYYY-MM-DD",
  "items": [{"descripcion":"","cantidad":0,"precio_unitario":0,"subtotal":0}],
  "subtotal": 0,
  "iva": 0,
  "total": 0,
  "moneda": "COP",
  "notas": "observaciones importantes"
}` }
          ]}]
        })
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || '{}';
      const clean = text.replace(/```json|```/g,'').trim();
      const result = JSON.parse(clean);
      setOcrResult(result);

      // Guardar en Supabase
      let fotoUrl = '';
      const { data: uploaded } = await supabase.storage.from('ohyeah-fotos').upload(
        `facturas/${Date.now()}.${ocrFile.name.split('.').pop()}`, ocrFile, { upsert:true }
      );
      if (uploaded) {
        const { data: { publicUrl } } = supabase.storage.from('ohyeah-fotos').getPublicUrl(uploaded.path);
        fotoUrl = publicUrl;
      }
      await supabase.from('facturas_ocr').insert({
        restaurante_id: restauranteId, foto_url:fotoUrl, proveedor:result.proveedor,
        nit_proveedor:result.nit_proveedor, numero_factura:result.numero_factura,
        fecha_factura:result.fecha_factura, items:result.items,
        subtotal:result.subtotal, iva:result.iva, total:result.total,
        estado:'pendiente', ocr_raw:text,
        procesado_en:new Date().toISOString(),
      });
      show('✓ Factura procesada con IA');
      fetchData();
    } catch(e) {
      show('Error procesando la factura — intenta de nuevo');
    }
    setProcesandoOcr(false);
  };

  const egresosHoy = egresos.reduce((s,e) => s+(e.valor||0), 0);
  const catActiva = CATEGORIAS_EGRESO.find(c => c.id === formEgreso.categoria);

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
      {toast && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:S.bg4,border:`1px solid ${S.pink}`,color:S.t1,padding:'10px 28px',borderRadius:50,fontSize:13,fontWeight:700,zIndex:9999,whiteSpace:'nowrap'}}>{toast}</div>}

      {/* Header */}
      <div style={{padding:'14px 24px',borderBottom:`1px solid ${S.border}`,background:S.bg2,display:'flex',alignItems:'center',gap:14,flexShrink:0}}>
        <div style={{width:44,height:44,borderRadius:13,background:`linear-gradient(135deg,${S.gold},#d4943a)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>💰</div>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>FINANCE HUB</div>
          <div style={{fontSize:10,color:S.t3,letterSpacing:'.1em',textTransform:'uppercase'}}>Egresos · Arqueo · OCR Facturas</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:12}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:9,color:S.t3,textTransform:'uppercase'}}>Egresos hoy</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:S.red}}>{fmt(egresosHoy)}</div>
          </div>
          {arqueo && <div style={{textAlign:'center'}}>
            <div style={{fontSize:9,color:S.t3,textTransform:'uppercase'}}>Arqueo</div>
            <div style={{fontSize:12,fontWeight:700,color:arqueo.estado==='con_diferencia'?S.red:S.green}}>{arqueo.estado==='con_diferencia'?'⚠️ Diferencia':'✓ OK'}</div>
          </div>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,background:S.bg2,padding:'0 24px',flexShrink:0}}>
        {[
          {id:'egresos',  label:'💸 Egresos'},
          {id:'arqueo',   label:'🏦 Arqueo de Caja'},
          {id:'ocr',      label:'📷 OCR Facturas'},
          {id:'historial',label:'📋 Historial'},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as Tab)}
            style={{padding:'11px 18px',background:'none',border:'none',borderBottom:`2px solid ${tab===t.id?S.gold:'transparent'}`,color:tab===t.id?S.gold:S.t3,fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s'}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex'}}>

        {/* ── EGRESOS ── */}
        {tab==='egresos' && (
          <div style={{flex:1,overflow:'hidden',display:'flex',gap:0}}>
            {/* Form izquierda */}
            <div style={{width:360,borderRight:`1px solid ${S.border}`,padding:24,overflowY:'auto',flexShrink:0}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,marginBottom:16}}>Registrar egreso</div>
              {/* Categoría */}
              <div style={{marginBottom:14}}>
                <div style={lbl}>Categoría</div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {CATEGORIAS_EGRESO.map(cat=>(
                    <button key={cat.id} onClick={()=>setFE('categoria',cat.id)}
                      style={{padding:'10px 14px',borderRadius:10,border:`1px solid ${formEgreso.categoria===cat.id?cat.color:S.border}`,background:formEgreso.categoria===cat.id?`${cat.color}15`:'transparent',color:formEgreso.categoria===cat.id?cat.color:S.t2,cursor:'pointer',display:'flex',alignItems:'center',gap:10,fontSize:13,fontWeight:formEgreso.categoria===cat.id?700:400,transition:'all .15s',textAlign:'left'}}>
                      <span style={{flex:1}}>{cat.label}</span>
                      <span style={{fontSize:10,color:S.t3}}>{cat.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div style={lbl}>Concepto *</div>
                <select style={inp} value={formEgreso.concepto} onChange={e=>setFE('concepto',e.target.value)}>
                  <option value="">— Elige un concepto —</option>
                  {(CONCEPTOS_POR_CATEGORIA[formEgreso.categoria] || []).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {formEgreso.concepto === 'Otro' && (
                  <input style={{...inp, marginTop:8}} value={formEgreso.conceptoCustom}
                    onChange={e=>setFE('conceptoCustom', e.target.value)}
                    placeholder="Escribe el concepto..." autoFocus/>
                )}
              </div>
              <div style={{marginBottom:12}}>
                <div style={lbl}>Valor (COP) *</div>
                <input style={inp} type="number" value={formEgreso.valor} onChange={e=>setFE('valor',e.target.value)} placeholder="0"/>
                {formEgreso.valor && <div style={{fontSize:11,color:S.gold,marginTop:4}}>{fmt(Number(formEgreso.valor))}</div>}
              </div>
              <div style={{marginBottom:12}}>
                <div style={lbl}>Responsable</div>
                <input style={inp} value={formEgreso.responsable} onChange={e=>setFE('responsable',e.target.value)} placeholder={profile?.nombre_completo||'Staff'}/>
              </div>
              <div style={{marginBottom:12}}>
                <div style={lbl}>Comprobante de pago (foto)</div>
                <input ref={comprobanteRef} type="file" accept="image/*" capture="environment"
                  onChange={e=>onSelectComprobante(e.target.files?.[0]||null)} style={{display:'none'}}/>
                {!comprobantePreview ? (
                  <button onClick={()=>comprobanteRef.current?.click()}
                    style={{width:'100%',padding:'14px 12px',borderRadius:10,border:`1px dashed ${S.border2}`,background:'rgba(255,255,255,0.03)',color:S.t2,fontSize:12,fontWeight:600,cursor:'pointer',textAlign:'center'}}>
                    📷 Subir foto del recibo / comprobante
                  </button>
                ) : (
                  <div style={{position:'relative',borderRadius:10,overflow:'hidden',border:`1px solid ${S.border}`}}>
                    <img src={comprobantePreview} alt="comprobante" style={{width:'100%',display:'block',maxHeight:180,objectFit:'cover'}}/>
                    <div style={{position:'absolute',top:8,right:8,display:'flex',gap:6}}>
                      <button onClick={()=>comprobanteRef.current?.click()}
                        style={{padding:'6px 10px',borderRadius:8,border:'none',background:'rgba(0,0,0,0.65)',color:'#fff',fontSize:10,fontWeight:700,cursor:'pointer'}}>📷 Cambiar</button>
                      <button onClick={()=>onSelectComprobante(null)}
                        style={{padding:'6px 10px',borderRadius:8,border:'none',background:'rgba(220,38,38,0.85)',color:'#fff',fontSize:10,fontWeight:700,cursor:'pointer'}}>✕ Quitar</button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{marginBottom:16}}>
                <div style={lbl}>Notas (opcional)</div>
                <textarea style={{...inp,height:60,resize:'vertical'}} value={formEgreso.notas} onChange={e=>setFE('notas',e.target.value)} placeholder="Observaciones adicionales..."/>
              </div>
              <button onClick={guardarEgreso} disabled={guardandoEgreso}
                style={{width:'100%',padding:13,borderRadius:12,border:'none',background:guardandoEgreso?S.bg3:`linear-gradient(135deg,${S.red},#c02020)`,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                {subiendoFoto ? 'Subiendo foto...' : (guardandoEgreso?'Guardando...':'✓ Registrar egreso')}
              </button>
            </div>

            {/* Lista derecha */}
            <div style={{flex:1,overflowY:'auto',padding:24}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900}}>Egresos de hoy</div>
                <div style={{fontSize:16,fontWeight:900,color:S.red}}>{fmt(egresosHoy)}</div>
              </div>
              {egresos.length===0 && <div style={{textAlign:'center',padding:40,color:S.t3}}><div style={{fontSize:40,marginBottom:12}}>💸</div><div>Sin egresos hoy</div></div>}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {egresos.map(e=>{
                  const cat = CATEGORIAS_EGRESO.find(c=>c.id===e.categoria)||CATEGORIAS_EGRESO[4];
                  return (
                    <div key={e.id} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:36,height:36,borderRadius:10,background:`${cat.color}15`,border:`1px solid ${cat.color}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                        {cat.label.split(' ')[0]}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:700}}>{e.concepto}</div>
                        <div style={{fontSize:10,color:S.t3}}>{e.responsable} · {e.hora}</div>
                      </div>
                      <div style={{fontSize:15,fontWeight:900,color:S.red}}>{fmt(e.valor)}</div>
                    </div>
                  );
                })}
              </div>
              {egresos.length>0 && (
                <div style={{marginTop:16,padding:'12px 16px',background:S.bg2,border:`1px solid ${S.border}`,borderRadius:12,display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:12,color:S.t3}}>Total egresos del día</span>
                  <span style={{fontSize:16,fontWeight:900,color:S.red}}>{fmt(egresosHoy)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ARQUEO ── */}
        {tab==='arqueo' && (
          <div style={{flex:1,overflowY:'auto',padding:24}}>
            <div style={{maxWidth:640,margin:'0 auto'}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:4}}>Arqueo de caja — {new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}</div>
              <div style={{fontSize:12,color:S.t2,marginBottom:20}}>Ingresa el dinero físico contado para comparar con las ventas del sistema.</div>

              {arqueo?.estado==='con_diferencia' && (
                <div style={{background:`${S.red}10`,border:`1px solid ${S.red}30`,borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',gap:10,alignItems:'center'}}>
                  <span style={{fontSize:20}}>⚠️</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:S.red}}>Diferencia detectada: {fmt(Math.abs(arqueo.diferencia))}</div>
                    <div style={{fontSize:11,color:S.t2}}>Se ha notificado al administrador para revisión.</div>
                  </div>
                </div>
              )}

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>
                {[
                  {k:'efectivo_real',   l:'💵 Efectivo contado',  color:S.green},
                  {k:'tarjeta_real',    l:'💳 Tarjeta / Datafono', color:S.blue},
                  {k:'datafono_real',   l:'📱 Otros medios',       color:S.purple},
                ].map(f=>(
                  <div key={f.k}>
                    <div style={{...lbl,color:f.color}}>{f.l}</div>
                    <input style={inp} type="number" value={(arqueoForm as any)[f.k]} onChange={e=>setArqueoForm(p=>({...p,[f.k]:e.target.value}))} placeholder="$0"/>
                  </div>
                ))}
              </div>

              {/* Resumen */}
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16,marginBottom:16}}>
                {[
                  {l:'Ventas en sistema (facturación)', v:fmt(0), c:S.blue},
                  {l:'Total contado',v:fmt((Number(arqueoForm.efectivo_real)||0)+(Number(arqueoForm.tarjeta_real)||0)+(Number(arqueoForm.datafono_real)||0)),c:S.green},
                  {l:'Egresos registrados hoy',v:fmt(egresosHoy),c:S.red},
                ].map(row=>(
                  <div key={row.l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid rgba(255,255,255,0.04)`}}>
                    <span style={{fontSize:12,color:S.t2}}>{row.l}</span>
                    <span style={{fontSize:13,fontWeight:700,color:row.c}}>{row.v}</span>
                  </div>
                ))}
              </div>

              <div style={{marginBottom:16}}>
                <div style={lbl}>Notas del arqueo</div>
                <textarea style={{...inp,height:70,resize:'vertical'}} value={arqueoForm.notas} onChange={e=>setArqueoForm(p=>({...p,notas:e.target.value}))} placeholder="Observaciones, descuadres, novedades..."/>
              </div>

              <button onClick={cerrarArqueo} disabled={guardandoArqueo}
                style={{width:'100%',padding:13,borderRadius:12,border:'none',background:guardandoArqueo?S.bg3:`linear-gradient(135deg,${S.gold},#d4943a)`,color:'#000',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                {guardandoArqueo?'Procesando...':`${arqueo?'Actualizar':'Cerrar'} arqueo del turno`}
              </button>
            </div>
          </div>
        )}

        {/* ── OCR FACTURAS ── */}
        {tab==='ocr' && (
          <div style={{flex:1,overflow:'hidden',display:'flex',gap:0}}>
            {/* Upload izquierda */}
            <div style={{width:380,borderRight:`1px solid ${S.border}`,padding:24,overflowY:'auto',flexShrink:0}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,marginBottom:6}}>📷 Digitalizar factura</div>
              <div style={{fontSize:12,color:S.t2,marginBottom:16}}>Toma una foto a la factura del proveedor. La IA extrae todos los datos automáticamente.</div>
              
              <input type="file" accept="image/*" capture="environment" ref={fileRef} style={{display:'none'}}
                onChange={e=>{
                  const f=e.target.files?.[0];
                  if(!f)return;
                  setOcrFile(f);
                  setOcrResult(null);
                  const r=new FileReader();
                  r.onload=ev=>setOcrPreview(ev.target?.result as string);
                  r.readAsDataURL(f);
                }}/>

              <div style={{border:`2px dashed ${ocrFile?S.cyan:S.border2}`,borderRadius:16,overflow:'hidden',marginBottom:12,cursor:'pointer',minHeight:200,display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}
                onClick={()=>fileRef.current?.click()}>
                {ocrPreview
                  ? <img src={ocrPreview} alt="Factura" style={{width:'100%',objectFit:'contain',maxHeight:300}}/>
                  : <div style={{textAlign:'center',padding:32,color:S.t3}}>
                      <div style={{fontSize:48,marginBottom:12}}>📸</div>
                      <div style={{fontSize:13,fontWeight:700}}>Toca para tomar foto</div>
                      <div style={{fontSize:11,marginTop:4}}>o cargar desde galería</div>
                    </div>
                }
              </div>

              {ocrFile && !ocrResult && (
                <button onClick={procesarOcr} disabled={procesandoOcr}
                  style={{width:'100%',padding:13,borderRadius:12,border:'none',background:procesandoOcr?S.bg3:`linear-gradient(135deg,${S.cyan},#0e9ab5)`,color:procesandoOcr?S.t2:'#000',fontSize:13,fontWeight:700,cursor:'pointer',marginBottom:8}}>
                  {procesandoOcr?'Analizando con IA...':'✦ Procesar con IA'}
                </button>
              )}

              {ocrResult && (
                <div style={{background:`${S.green}08`,border:`1px solid ${S.green}20`,borderRadius:12,padding:14}}>
                  <div style={{fontSize:11,color:S.green,fontWeight:700,marginBottom:10}}>✓ Datos extraídos</div>
                  {[
                    {l:'Proveedor',      v:ocrResult.proveedor},
                    {l:'NIT',            v:ocrResult.nit_proveedor},
                    {l:'N° Factura',     v:ocrResult.numero_factura},
                    {l:'Fecha',          v:ocrResult.fecha_factura},
                    {l:'Subtotal',       v:ocrResult.subtotal?fmt(ocrResult.subtotal):'—'},
                    {l:'IVA',            v:ocrResult.iva?fmt(ocrResult.iva):'—'},
                    {l:'Total',          v:ocrResult.total?fmt(ocrResult.total):'—'},
                  ].filter(x=>x.v).map(x=>(
                    <div key={x.l} style={{display:'flex',gap:8,marginBottom:5}}>
                      <span style={{fontSize:10,color:S.t3,minWidth:70,fontWeight:700,textTransform:'uppercase'}}>{x.l}</span>
                      <span style={{fontSize:12,color:S.t1}}>{x.v}</span>
                    </div>
                  ))}
                  {ocrResult.items?.length>0 && (
                    <>
                      <div style={{fontSize:10,color:S.t3,fontWeight:700,marginTop:10,marginBottom:6}}>ÍTEMS</div>
                      {ocrResult.items.slice(0,5).map((it:any,i:number)=>(
                        <div key={i} style={{fontSize:11,color:S.t2,display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:`1px solid rgba(255,255,255,0.04)`}}>
                          <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis'}}>{it.descripcion}</span>
                          <span style={{color:S.gold,marginLeft:8}}>{it.total?fmt(it.total):''}</span>
                        </div>
                      ))}
                    </>
                  )}
                  <button onClick={()=>{setOcrFile(null);setOcrPreview('');setOcrResult(null);}} style={{marginTop:12,width:'100%',padding:'8px',borderRadius:8,border:`1px solid ${S.border}`,background:'transparent',color:S.t3,fontSize:11,cursor:'pointer'}}>
                    Nueva factura
                  </button>
                </div>
              )}
            </div>

            {/* Lista facturas derecha */}
            <div style={{flex:1,overflowY:'auto',padding:24}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,marginBottom:16}}>Facturas procesadas</div>
              {facturasOcr.length===0 && <div style={{textAlign:'center',padding:40,color:S.t3}}><div style={{fontSize:40,marginBottom:12}}>📋</div><div>Sin facturas digitalizadas</div></div>}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {facturasOcr.map(f=>(
                  <div key={f.id} style={{background:S.bg2,border:`1px solid ${f.estado==='aprobado'?`${S.green}30`:S.border}`,borderRadius:12,padding:'12px 16px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700}}>{f.proveedor||'Proveedor sin nombre'}</div>
                        <div style={{fontSize:10,color:S.t3}}>Factura #{f.numero_factura||'—'} · {f.fecha_factura||'—'}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:15,fontWeight:900,color:S.gold}}>{f.total?fmt(f.total):'—'}</div>
                        <span style={{fontSize:9,background:f.estado==='aprobado'?`${S.green}15`:`${S.gold}15`,color:f.estado==='aprobado'?S.green:S.gold,padding:'2px 8px',borderRadius:20,fontWeight:700}}>{f.estado}</span>
                      </div>
                    </div>
                    {f.foto_url && <img src={f.foto_url} alt="" style={{width:60,height:60,borderRadius:8,objectFit:'cover',border:`1px solid ${S.border}`}}/>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {tab==='historial' && (
          <div style={{flex:1,overflowY:'auto',padding:24}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,marginBottom:16}}>Historial de egresos</div>
            <div style={{textAlign:'center',padding:40,color:S.t3}}>
              <div style={{fontSize:40,marginBottom:12}}>📊</div>
              <div style={{fontSize:13,marginBottom:8}}>Conectando con datos históricos...</div>
              <div style={{fontSize:11}}>Los egresos del día aparecen en la pestaña Egresos</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
