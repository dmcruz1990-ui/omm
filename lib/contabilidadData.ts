// ═══════════════════════════════════════════════════════════════════════════
// NEXUM · Capa de datos contable
// Lee de Supabase (esquema cont_*) cuando está disponible y cae a datos demo
// si las tablas aún no existen o la consulta falla. Mantiene la UI viva en
// modo demostración sin romper cuando la migración ya está aplicada.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from './supabase.ts';
import type { Asiento, Activo, EntidadFin, Eliminacion } from './contabilidad.ts';

// ─── Activos fijos (demo + lector) ──────────────────────────────────────────
export const MOCK_ACTIVOS: Activo[] = [
  { id:'1', nombre:'Horno industrial Rational', clase:'Equipo cocina', costo:12000000, vida_util_meses:120, valor_residual:1200000, fecha_uso:'2024-02-01' },
  { id:'2', nombre:'Cuarto frío / refrigeración', clase:'Equipo cocina', costo:8000000, vida_util_meses:120, valor_residual:800000, fecha_uso:'2024-02-01' },
  { id:'3', nombre:'Mobiliario salón', clase:'Mobiliario', costo:15000000, vida_util_meses:120, valor_residual:1500000, fecha_uso:'2023-12-01' },
  { id:'4', nombre:'Hardware POS x6', clase:'Cómputo', costo:6000000, vida_util_meses:60, valor_residual:0, fecha_uso:'2025-03-15' },
  { id:'5', nombre:'Equipo de bar', clase:'Equipo bar', costo:9500000, vida_util_meses:120, valor_residual:950000, fecha_uso:'2024-07-01' },
];

// ─── Consolidación multiempresa (demo) ──────────────────────────────────────
export const MOCK_ENTIDADES: EntidadFin[] = [
  { entidad:'Seratta SAS',  ingresos:62400000, costos:21500000, gastos:18200000 },
  { entidad:'Oh Yeah SAS',  ingresos:28800000, costos:10100000, gastos:8400000 },
  { entidad:'Barra Nexum SAS', ingresos:14200000, costos:5600000, gastos:4100000 },
];
export const MOCK_ELIMINACIONES: Eliminacion[] = [
  { concepto:'Cobro de management fee Seratta → Oh Yeah', monto:2400000 },
  { concepto:'Venta intercompañía de insumos', monto:1100000 },
];

// ─── CxC / cartera (demo) ───────────────────────────────────────────────────
export type ARFactura = { id:string; numero:string; cliente:string; nit:string; fecha:string; vencimiento:string; base:number; iva:number; total:number; saldo:number; estado:string };
export const MOCK_CARTERA: ARFactura[] = [
  { id:'1', numero:'FE-1051', cliente:'Eventos Corporativos SAS', nit:'900123456-1', fecha:'2026-05-02', vencimiento:'2026-06-01', base:8400000, iva:1596000, total:9996000, saldo:9996000, estado:'abierta' },
  { id:'2', numero:'FE-1064', cliente:'Hotel Andino',            nit:'860456789-2', fecha:'2026-05-15', vencimiento:'2026-06-14', base:3200000, iva:608000,  total:3808000, saldo:1908000, estado:'parcial' },
  { id:'3', numero:'FE-1072', cliente:'Convenio Empresa ABC',    nit:'901222333-4', fecha:'2026-04-10', vencimiento:'2026-05-10', base:5600000, iva:1064000, total:6664000, saldo:6664000, estado:'abierta' },
  { id:'4', numero:'FE-1080', cliente:'Catering Bodas Luxe',     nit:'79123456-7',  fecha:'2026-03-01', vencimiento:'2026-03-31', base:4200000, iva:798000,  total:4998000, saldo:4998000, estado:'abierta' },
  { id:'5', numero:'FE-1090', cliente:'Club Campestre',          nit:'860112233-5', fecha:'2026-05-28', vencimiento:'2026-06-27', base:2800000, iva:532000,  total:3332000, saldo:3332000, estado:'abierta' },
];

