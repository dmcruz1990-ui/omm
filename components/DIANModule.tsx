// ============================================================
// NEXUM — DIANModule.tsx
// Módulo completo de Facturación Electrónica DIAN
// src/components/DIANModule.tsx
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
  DianConfig,
  DianStats,
  FacturaElectronica,
  DianEmitirPayload,
  DianEmitirResponse,
  EstadoFactura,
} from '../types/dian';

// ── Estilos base (consistent con Nexum dark theme) ──────────
const S = {
  bg: '#0a0a0a',
  bg2: '#141414',
  bg3: '#1c1c1c',
  border: '#2a2a2a',
  text1: '#f0f0f0',
  text2: '#a0a0a0',
  text3: '#606060',
  gold: '#d4943a',
  goldLight: '#f0b45a',
  green: '#3dba6f',
  red: '#e05050',
  blue: '#4a8fd4',
  purple: '#9b72ff',
};

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const ESTADO_COLORS: Record<EstadoFactura, { bg: string; text: string; label: string }> = {
  PENDIENTE:     { bg: '#60606020', text: '#a0a0a0', label: 'Pendiente' },
  PROCESANDO:    { bg: '#4a8fd420', text: '#4a8fd4', label: 'Procesando...' },
  ENVIADA:       { bg: '#d4943a20', text: '#d4943a', label: 'Enviada' },
  APROBADA:      { bg: '#3dba6f20', text: '#3dba6f', label: '✓ Aprobada' },
  RECHAZADA:     { bg: '#e0505020', text: '#e05050', label: '✗ Rechazada' },
  ERROR_TECNICO: { bg: '#9b72ff20', text: '#9b72ff', label: '⚠ Error técnico' },
};

type Tab = 'dashboard' | 'facturas' | 'emitir' | 'config';

// ── Props (se puede pasar contexto del POS) ──────────────────
interface DIANProps {
  restauranteId?: string;           // Si viene del POS, pre-selecciona restaurante
  ordenId?: string;                 // Si viene del POS
  onFacturaEmitida?: (resp: DianEmitirResponse) => void; // Callback al POS
}

