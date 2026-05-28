import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext';
import { useRestaurant } from '../contexts/RestaurantContext';
import {
  cargarCatalogoEgresos,
  conceptosDeCategoria,
  buscarConcepto,
  centrosCostoDisponibles,
  explicarImpacto,
  CATEGORIAS_OPERATIVAS_UI,
  ORIGENES_EGRESO,
  GRUPO_PYG_COLORS,
  type ConceptoCatalogo,
} from '../lib/catalogoContable';

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

type Tab = 'egresos' | 'arqueo' | 'historial' | 'ocr' | 'pyg';

// El catálogo (~413 conceptos, 16 categorías operativas, mapeo NIIF +
// centro de costo + impacto P&G) vive en BD: tabla catalogo_egresos.
// Se carga via cargarCatalogoEgresos() en lib/catalogoContable.ts.

export default function FinanceHub() {
  const { profile } = useAuth();
  const { activeId: restauranteId } = useRestaurant();
  const [tab, setTab] = useState<Tab>('egresos');
  const [egresos, setEgresos] = useState<any[]>([]);
  const [arqueo, setArqueo] = useState<any>(null);
  const [facturasOcr, setFacturasOcr] = useState<any[]>([]);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  // Catálogo controlado (~413 conceptos) cargado desde BD.
  const [catalogo, setCatalogo] = useState<ConceptoCatalogo[]>([]);
  useEffect(() => { cargarCatalogoEgresos().then(setCatalogo); }, []);

  // Form egresos según los 8 pasos del PDF NEXUM Finance Hub:
  // 1. origen, 2. categoría operativa, 3. concepto (catálogo),
  // 4. detalle libre, 5. soporte (foto), 6/7 reglas automáticas y aprobación.
  const [formEgreso, setFormEgreso] = useState({
    origen: 'efectivo',
    categoriaOp: 'costos_directos',  // categoría operativa del PDF (16 visibles)
    conceptoId: '',
    centroCostoOverride: '',
    valor: '',
    responsable: '',
    detalle: '',                     // texto libre descriptivo, NO clasificador
    // Datos de la factura (Punto 6 del PDF — preparar terreno para OCR)
    proveedor: '',
    nitProveedor: '',
    facturaNumero: '',
    subtotal: '',
    iva: '',
    impoconsumo: '',
    retencionFuente: '',
  });
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

  // Concepto resuelto desde el catálogo. La clasificación contable
  // (cuenta NIIF + centro de costo + grupo P&G + tipo financiero +
  // banderas CAPEX/propina/etc.) sale automáticamente del catálogo.
  const conceptosCategoria = useMemo(
    () => conceptosDeCategoria(catalogo, formEgreso.categoriaOp),
    [catalogo, formEgreso.categoriaOp]
  );
  const conceptoSel = useMemo(
    () => formEgreso.conceptoId ? buscarConcepto(catalogo, formEgreso.conceptoId) : undefined,
    [catalogo, formEgreso.conceptoId]
  );
  const centroCostoFinal = formEgreso.centroCostoOverride || conceptoSel?.centro_costo_default || '';
  const requiereAprobacion = !!conceptoSel?.requiere_aprobacion;
  const requiereFactura = !!conceptoSel?.requiere_factura;
  const montoNumero = Number(formEgreso.valor) || 0;
  // Umbral: si supera monto_aprobacion del catálogo, también requiere aprobación
  const aprobacionPorMonto = conceptoSel && montoNumero > 0 && (conceptoSel.monto_aprobacion || 0) > 0 && montoNumero >= conceptoSel.monto_aprobacion;
  const requiereAprobacionFinal = requiereAprobacion || aprobacionPorMonto;
  // Centros de costo disponibles para el override
  const centrosCostoOpts = useMemo(() => centrosCostoDisponibles(catalogo), [catalogo]);

  const onSelectComprobante = (file: File | null) => {
    setComprobanteFile(file);
    if (!file) { setComprobantePreview(''); return; }
    const reader = new FileReader();
    reader.onload = ev => setComprobantePreview(String(ev.target?.result || ''));
    reader.readAsDataURL(file);
  };

  // ── GUARDAR EGRESO ──────────────────────────────────────────────────────
  const guardarEgreso = async () => {
    if (!conceptoSel) { show('⚠️ Elige un tipo de egreso del catálogo'); return; }
    if (!formEgreso.valor || isNaN(Number(formEgreso.valor))) { show('⚠️ Valor requerido'); return; }
    if (requiereFactura && !comprobanteFile && !formEgreso.facturaNumero) {
      show('⚠️ Este concepto requiere factura o número de soporte');
      return;
    }
    setGuardandoEgreso(true);
    let comprobanteUrl: string | null = null;
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
    const valor = Number(formEgreso.valor);
    const { error: insErr } = await supabase.from('egresos').insert({
      restaurante_id: restauranteId,
      // Categoría operativa (lo que ve el usuario)
      categoria: formEgreso.categoriaOp,
      // Mapeo del catálogo (clasificación contable)
      concepto: conceptoSel.nombre_usuario,
      concepto_id: conceptoSel.id,
      cuenta_contable: conceptoSel.cuenta_niif_interna,
      centro_costo: centroCostoFinal,
      grupo_pyg: conceptoSel.grupo_pyg,
      subgrupo_pyg: conceptoSel.subgrupo_pyg,
      tipo_financiero: conceptoSel.tipo_financiero,
      impacto_pg: conceptoSel.impacta_pyg,
      // Banderas
      es_capex: conceptoSel.es_capex,
      es_propina: conceptoSel.es_propina,
      es_caja_menor: conceptoSel.es_caja_menor || formEgreso.origen === 'caja_menor',
      es_impuesto_recaudado: conceptoSel.es_impuesto_recaudado,
      es_recurrente: conceptoSel.es_recurrente,
      // Flujo
      origen: formEgreso.origen,
      requiere_aprobacion: requiereAprobacionFinal,
      aprobado: requiereAprobacionFinal ? null : true,
      // Importes y proveedor
      valor,
      subtotal: formEgreso.subtotal ? Number(formEgreso.subtotal) : null,
      iva: formEgreso.iva ? Number(formEgreso.iva) : null,
      impoconsumo: formEgreso.impoconsumo ? Number(formEgreso.impoconsumo) : null,
      retencion_fuente: formEgreso.retencionFuente ? Number(formEgreso.retencionFuente) : null,
      proveedor: formEgreso.proveedor || null,
      nit_proveedor: formEgreso.nitProveedor || null,
      factura_numero: formEgreso.facturaNumero || null,
      // Texto libre / responsable
      responsable: formEgreso.responsable || profile?.nombre_completo || 'Staff',
      notas: formEgreso.detalle,
      factura_foto: comprobanteUrl,
      fuente_registro: 'manual',
      fecha: ahora.toISOString().split('T')[0],
      hora: ahora.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}),
    });
    if (insErr) {
      show(`⚠️ Error: ${insErr.message}`);
      setGuardandoEgreso(false);
      return;
    }
    show(requiereAprobacionFinal
      ? '✓ Registrado · queda PENDIENTE de aprobación'
      : `✓ ${conceptoSel.nombre_usuario} → ${conceptoSel.cuenta_niif_interna}`);
    setFormEgreso({
      origen:'efectivo', categoriaOp:formEgreso.categoriaOp, conceptoId:'',
      centroCostoOverride:'', valor:'', responsable:'', detalle:'',
      proveedor:'', nitProveedor:'', facturaNumero:'',
      subtotal:'', iva:'', impoconsumo:'', retencionFuente:'',
    });
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

  const egresosHoy = egresos
    .filter(e => e.tipo_financiero === 'costo' || e.tipo_financiero === 'gasto')
    .reduce((s,e) => s+(e.valor||0), 0);
  const catActivaUI = CATEGORIAS_OPERATIVAS_UI.find(c => c.id === formEgreso.categoriaOp);

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
      {toast && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:S.bg4,border:`1px solid ${S.pink}`,color:S.t1,padding:'10px 28px',borderRadius:50,fontSize:13,fontWeight:700,zIndex:9999,whiteSpace:'nowrap'}}>{toast}</div>}

      {/* Header */}
      <div style={{padding:'14px 24px',borderBottom:`1px solid ${S.border}`,background:S.bg2,display:'flex',alignItems:'center',gap:14,flexShrink:0}}>
        <div style={{width:44,height:44,borderRadius:13,background:`linear-gradient(135deg,${S.gold},#d4943a)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>💰</div>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>FINANCE HUB</div>
          <div style={{fontSize:10,color:S.t3,letterSpacing:'.1em',textTransform:'uppercase'}}>Egresos · P&G · Arqueo · OCR</div>
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
          {id:'pyg',      label:'📊 P&G'},
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
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,marginBottom:4}}>Registrar egreso</div>
              <div style={{fontSize:10,color:S.t3,marginBottom:14}}>{catalogo.length} conceptos NIIF · clasificación automática</div>

              {/* PASO 1 — Origen del egreso */}
              <div style={{marginBottom:14}}>
                <div style={lbl}>1 · Origen del egreso</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {ORIGENES_EGRESO.map(o=>(
                    <button key={o.id} onClick={()=>setFE('origen',o.id)}
                      style={{padding:'7px 10px',borderRadius:8,border:`1px solid ${formEgreso.origen===o.id?S.gold:S.border}`,background:formEgreso.origen===o.id?`${S.gold}15`:'transparent',color:formEgreso.origen===o.id?S.gold:S.t2,cursor:'pointer',fontSize:11,fontWeight:formEgreso.origen===o.id?700:500,transition:'all .12s'}}>
                      {o.emoji} {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* PASO 2 — Categoría operativa */}
              <div style={{marginBottom:12}}>
                <div style={lbl}>2 · Categoría</div>
                <select style={inp} value={formEgreso.categoriaOp}
                  onChange={e=>{ setFE('categoriaOp', e.target.value); setFE('conceptoId',''); }}>
                  {CATEGORIAS_OPERATIVAS_UI.map(c => (
                    <option key={c.id} value={c.id}>{c.emoji} {c.label} — {c.desc}</option>
                  ))}
                </select>
              </div>

              {/* PASO 3 — Tipo de egreso (concepto del catálogo) */}
              <div style={{marginBottom:12}}>
                <div style={lbl}>3 · Tipo de egreso *</div>
                <select style={inp} value={formEgreso.conceptoId} onChange={e=>setFE('conceptoId',e.target.value)}>
                  <option value="">— Elige tipo del catálogo ({conceptosCategoria.length} opciones) —</option>
                  {conceptosCategoria.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre_usuario}
                      {c.requiere_aprobacion ? ' · requiere aprobación' : ''}
                      {c.es_capex ? ' · CAPEX' : ''}
                      {c.es_propina ? ' · propina' : ''}
                    </option>
                  ))}
                </select>

                {/* PASO 6 — Chip de la clasificación automática */}
                {conceptoSel && (
                  <div style={{marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:`1px solid ${(GRUPO_PYG_COLORS[conceptoSel.grupo_pyg]||S.gold)}30`}}>
                    <div style={{fontSize:10, color:S.t3, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4}}>Clasificación automática</div>
                    <div style={{display:'flex', flexWrap:'wrap', gap:6, alignItems:'center'}}>
                      <span style={{fontSize:11, fontWeight:700, color:S.t1}}>{conceptoSel.cuenta_niif_interna}</span>
                      <span style={{fontSize:10, padding:'2px 8px', borderRadius:6, background:`${(GRUPO_PYG_COLORS[conceptoSel.grupo_pyg]||S.gold)}20`, color:(GRUPO_PYG_COLORS[conceptoSel.grupo_pyg]||S.gold), fontWeight:700}}>
                        {conceptoSel.grupo_pyg}
                      </span>
                      <span style={{fontSize:10, padding:'2px 8px', borderRadius:6, background:'rgba(255,255,255,0.06)', color:S.t2, fontWeight:600}}>
                        📍 {centroCostoFinal}
                      </span>
                    </div>
                    <div style={{marginTop:6, fontSize:10, color:S.t2, fontStyle:'italic'}}>
                      {explicarImpacto(conceptoSel)}
                    </div>
                    {conceptoSel.notas_contables && (
                      <div style={{marginTop:4, fontSize:10, color:S.gold}}>💡 {conceptoSel.notas_contables}</div>
                    )}
                    {requiereAprobacionFinal && (
                      <div style={{marginTop:6, fontSize:10, color:S.gold, fontWeight:700}}>
                        ⚠ {aprobacionPorMonto ? `Supera umbral de ${fmt(conceptoSel.monto_aprobacion)} — ` : ''}Queda PENDIENTE hasta aprobación
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Centro de costo override */}
              {conceptoSel && (
                <div style={{marginBottom:12}}>
                  <div style={lbl}>Centro de costo</div>
                  <select style={inp} value={formEgreso.centroCostoOverride}
                    onChange={e=>setFE('centroCostoOverride', e.target.value)}>
                    <option value="">Default ({conceptoSel.centro_costo_default})</option>
                    {centrosCostoOpts.filter(cc => cc !== conceptoSel.centro_costo_default).map(cc => (
                      <option key={cc} value={cc}>Cambiar a {cc}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{marginBottom:12}}>
                <div style={lbl}>Valor total (COP) *</div>
                <input style={inp} type="number" value={formEgreso.valor} onChange={e=>setFE('valor',e.target.value)} placeholder="0"/>
                {formEgreso.valor && <div style={{fontSize:11,color:S.gold,marginTop:4}}>{fmt(Number(formEgreso.valor))}</div>}
              </div>

              {/* Datos de la factura — proveedor + impuestos (Punto 6: prep OCR) */}
              <details style={{marginBottom:12, padding:'10px 12px', background:'rgba(255,255,255,0.02)', border:`1px solid ${S.border}`, borderRadius:10}}>
                <summary style={{cursor:'pointer', fontSize:11, fontWeight:700, color:S.t2}}>📄 Datos de la factura {requiereFactura && <span style={{color:S.gold}}>· requeridos</span>}</summary>
                <div style={{marginTop:10, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                  <div>
                    <div style={lbl}>Proveedor</div>
                    <input style={inp} value={formEgreso.proveedor} onChange={e=>setFE('proveedor',e.target.value)} placeholder="Razón social"/>
                  </div>
                  <div>
                    <div style={lbl}>NIT</div>
                    <input style={inp} value={formEgreso.nitProveedor} onChange={e=>setFE('nitProveedor',e.target.value)} placeholder="900.123.456-7"/>
                  </div>
                  <div style={{gridColumn:'span 2'}}>
                    <div style={lbl}>N° factura</div>
                    <input style={inp} value={formEgreso.facturaNumero} onChange={e=>setFE('facturaNumero',e.target.value)} placeholder="FE-12345"/>
                  </div>
                  <div>
                    <div style={lbl}>Subtotal</div>
                    <input style={inp} type="number" value={formEgreso.subtotal} onChange={e=>setFE('subtotal',e.target.value)} placeholder="0"/>
                  </div>
                  <div>
                    <div style={lbl}>IVA</div>
                    <input style={inp} type="number" value={formEgreso.iva} onChange={e=>setFE('iva',e.target.value)} placeholder="0"/>
                  </div>
                  <div>
                    <div style={lbl}>Impoconsumo</div>
                    <input style={inp} type="number" value={formEgreso.impoconsumo} onChange={e=>setFE('impoconsumo',e.target.value)} placeholder="0"/>
                  </div>
                  <div>
                    <div style={lbl}>Retefuente</div>
                    <input style={inp} type="number" value={formEgreso.retencionFuente} onChange={e=>setFE('retencionFuente',e.target.value)} placeholder="0"/>
                  </div>
                </div>
              </details>

              <div style={{marginBottom:12}}>
                <div style={lbl}>Responsable</div>
                <input style={inp} value={formEgreso.responsable} onChange={e=>setFE('responsable',e.target.value)} placeholder={profile?.nombre_completo||'Staff'}/>
              </div>

              {/* PASO 5 — Soporte: foto del comprobante */}
              <div style={{marginBottom:12}}>
                <div style={lbl}>4 · Comprobante (foto) {requiereFactura && <span style={{color:S.gold}}>*</span>}</div>
                <input ref={comprobanteRef} type="file" accept="image/*" capture="environment"
                  onChange={e=>onSelectComprobante(e.target.files?.[0]||null)} style={{display:'none'}}/>
                {!comprobantePreview ? (
                  <button onClick={()=>comprobanteRef.current?.click()}
                    style={{width:'100%',padding:'14px 12px',borderRadius:10,border:`1px dashed ${requiereFactura?S.gold+'80':S.border2}`,background:'rgba(255,255,255,0.03)',color:requiereFactura?S.gold:S.t2,fontSize:12,fontWeight:600,cursor:'pointer',textAlign:'center'}}>
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

              {/* PASO 4 — Detalle libre (descriptivo, no clasificador) */}
              <div style={{marginBottom:16}}>
                <div style={lbl}>5 · Detalle (opcional)</div>
                <textarea style={{...inp, height:60, resize:'vertical'}}
                  value={formEgreso.detalle}
                  onChange={e=>setFE('detalle',e.target.value)}
                  placeholder='Aclaración descriptiva: "DJ viernes Atlantis", "arreglo nevera sushi", etc.'/>
                <div style={{fontSize:9,color:S.t3,marginTop:3}}>El detalle NO reemplaza la clasificación oficial del catálogo.</div>
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
                  const catUI = CATEGORIAS_OPERATIVAS_UI.find(c=>c.id===e.categoria) || CATEGORIAS_OPERATIVAS_UI[15];
                  const grupoColor = e.grupo_pyg ? (GRUPO_PYG_COLORS[e.grupo_pyg] || S.t2) : S.t2;
                  const pendiente = e.requiere_aprobacion && e.aprobado === null;
                  const origenInfo = ORIGENES_EGRESO.find(o=>o.id===e.origen);
                  // Egresos que NO impactan P&G (balance, propinas, anticipos, impuestos recaudados, CAPEX)
                  const enBalance = e.tipo_financiero && !['costo','gasto'].includes(e.tipo_financiero);
                  return (
                    <div key={e.id} style={{background:S.bg2,border:`1px solid ${pendiente ? S.gold+'50' : S.border}`,borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:36,height:36,borderRadius:10,background:`${grupoColor}15`,border:`1px solid ${grupoColor}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                        {catUI.emoji}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                          {e.concepto}
                          {pendiente && <span style={{fontSize:9,padding:'1px 6px',borderRadius:5,background:`${S.gold}25`,color:S.gold,fontWeight:800}}>PENDIENTE APROBAR</span>}
                          {enBalance && <span style={{fontSize:9,padding:'1px 6px',borderRadius:5,background:`${S.green}20`,color:S.green,fontWeight:800}}>BALANCE</span>}
                          {e.es_capex && <span style={{fontSize:9,padding:'1px 6px',borderRadius:5,background:`${S.cyan}20`,color:S.cyan,fontWeight:800}}>CAPEX</span>}
                          {e.factura_foto && <a href={e.factura_foto} target="_blank" rel="noopener" title="Ver comprobante" style={{fontSize:11,color:S.cyan,textDecoration:'none'}}>📎</a>}
                        </div>
                        {(e.cuenta_contable || e.centro_costo || e.grupo_pyg) && (
                          <div style={{fontSize:9,color:S.t2,marginTop:2,display:'flex',gap:8,flexWrap:'wrap'}}>
                            {e.cuenta_contable && <span>📒 {e.cuenta_contable}</span>}
                            {e.centro_costo && <span>📍 {e.centro_costo}</span>}
                            {e.grupo_pyg && <span style={{color:grupoColor}}>● {e.grupo_pyg}</span>}
                          </div>
                        )}
                        <div style={{fontSize:10,color:S.t3,marginTop:2}}>
                          {origenInfo && <span>{origenInfo.emoji} {origenInfo.label} · </span>}
                          {e.responsable} · {e.hora}
                          {e.proveedor && <span> · 🚚 {e.proveedor}</span>}
                        </div>
                      </div>
                      <div style={{fontSize:15,fontWeight:900,color:enBalance ? S.green : S.red}}>{fmt(e.valor)}</div>
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

        {/* ── P&G ESTRUCTURADO (Punto 9 del PDF) ── */}
        {tab==='pyg' && <PyGView restauranteId={restauranteId} fmt={fmt} S={S} />}

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

// ═══════════════════════════════════════════════════════════════════════
// P&G ESTRUCTURADO (Punto 9 del PDF NEXUM Finance Hub)
// Suma ventas (cobros_trazabilidad + facturacion) menos egresos por línea:
//   Ventas netas → Costos directos → Margen bruto → Gastos operacionales
//   → EBITDA → No recurrentes / financieros → Utilidad antes de impuestos
// ═══════════════════════════════════════════════════════════════════════
function PyGView({ restauranteId, fmt, S }: { restauranteId: number, fmt: (n:number)=>string, S: any }) {
  const [periodo, setPeriodo] = useState<'dia'|'semana'|'mes'>('mes');
  const [data, setData] = useState<{ ventasBrutas: number, descuentos: number, egresos: any[], loading: boolean }>({
    ventasBrutas: 0, descuentos: 0, egresos: [], loading: true,
  });

  useEffect(() => {
    (async () => {
      setData(d => ({ ...d, loading: true }));
      const hoy = new Date();
      const desde = new Date(hoy);
      if (periodo === 'dia') desde.setHours(0,0,0,0);
      else if (periodo === 'semana') desde.setDate(hoy.getDate() - 6);
      else desde.setDate(1);
      const desdeStr = desde.toISOString().split('T')[0];

      const [cobros, eg] = await Promise.all([
        supabase.from('cobros_trazabilidad').select('total')
          .eq('restaurante_id', restauranteId).gte('created_at', desdeStr+'T00:00:00'),
        supabase.from('egresos').select('*')
          .eq('restaurante_id', restauranteId).gte('fecha', desdeStr),
      ]);
      const ventasBrutas = (cobros.data||[]).reduce((s:number,r:any)=>s+Number(r.total||0),0);
      const egresos = (eg.data||[]).filter(e => e.aprobado !== false);
      setData({ ventasBrutas, descuentos: 0, egresos, loading: false });
    })();
  }, [restauranteId, periodo]);

  // Agregaciones por grupo P&G
  const sumGrupo = (...grupos: string[]) => data.egresos
    .filter(e => grupos.includes(e.grupo_pyg))
    .reduce((s, e) => s + Number(e.valor || 0), 0);

  const sumSubgrupo = (sub: string) => data.egresos
    .filter(e => e.subgrupo_pyg === sub)
    .reduce((s, e) => s + Number(e.valor || 0), 0);

  const ventasNetas        = data.ventasBrutas - data.descuentos;
  const costoAlimentos     = sumSubgrupo('Costo de alimentos');
  const costoBebidas       = sumSubgrupo('Costo de bebidas');
  const costoBar           = sumSubgrupo('Costo de bar');
  const empaques           = sumSubgrupo('Empaques delivery');
  const totalCostos        = costoAlimentos + costoBebidas + costoBar + empaques;
  const margenBruto        = ventasNetas - totalCostos;
  const manoObra           = sumSubgrupo('Mano de obra directa') + sumSubgrupo('Mano de obra servicio');
  const ocupacion          = sumSubgrupo('Gastos de ocupación');
  const serviciosPublicos  = sumSubgrupo('Servicios públicos');
  const mantenimiento      = sumSubgrupo('Mantenimiento');
  const aseoSeguridad      = sumSubgrupo('Aseo y limpieza') + sumSubgrupo('Menaje y dotación') + sumSubgrupo('Uniformes y dotación') + sumSubgrupo('Seguridad') + sumSubgrupo('Ambientación');
  const marketing          = sumGrupo('Gasto comercial');
  const administracion     = sumSubgrupo('Administración') + sumSubgrupo('Honorarios') + sumSubgrupo('Papelería') + sumSubgrupo('Tecnología') + sumSubgrupo('Impuestos y permisos') + sumSubgrupo('Transporte y logística');
  const totalGastosOp      = manoObra + ocupacion + serviciosPublicos + mantenimiento + aseoSeguridad + marketing + administracion;
  const ebitda             = margenBruto - totalGastosOp;
  const gastosFinancieros  = sumGrupo('Gasto financiero');
  const noRecurrentes      = sumGrupo('No recurrente');
  const utilidadAntesImp   = ebitda - gastosFinancieros - noRecurrentes;

  // Líneas del P&G (Punto 9 del PDF)
  type Linea = { label: string, valor: number, esTotal?: boolean, signo?: 'mas'|'menos'|'igual', sub?: string };
  const lineas: Linea[] = [
    { label: 'Ventas brutas',                       valor: data.ventasBrutas, signo: 'mas' },
    { label: '(-) Descuentos y cortesías',          valor: -data.descuentos,  signo: 'menos' },
    { label: 'VENTAS NETAS',                        valor: ventasNetas,       esTotal: true, signo: 'igual' },
    { label: '(-) Costo de alimentos',              valor: -costoAlimentos,   signo: 'menos', sub: 'Costos directos' },
    { label: '(-) Costo de bebidas',                valor: -costoBebidas,     signo: 'menos', sub: 'Costos directos' },
    { label: '(-) Costo de bar y coctelería',       valor: -costoBar,         signo: 'menos', sub: 'Costos directos' },
    { label: '(-) Empaques y delivery',             valor: -empaques,         signo: 'menos', sub: 'Costos directos' },
    { label: 'MARGEN BRUTO',                        valor: margenBruto,       esTotal: true, signo: 'igual' },
    { label: '(-) Mano de obra operativa',          valor: -manoObra,         signo: 'menos', sub: 'Gastos op.' },
    { label: '(-) Gastos de ocupación',             valor: -ocupacion,        signo: 'menos', sub: 'Gastos op.' },
    { label: '(-) Servicios públicos',              valor: -serviciosPublicos,signo: 'menos', sub: 'Gastos op.' },
    { label: '(-) Mantenimiento',                   valor: -mantenimiento,    signo: 'menos', sub: 'Gastos op.' },
    { label: '(-) Aseo, menaje, seguridad, dotación',valor: -aseoSeguridad,   signo: 'menos', sub: 'Gastos op.' },
    { label: '(-) Marketing y ventas',              valor: -marketing,        signo: 'menos', sub: 'Gastos op.' },
    { label: '(-) Administración',                  valor: -administracion,   signo: 'menos', sub: 'Gastos op.' },
    { label: 'EBITDA OPERATIVO',                    valor: ebitda,            esTotal: true, signo: 'igual' },
    { label: '(-) Gastos financieros',              valor: -gastosFinancieros,signo: 'menos' },
    { label: '(-) No recurrentes',                  valor: -noRecurrentes,    signo: 'menos' },
    { label: 'UTILIDAD ANTES DE IMPUESTOS',         valor: utilidadAntesImp,  esTotal: true, signo: 'igual' },
  ];

  const margenPct = ventasNetas > 0 ? (utilidadAntesImp / ventasNetas) * 100 : 0;

  return (
    <div style={{flex:1,overflowY:'auto',padding:24}}>
      <div style={{maxWidth:760, margin:'0 auto'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:12}}>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900}}>P&G Estructurado</div>
            <div style={{fontSize:11,color:S.t3}}>Punto 9 NEXUM Finance Hub · Construido desde ventas + egresos clasificados</div>
          </div>
          <div style={{display:'flex', gap:4, padding:4, background:S.bg2, border:`1px solid ${S.border}`, borderRadius:10}}>
            {(['dia','semana','mes'] as const).map(p => (
              <button key={p} onClick={()=>setPeriodo(p)}
                style={{padding:'6px 14px', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer',
                  background: periodo===p ? S.gold : 'transparent',
                  color: periodo===p ? '#000' : S.t2,
                  border:'none', textTransform:'uppercase', letterSpacing:'.05em'}}>
                {p === 'dia' ? 'Hoy' : p === 'semana' ? '7 días' : 'Este mes'}
              </button>
            ))}
          </div>
        </div>

        {data.loading ? (
          <div style={{textAlign:'center',padding:60,color:S.t3}}>Calculando P&G…</div>
        ) : (
          <div style={{background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, overflow:'hidden'}}>
            {/* Header */}
            <div style={{padding:'10px 18px', background:S.bg3, fontSize:10, fontWeight:700, color:S.t3, textTransform:'uppercase', letterSpacing:'.08em', display:'flex', justifyContent:'space-between'}}>
              <span>Línea P&G</span>
              <span>Valor</span>
            </div>
            {lineas.map((l, i) => {
              const esCero = l.valor === 0;
              const negativo = l.valor < 0;
              return (
                <div key={i} style={{
                  padding: l.esTotal ? '14px 18px' : '8px 18px',
                  background: l.esTotal ? `${S.gold}10` : (i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'),
                  borderTop: l.esTotal ? `1px solid ${S.gold}40` : 'none',
                  borderBottom: l.esTotal ? `1px solid ${S.gold}40` : `1px solid ${S.border}`,
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                  <div>
                    <div style={{fontSize: l.esTotal ? 13 : 12, fontWeight: l.esTotal ? 900 : 500,
                      color: l.esTotal ? S.gold : S.t1,
                      paddingLeft: l.sub && !l.esTotal ? 16 : 0}}>
                      {l.label}
                    </div>
                    {l.sub && !l.esTotal && <div style={{fontSize:9, color:S.t3, paddingLeft:16}}>{l.sub}</div>}
                  </div>
                  <div style={{fontFamily:"'Syne',sans-serif", fontSize: l.esTotal ? 14 : 12, fontWeight:900,
                    color: l.esTotal ? (l.valor >= 0 ? S.green : S.red)
                         : esCero ? S.t3
                         : negativo ? S.red : S.t1}}>
                    {fmt(Math.abs(l.valor))}{negativo ? ' ' : ''}
                  </div>
                </div>
              );
            })}
            {/* Margen */}
            <div style={{padding:'14px 18px', background:`${margenPct>=0?S.green:S.red}10`, display:'flex', justifyContent:'space-between'}}>
              <span style={{fontSize:11, color:S.t3, textTransform:'uppercase', letterSpacing:'.06em'}}>Margen neto</span>
              <span style={{fontSize:14, fontWeight:900, color: margenPct >= 0 ? S.green : S.red}}>
                {margenPct.toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        <div style={{marginTop:14, padding:'10px 14px', background:'rgba(68,138,255,0.07)', border:'1px solid rgba(68,138,255,0.25)', borderRadius:10, fontSize:11, color:S.t2}}>
          <strong style={{color:S.blue}}>ℹ Cómo se construye:</strong> ventas brutas vienen de <code>cobros_trazabilidad</code>; costos y gastos vienen de <code>egresos</code> agrupados por <code>subgrupo_pyg</code>. Propinas, impuestos recaudados, anticipos, abonos a capital y CAPEX <strong>NO</strong> entran al P&G (van a Balance). Egresos pendientes de aprobación tampoco se incluyen.
        </div>
      </div>
    </div>
  );
}