// ─── Tesorería: bancos + extracto (demo) ────────────────────────────────────
export type CuentaBanco = { id:string; banco:string; numero:string; tipo:string; saldoLibros:number };
export type ExtractoLinea = { id:string; fecha:string; descripcion:string; referencia:string; valor:number; conciliado:boolean; match?:string };
export const MOCK_BANCOS: CuentaBanco[] = [
  { id:'1', banco:'Bancolombia', numero:'•••• 7712', tipo:'Ahorros',   saldoLibros:48250000 },
  { id:'2', banco:'Davivienda',  numero:'•••• 0341', tipo:'Corriente', saldoLibros:12800000 },
];
export const MOCK_EXTRACTO: ExtractoLinea[] = [
  { id:'1', fecha:'2026-06-08', descripcion:'Payout Stripe lote 24512',   referencia:'po_24512',  valor:3180000,  conciliado:true,  match:'Cierre Z 07-jun' },
  { id:'2', fecha:'2026-06-08', descripcion:'Payout Rappi liquidación',    referencia:'rp_8841',   valor:2240000,  conciliado:true,  match:'Settlement Rappi' },
  { id:'3', fecha:'2026-06-08', descripcion:'Pago proveedor Pescadería',   referencia:'tr_99812',  valor:-850000,  conciliado:true,  match:'AP FE-La Marina' },
  { id:'4', fecha:'2026-06-08', descripcion:'Comisión datáfono',           referencia:'fee_0608',  valor:-94200,   conciliado:false },
  { id:'5', fecha:'2026-06-07', descripcion:'Transferencia no identificada',referencia:'tr_55120', valor:1500000,  conciliado:false },
  { id:'6', fecha:'2026-06-07', descripcion:'Recaudo Hotel Andino',        referencia:'tr_44011',  valor:1900000,  conciliado:false },
];

// ─── Impuestos consolidados del período (demo) ──────────────────────────────
export type MovImpuesto = { tipo:string; etiqueta:string; generado:number; descontable:number; neto:number; cuenta:string };
export const MOCK_IMPUESTOS: MovImpuesto[] = [
  { tipo:'IVA',        etiqueta:'IVA generado vs descontable', generado:3460000, descontable:1240000, neto:2220000, cuenta:'240805' },
  { tipo:'INC',        etiqueta:'Impuesto al consumo (8%)',     generado:1180000, descontable:0,       neto:1180000, cuenta:'240805' },
  { tipo:'RETEFUENTE', etiqueta:'Retención en la fuente',       generado:0,       descontable:0,       neto:418000,  cuenta:'236540' },
  { tipo:'RETEIVA',    etiqueta:'Retención de IVA',             generado:0,       descontable:0,       neto:96000,   cuenta:'236701' },
  { tipo:'ICA',        etiqueta:'Industria y comercio',         generado:0,       descontable:0,       neto:285000,  cuenta:'241205' },
];