export default function DIANModule({ restauranteId, ordenId, onFacturaEmitida }: DIANProps) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [restaurantes, setRestaurantes] = useState<any[]>([]);
  const [selectedRestaurante, setSelectedRestaurante] = useState<string>(restauranteId ?? '');
  const [config, setConfig] = useState<DianConfig | null>(null);
  const [stats, setStats] = useState<DianStats | null>(null);
  const [facturas, setFacturas] = useState<FacturaElectronica[]>([]);
  const [loadingFacturas, setLoadingFacturas] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // ── Cargar restaurantes ──────────────────────────────────
  useEffect(() => {
    supabase.from('restaurantes').select('id, nombre, complejo_id').order('nombre')
      .then(({ data }) => {
        if (data) setRestaurantes(data);
        if (!restauranteId && data?.length) setSelectedRestaurante(data[0].id);
      });
  }, []);

  // ── Cargar config + stats cuando cambia restaurante ──────
  useEffect(() => {
    if (!selectedRestaurante) return;
    loadConfig();
    loadStats();
    if (tab === 'facturas') loadFacturas();
  }, [selectedRestaurante]);

  const loadConfig = async () => {
    const { data } = await supabase.from('dian_config').select('*').eq('restaurante_id', selectedRestaurante).maybeSingle();
    setConfig(data);
  };

  const loadStats = async () => {
    const { data } = await supabase.from('dian_stats').select('*').eq('restaurante_id', selectedRestaurante).maybeSingle();
    setStats(data);
  };

  const loadFacturas = async () => {
    setLoadingFacturas(true);
    const { data } = await supabase
      .from('facturas_electronicas')
      .select('*, factura_items(*)')
      .eq('restaurante_id', selectedRestaurante)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setFacturas(data as any);
    setLoadingFacturas(false);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // ── Subscripción realtime a facturas ─────────────────────
  useEffect(() => {
    if (!selectedRestaurante) return;
    const channel = supabase.channel('facturas-dian')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'facturas_electronicas',
        filter: `restaurante_id=eq.${selectedRestaurante}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setFacturas(prev => [payload.new as any, ...prev].slice(0, 50));
        }
        if (payload.eventType === 'UPDATE') {
          setFacturas(prev => prev.map(f => f.id === (payload.new as any).id ? { ...f, ...(payload.new as any) } : f));
          loadStats();
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedRestaurante]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: S.bg, color: S.text1, fontFamily: "'DM Sans', sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#222', border: `1px solid ${S.border}`, color: S.text1, padding: '10px 20px', borderRadius: 10, fontSize: 13, zIndex: 9999, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${S.gold}, #b07820)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🧾</div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 900 }}>FACTURACIÓN ELECTRÓNICA</div>
            <div style={{ fontSize: 11, color: S.text3 }}>DIAN — Colombia · UBL 2.1</div>
          </div>
        </div>

        {/* Selector restaurante */}
        <select
          value={selectedRestaurante}
          onChange={e => setSelectedRestaurante(e.target.value)}
          style={{ background: S.bg3, border: `1px solid ${S.border}`, color: S.text1, padding: '6px 12px', borderRadius: 8, fontSize: 12 }}>
          {restaurantes.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, flexShrink: 0 }}>
        {([
          { id: 'dashboard', icon: '📊', label: 'Dashboard' },
          { id: 'facturas',  icon: '📋', label: 'Facturas' },
          { id: 'emitir',    icon: '➕', label: 'Nueva factura' },
          { id: 'config',    icon: '⚙️', label: 'Configuración' },
        ] as const).map(t => (
          <button key={t.id}
            onClick={() => { setTab(t.id); if (t.id === 'facturas') loadFacturas(); }}
            style={{
              flex: 1, padding: '12px 8px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: tab === t.id ? S.gold : S.text3,
              borderBottom: `2px solid ${tab === t.id ? S.gold : 'transparent'}`,
              transition: 'all 0.15s',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Alerta si no hay config */}
      {!config && tab !== 'config' && (
        <div style={{ margin: 16, padding: 14, background: '#d4943a10', border: `1px solid ${S.gold}40`, borderRadius: 12, fontSize: 12, color: S.goldLight }}>
          ⚠️ Este restaurante no tiene configuración DIAN activa. <button onClick={() => setTab('config')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.gold, fontWeight: 700, fontSize: 12 }}>Configurar ahora →</button>
        </div>
      )}

      {/* Alerta resolución por vencer */}
      {stats && stats.dias_vence_resolucion !== null && stats.dias_vence_resolucion <= 30 && (
        <div style={{ margin: '0 16px', padding: 14, background: '#e0505010', border: `1px solid ${S.red}40`, borderRadius: 12, fontSize: 12, color: S.red }}>
          🚨 La resolución DIAN vence en <strong>{stats.dias_vence_resolucion} días</strong>. Solicitar renovación.
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { label: 'Aprobadas hoy', value: stats.aprobadas_hoy, color: S.green, icon: '✓' },
                { label: 'Rechazadas hoy', value: stats.rechazadas_hoy, color: S.red, icon: '✗' },
                { label: 'Pendientes', value: stats.pendientes, color: S.gold, icon: '⏳' },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: S.bg2, border: `1px solid ${S.border}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 11, color: S.text3, marginBottom: 6 }}>{kpi.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: kpi.color, fontFamily: "'Syne', sans-serif" }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            {/* Tasa aprobación */}
            <div style={{ background: S.bg2, border: `1px solid ${S.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: S.text2 }}>Tasa de aprobación DIAN</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: stats.tasa_aprobacion >= 95 ? S.green : stats.tasa_aprobacion >= 80 ? S.gold : S.red }}>
                  {stats.tasa_aprobacion ?? 0}%
                </span>
              </div>
              <div style={{ height: 6, background: S.bg3, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${stats.tasa_aprobacion ?? 0}%`, background: stats.tasa_aprobacion >= 95 ? S.green : S.gold, borderRadius: 4, transition: 'width 0.5s' }} />
              </div>
            </div>

            {/* Facturado del mes + numeración */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: S.bg2, border: `1px solid ${S.border}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, color: S.text3, marginBottom: 4 }}>Facturado este mes</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: S.goldLight }}>{formatCOP(stats.valor_facturado_mes)}</div>
                <div style={{ fontSize: 10, color: S.text3, marginTop: 4 }}>{stats.total_mes} documentos</div>
              </div>
              <div style={{ background: S.bg2, border: `1px solid ${S.border}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, color: S.text3, marginBottom: 4 }}>Numeración DIAN</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: S.text1 }}>{stats.consecutivo_actual} / {stats.consecutivo_hasta}</div>
                <div style={{ height: 4, background: S.bg3, borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(stats.consecutivo_actual / stats.consecutivo_hasta) * 100}%`, background: S.blue, borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 10, color: S.text3, marginTop: 4 }}>Vence resolución en {stats.dias_vence_resolucion} días</div>
              </div>
            </div>

            {/* Ambiente */}
            {config && (
              <div style={{ background: S.bg2, border: `1px solid ${config.ambiente === 'PRODUCCION' ? S.green + '40' : S.gold + '40'}`, borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: S.text3 }}>Ambiente DIAN</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: config.ambiente === 'PRODUCCION' ? S.green : S.gold }}>{config.ambiente}</div>
                </div>
                <div style={{ fontSize: 11, color: S.text3 }}>Software ID: {config.software_id?.slice(0, 8) ?? 'No configurado'}...</div>
              </div>
            )}
          </div>
        )}

        {/* ── FACTURAS ── */}
        {tab === 'facturas' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: S.text2 }}>Últimas 50 facturas</div>
              <button onClick={loadFacturas} style={{ background: S.bg3, border: `1px solid ${S.border}`, color: S.text2, padding: '6px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer' }}>⟳ Refrescar</button>
            </div>

            {loadingFacturas ? (
              <div style={{ textAlign: 'center', padding: 40, color: S.text3 }}>Cargando facturas...</div>
            ) : facturas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: S.text3 }}>No hay facturas aún</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {facturas.map(f => {
                  const est = ESTADO_COLORS[f.estado];
                  return (
                    <div key={f.id} style={{ background: S.bg2, border: `1px solid ${S.border}`, borderRadius: 12, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: S.text1 }}>{f.numero_completo}</div>
                          <div style={{ fontSize: 12, color: S.text3, marginTop: 2 }}>{f.cliente_nombre} · {f.cliente_numero_id}</div>
                          {f.cufe && <div style={{ fontSize: 10, color: S.text3, marginTop: 4, fontFamily: 'monospace' }}>CUFE: {f.cufe.slice(0, 24)}...</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                          <span style={{ background: est.bg, color: est.text, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{est.label}</span>
                          <div style={{ fontSize: 14, fontWeight: 700, color: S.goldLight }}>{formatCOP(f.total)}</div>
                        </div>
                      </div>
                      {f.dian_errors && f.dian_errors.length > 0 && (
                        <div style={{ marginTop: 8, padding: 8, background: '#e0505010', borderRadius: 8, fontSize: 11, color: S.red }}>
                          {(f.dian_errors as any[]).map((e, i) => <div key={i}>⚠ {e.mensaje}</div>)}
                        </div>
                      )}
                      {f.qr_data && (
                        <a href={f.qr_data} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: 10, color: S.blue }}>
                          🔗 Ver en DIAN
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── EMITIR FACTURA ── */}
        {tab === 'emitir' && <EmitirFactura restauranteId={selectedRestaurante} ordenId={ordenId} config={config} onEmitida={(resp) => { onFacturaEmitida?.(resp); showToast(resp.ok ? `✓ ${resp.numero_completo} aprobada` : `✗ ${resp.mensaje}`); loadStats(); }} />}

        {/* ── CONFIG ── */}
        {tab === 'config' && <ConfigDIAN restauranteId={selectedRestaurante} config={config} onSaved={() => { loadConfig(); showToast('✓ Configuración guardada'); }} />}
      </div>
    </div>
  );
}

// ── SUB-COMPONENTE: Emitir Factura ────────────────────────────
function EmitirFactura({ restauranteId, ordenId, config, onEmitida }: {
  restauranteId: string;
  ordenId?: string;
  config: DianConfig | null;
  onEmitida: (resp: DianEmitirResponse) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [tipoDoc, setTipoDoc] = useState<'FACTURA' | 'NOTA_CREDITO' | 'NOTA_DEBITO'>('FACTURA');
  const [clienteTipoId, setClienteTipoId] = useState<'CC' | 'NIT' | 'CE'>('CC');
  const [clienteNumeroId, setClienteNumeroId] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [docRefNumero, setDocRefNumero] = useState('');
  const [docRefCufe, setDocRefCufe] = useState('');
  const [items, setItems] = useState([{ descripcion: '', cantidad: 1, precio: 0, iva: 19 as 0 | 5 | 19 }]);

  const addItem = () => setItems(prev => [...prev, { descripcion: '', cantidad: 1, precio: 0, iva: 19 }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const total = items.reduce((acc, item) => acc + (item.cantidad * item.precio * (1 + item.iva / 100)), 0);

  const emitir = async () => {
    if (!clienteNumeroId || !clienteNombre || items.some(i => !i.descripcion || i.precio <= 0)) {
      alert('Completa todos los campos requeridos');
      return;
    }
    setLoading(true);
    try {
      const payload: DianEmitirPayload = {
        restaurante_id: restauranteId,
        tipo_documento: tipoDoc,
        cliente: { tipo_id: clienteTipoId, numero_id: clienteNumeroId, nombre: clienteNombre, email: clienteEmail || undefined },
        items: items.map(i => ({ descripcion: i.descripcion, cantidad: i.cantidad, precio_unitario: i.precio, tarifa_iva: i.iva })),
        orden_id: ordenId,
        doc_referencia_numero: docRefNumero || undefined,
        doc_referencia_cufe: docRefCufe || undefined,
      };

      const { data, error } = await supabase.functions.invoke('dian-core', { body: payload });
      if (error) throw error;
      onEmitida(data as DianEmitirResponse);
    } catch (err) {
      onEmitida({ ok: false, estado: 'ERROR_TECNICO', mensaje: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const inp = { background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#f0f0f0', fontSize: 12, outline: 'none', width: '100%' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
      {!config?.habilitado && (
        <div style={{ padding: 12, background: '#e0505010', border: '1px solid #e0505040', borderRadius: 10, fontSize: 12, color: '#e05050' }}>
          ⚠️ La configuración DIAN no está habilitada para este restaurante
        </div>
      )}

      {/* Tipo documento */}
      <div>
        <div style={{ fontSize: 10, color: '#606060', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tipo de documento</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO'] as const).map(t => (
            <button key={t} onClick={() => setTipoDoc(t)}
              style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: `1px solid ${tipoDoc === t ? '#d4943a' : '#2a2a2a'}`, background: tipoDoc === t ? '#d4943a18' : '#141414', color: tipoDoc === t ? '#d4943a' : '#606060', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {t === 'FACTURA' ? '🧾 Factura' : t === 'NOTA_CREDITO' ? '↩ Nota Crédito' : '↪ Nota Débito'}
            </button>
          ))}
        </div>
      </div>

      {/* Referencia (solo notas) */}
      {tipoDoc !== 'FACTURA' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: '#606060', marginBottom: 6 }}>Número factura referencia</div>
            <input style={inp} placeholder="FE-1234" value={docRefNumero} onChange={e => setDocRefNumero(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#606060', marginBottom: 6 }}>CUFE factura referencia</div>
            <input style={inp} placeholder="SHA-384..." value={docRefCufe} onChange={e => setDocRefCufe(e.target.value)} />
          </div>
        </div>
      )}

      {/* Cliente */}
      <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 10, color: '#606060', marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Datos del cliente</div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: '#606060', marginBottom: 6 }}>Tipo ID</div>
            <select value={clienteTipoId} onChange={e => setClienteTipoId(e.target.value as any)} style={{ ...inp, width: '100%' }}>
              <option value="CC">CC</option>
              <option value="NIT">NIT</option>
              <option value="CE">CE</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#606060', marginBottom: 6 }}>Número de identificación</div>
            <input style={inp} placeholder="123456789" value={clienteNumeroId} onChange={e => setClienteNumeroId(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: '#606060', marginBottom: 6 }}>Nombre / Razón social</div>
            <input style={inp} placeholder="Cliente Final" value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#606060', marginBottom: 6 }}>Email (opcional)</div>
            <input style={inp} type="email" placeholder="cliente@email.com" value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Items */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#606060', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ítems / Servicios</div>
          <button onClick={addItem} style={{ background: '#3dba6f15', border: '1px solid #3dba6f40', color: '#3dba6f', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Agregar ítem</button>
        </div>
        {items.map((item, i) => (
          <div key={i} style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 80px 32px', gap: 8, alignItems: 'end' }}>
              <div>
                {i === 0 && <div style={{ fontSize: 10, color: '#606060', marginBottom: 6 }}>Descripción</div>}
                <input style={inp} placeholder="Ej: Makis California (8 piezas)" value={item.descripcion} onChange={e => updateItem(i, 'descripcion', e.target.value)} />
              </div>
              <div>
                {i === 0 && <div style={{ fontSize: 10, color: '#606060', marginBottom: 6 }}>Cant.</div>}
                <input style={inp} type="number" min={1} value={item.cantidad} onChange={e => updateItem(i, 'cantidad', parseFloat(e.target.value) || 1)} />
              </div>
              <div>
                {i === 0 && <div style={{ fontSize: 10, color: '#606060', marginBottom: 6 }}>Precio unit.</div>}
                <input style={inp} type="number" min={0} value={item.precio} onChange={e => updateItem(i, 'precio', parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                {i === 0 && <div style={{ fontSize: 10, color: '#606060', marginBottom: 6 }}>IVA %</div>}
                <select value={item.iva} onChange={e => updateItem(i, 'iva', parseInt(e.target.value) as 0|5|19)} style={{ ...inp, width: '100%' }}>
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={19}>19%</option>
                </select>
              </div>
              <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: '#e05050', cursor: 'pointer', fontSize: 16, paddingTop: i === 0 ? 22 : 0 }}>✕</button>
            </div>
          </div>
        ))}

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 12px', background: '#0a0a0a', borderRadius: 10, border: '1px solid #2a2a2a' }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#f0b45a' }}>Total: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(total)}</div>
        </div>
      </div>

      {/* Botón emitir */}
      <button onClick={emitir} disabled={loading || !config?.habilitado}
        style={{ width: '100%', padding: 16, borderRadius: 12, background: loading || !config?.habilitado ? '#2a2a2a' : '#d4943a', color: loading || !config?.habilitado ? '#606060' : '#000', fontSize: 14, fontWeight: 900, border: 'none', cursor: loading || !config?.habilitado ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
        {loading ? '⏳ Enviando a la DIAN...' : `🧾 Emitir ${tipoDoc === 'FACTURA' ? 'Factura' : tipoDoc === 'NOTA_CREDITO' ? 'Nota Crédito' : 'Nota Débito'}`}
      </button>
    </div>
  );
}

// ── SUB-COMPONENTE: Configuración DIAN ───────────────────────
function ConfigDIAN({ restauranteId, config, onSaved }: {
  restauranteId: string;
  config: DianConfig | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<DianConfig>>(config ?? {
    nit: '', nit_dv: '', razon_social: '', nombre_comercial: '', direccion: '',
    ciudad: 'Bogotá D.C.', departamento: 'Cundinamarca', telefono: '',
    email_facturacion: '', regimen: 'RESPONSABLE_IVA', tipo_persona: 'JURIDICA',
    software_id: '', software_pin: '', prefijo_factura: 'FE',
    consecutivo_desde: 1, consecutivo_hasta: 1000, consecutivo_actual: 0,
    resolucion_dian: '', fecha_resolucion: '', fecha_vence_resolucion: '',
    ambiente: 'PRUEBAS', habilitado: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (config) setForm(config); }, [config]);

  const set = (field: keyof DianConfig, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const save = async () => {
    setSaving(true);
    const payload = { ...form, restaurante_id: restauranteId };
    const { error } = config?.id
      ? await supabase.from('dian_config').update(payload).eq('id', config.id)
      : await supabase.from('dian_config').insert(payload);
    setSaving(false);
    if (!error) onSaved();
    else alert('Error guardando: ' + error.message);
  };

  const inp = { background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#f0f0f0', fontSize: 12, outline: 'none', width: '100%' };
  const label = (text: string) => <div style={{ fontSize: 10, color: '#606060', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{text}</div>;
  const section = (title: string) => <div style={{ fontSize: 11, color: '#d4943a', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', padding: '12px 0 8px', borderTop: '1px solid #2a2a2a', marginTop: 8 }}>{title}</div>;

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {section('Datos de la empresa')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10 }}>
        <div>{label('NIT')}<input style={inp} value={form.nit ?? ''} onChange={e => set('nit', e.target.value)} placeholder="900123456" /></div>
        <div>{label('DV')}<input style={inp} value={form.nit_dv ?? ''} onChange={e => set('nit_dv', e.target.value)} placeholder="1" /></div>
      </div>
      <div>{label('Razón social')}<input style={inp} value={form.razon_social ?? ''} onChange={e => set('razon_social', e.target.value)} /></div>
      <div>{label('Nombre comercial')}<input style={inp} value={form.nombre_comercial ?? ''} onChange={e => set('nombre_comercial', e.target.value)} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          {label('Régimen')}<select style={{ ...inp }} value={form.regimen ?? 'RESPONSABLE_IVA'} onChange={e => set('regimen', e.target.value)}>
            <option value="RESPONSABLE_IVA">Responsable de IVA</option>
            <option value="NO_RESPONSABLE">No responsable</option>
          </select>
        </div>
        <div>
          {label('Tipo persona')}<select style={{ ...inp }} value={form.tipo_persona ?? 'JURIDICA'} onChange={e => set('tipo_persona', e.target.value)}>
            <option value="JURIDICA">Jurídica</option>
            <option value="NATURAL">Natural</option>
          </select>
        </div>
      </div>
      <div>{label('Email facturación')}<input style={inp} type="email" value={form.email_facturacion ?? ''} onChange={e => set('email_facturacion', e.target.value)} /></div>

      {section('Credenciales DIAN')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>{label('Software ID (portal DIAN)')}<input style={inp} value={form.software_id ?? ''} onChange={e => set('software_id', e.target.value)} /></div>
        <div>{label('Software PIN / Secret')}<input style={inp} type="password" value={form.software_pin ?? ''} onChange={e => set('software_pin', e.target.value)} /></div>
      </div>
      <div>
        {label('Ambiente')}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['PRUEBAS', 'PRODUCCION'] as const).map(a => (
            <button key={a} onClick={() => set('ambiente', a)}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${form.ambiente === a ? (a === 'PRODUCCION' ? '#3dba6f' : '#d4943a') : '#2a2a2a'}`, background: form.ambiente === a ? (a === 'PRODUCCION' ? '#3dba6f15' : '#d4943a15') : '#141414', color: form.ambiente === a ? (a === 'PRODUCCION' ? '#3dba6f' : '#d4943a') : '#606060', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {a === 'PRODUCCION' ? '✓ Producción' : '🧪 Pruebas'}
            </button>
          ))}
        </div>
      </div>

      {section('Resolución y numeración DIAN')}
      <div>{label('Número de resolución')}<input style={inp} value={form.resolucion_dian ?? ''} onChange={e => set('resolucion_dian', e.target.value)} placeholder="18764000001234" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>{label('Fecha resolución')}<input style={inp} type="date" value={form.fecha_resolucion ?? ''} onChange={e => set('fecha_resolucion', e.target.value)} /></div>
        <div>{label('Fecha vencimiento')}<input style={inp} type="date" value={form.fecha_vence_resolucion ?? ''} onChange={e => set('fecha_vence_resolucion', e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 10 }}>
        <div>{label('Prefijo')}<input style={inp} value={form.prefijo_factura ?? 'FE'} onChange={e => set('prefijo_factura', e.target.value)} /></div>
        <div>{label('Desde')}<input style={inp} type="number" value={form.consecutivo_desde ?? 1} onChange={e => set('consecutivo_desde', parseInt(e.target.value))} /></div>
        <div>{label('Hasta')}<input style={inp} type="number" value={form.consecutivo_hasta ?? 1000} onChange={e => set('consecutivo_hasta', parseInt(e.target.value))} /></div>
      </div>

      {section('Estado')}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input type="checkbox" checked={form.habilitado ?? false} onChange={e => set('habilitado', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#3dba6f', cursor: 'pointer' }} />
        <div>
          <div style={{ fontSize: 12, color: '#f0f0f0', fontWeight: 700 }}>Módulo habilitado</div>
          <div style={{ fontSize: 11, color: '#606060' }}>Activa la emisión de facturas desde el POS</div>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        style={{ marginTop: 8, width: '100%', padding: 14, borderRadius: 12, background: saving ? '#2a2a2a' : '#d4943a', color: saving ? '#606060' : '#000', fontSize: 13, fontWeight: 900, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Guardando...' : '💾 Guardar configuración'}
      </button>
    </div>
  );
}