// ─── Asientos históricos demo (para el libro mayor / balance) ───────────────
// Asientos ya contabilizados de períodos previos, además de los que el motor
// genera en vivo desde cierre de caja y gastos.
export const MOCK_ASIENTOS_HIST: Asiento[] = [
  {
    fecha:'2026-06-01', fuente:'Cierre Z · 01-jun', dim:'OMM · Restaurante principal',
    origenTipo:'cierre_caja', estado:'contabilizado',
    lineas:[
      { cuenta:'110505', nombre:'Caja general', debe:5200000, haber:0 },
      { cuenta:'131005', nombre:'CxC pasarela / banco en tránsito', debe:8600000, haber:0 },
      { cuenta:'413550', nombre:'Ingresos operacionales — restaurante', debe:0, haber:11400000 },
      { cuenta:'240805', nombre:'Impuesto (IVA/INC) por pagar', debe:0, haber:1900000 },
      { cuenta:'233595', nombre:'Propinas por liquidar', debe:0, haber:500000 },
    ], debe:13800000, haber:13800000, cuadra:true,
  },
  {
    fecha:'2026-06-03', fuente:'Factura proveedor · Pescadería La Marina', dim:'OMM · Restaurante principal',
    origenTipo:'factura_ap', estado:'contabilizado',
    lineas:[
      { cuenta:'613505', nombre:'Costo de alimentos', debe:1240000, haber:0 },
      { cuenta:'236540', nombre:'Retención en la fuente por pagar (2.5%)', debe:0, haber:31000 },
      { cuenta:'220505', nombre:'Proveedores nacionales', debe:0, haber:1209000 },
    ], debe:1240000, haber:1240000, cuadra:true,
  },
  {
    fecha:'2026-06-05', fuente:'Factura a crédito · FE-1090 — Club Campestre', dim:'OMM · Restaurante principal',
    origenTipo:'factura_ar', estado:'contabilizado',
    lineas:[
      { cuenta:'130505', nombre:'Clientes nacionales', debe:3332000, haber:0 },
      { cuenta:'413550', nombre:'Ingresos operacionales — restaurante', debe:0, haber:2800000 },
      { cuenta:'240805', nombre:'Impuesto (IVA/INC) por pagar', debe:0, haber:532000 },
    ], debe:3332000, haber:3332000, cuadra:true,
  },
];

// ─── Lectores Supabase (con fallback silencioso) ────────────────────────────
// Intentan leer del esquema cont_*; si la migración no está aplicada o falla,
// devuelven null para que la UI use los datos demo.
export async function cargarAsientosReales(): Promise<Asiento[] | null> {
  try {
    const { data: cab, error } = await supabase
      .from('cont_asiento')
      .select('id,fecha,fuente,origen_tipo,estado,dimension')
      .eq('estado','contabilizado')
      .order('fecha', { ascending:false })
      .limit(200);
    if (error || !cab || cab.length === 0) return null;
    const ids = cab.map((c:any)=>c.id);
    const { data: lns } = await supabase
      .from('cont_asiento_linea')
      .select('asiento_id,cuenta,nombre:descripcion,debe,haber')
      .in('asiento_id', ids);
    const porAsiento: Record<string, any[]> = {};
    (lns||[]).forEach((l:any)=>{ (porAsiento[l.asiento_id] ||= []).push(l); });
    return cab.map((c:any) => {
      const lineas = (porAsiento[c.id]||[]).map((l:any)=>({ cuenta:l.cuenta, nombre:l.nombre||l.cuenta, debe:Number(l.debe)||0, haber:Number(l.haber)||0 }));
      const debe = lineas.reduce((a:number,l:any)=>a+l.debe,0);
      const haber = lineas.reduce((a:number,l:any)=>a+l.haber,0);
      return { fecha:c.fecha, fuente:c.fuente, dim:c.dimension?.restaurante||'OMM', origenTipo:c.origen_tipo, estado:c.estado, lineas, debe, haber, cuadra:Math.round(debe)===Math.round(haber) };
    });
  } catch {
    return null;
  }
}

export async function cargarCartera(): Promise<ARFactura[] | null> {
  try {
    const { data, error } = await supabase.from('cont_ar_factura')
      .select('id,numero,cliente,nit,fecha,vencimiento,base,iva,total,saldo,estado')
      .order('vencimiento');
    if (error || !data || data.length === 0) return null;
    return data.map((f:any)=>({ ...f, id:String(f.id), base:Number(f.base), iva:Number(f.iva), total:Number(f.total), saldo:Number(f.saldo) }));
  } catch { return null; }
}

export async function cargarTesoreria(): Promise<{ bancos:CuentaBanco[]; extracto:ExtractoLinea[] } | null> {
  try {
    const { data: bancos, error: e1 } = await supabase.from('cont_cuenta_banco')
      .select('id,banco,numero,tipo,saldo');
    if (e1 || !bancos || bancos.length === 0) return null;
    const { data: ext } = await supabase.from('cont_extracto_linea')
      .select('id,fecha,descripcion,referencia,valor,conciliado').order('fecha', { ascending:false });
    return {
      bancos: bancos.map((b:any)=>({ id:String(b.id), banco:b.banco, numero:b.numero, tipo:b.tipo, saldoLibros:Number(b.saldo) })),
      extracto: (ext||[]).map((e:any)=>({ id:String(e.id), fecha:e.fecha, descripcion:e.descripcion, referencia:e.referencia, valor:Number(e.valor), conciliado:e.conciliado })),
    };
  } catch { return null; }
}

export async function cargarActivos(): Promise<Activo[] | null> {
  try {
    const { data, error } = await supabase.from('cont_activo')
      .select('id,nombre,clase,costo,vida_util_meses,valor_residual,fecha_uso').eq('estado','activo');
    if (error || !data || data.length === 0) return null;
    return data.map((a:any)=>({ id:String(a.id), nombre:a.nombre, clase:a.clase||'', costo:Number(a.costo), vida_util_meses:a.vida_util_meses, valor_residual:Number(a.valor_residual), fecha_uso:a.fecha_uso }));
  } catch { return null; }
}

export async function cargarImpuestos(): Promise<MovImpuesto[] | null> {
  try {
    const { data, error } = await supabase.from('cont_impuesto_mov')
      .select('tipo,base,valor,origen_tipo');
    if (error || !data || data.length === 0) return null;
    // Consolida por tipo: generado (ventas) vs descontable (compras) y neto.
    const map: Record<string, MovImpuesto> = {};
    data.forEach((m:any)=>{
      const k = m.tipo;
      map[k] ||= { tipo:k, etiqueta:k, generado:0, descontable:0, neto:0, cuenta:'240805' };
      const v = Number(m.valor)||0;
      if (m.origen_tipo === 'compra') map[k].descontable += v; else map[k].generado += v;
    });
    return Object.values(map).map(m => ({ ...m, neto: m.generado - m.descontable }));
  } catch { return null; }
}

// ─── Posteo real: inserta el asiento y sus líneas, luego lo contabiliza ─────
// Flujo: borrador → líneas → update a 'contabilizado' (el trigger valida la
// partida doble y el período abierto). Devuelve {ok, error}.
export async function postearAsiento(a: Asiento, usuario: string): Promise<{ ok:boolean; error?:string }> {
  try {
    const { data: per } = await supabase.from('cont_periodo')
      .select('id').eq('estado','abierto').order('id',{ascending:false}).limit(1).maybeSingle();
    const periodoId = per?.id ?? null;
    const idem = `${a.origenTipo}:${a.fuente}:${a.debe}`;
    const { data: cab, error: e1 } = await supabase.from('cont_asiento')
      .insert({ fecha:new Date().toISOString().slice(0,10), periodo_id:periodoId, fuente:a.fuente, origen_tipo:a.origenTipo, descripcion:a.fuente, estado:'borrador', idempotency_key:idem, creado_por:usuario })
      .select('id').single();
    if (e1 || !cab) return { ok:false, error: e1?.message || 'No se pudo crear el asiento' };
    const lineas = a.lineas.map(l => ({ asiento_id:cab.id, cuenta:l.cuenta, descripcion:l.nombre, tercero:l.tercero, debe:l.debe, haber:l.haber }));
    const { error: e2 } = await supabase.from('cont_asiento_linea').insert(lineas);
    if (e2) return { ok:false, error:e2.message };
    const { error: e3 } = await supabase.from('cont_asiento')
      .update({ estado:'contabilizado', posteado_por:usuario }).eq('id', cab.id);
    if (e3) return { ok:false, error:e3.message };
    return { ok:true };
  } catch (err:any) {
    return { ok:false, error: err?.message || 'Error de red' };
  }
}
