// ═══════════════════════════════════════════════════════════════════════════
// NEXUM · Dominio contable (record-to-report)
// Motor de asientos de partida doble, plan de cuentas (PUC), RBAC/SoD y
// agregaciones de libro mayor, balance de prueba, cartera, tesorería e
// impuestos. Lógica pura y testeable; la persistencia vive en contabilidadData.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Tipos base ─────────────────────────────────────────────────────────────
export type CuentaPUC = { c: string; n: string };
export type AsientoLinea = { cuenta: string; nombre: string; debe: number; haber: number; tercero?: string };
export type Asiento = {
  fecha: string;
  fuente: string;
  dim: string;
  origenTipo: OrigenTipo;
  estado: 'borrador' | 'contabilizado';
  lineas: AsientoLinea[];
  debe: number;
  haber: number;
  cuadra: boolean;
};
export type OrigenTipo = 'cierre_caja' | 'factura_ap' | 'factura_ar' | 'recaudo_ar' | 'nomina' | 'impuesto' | 'tesoreria' | 'manual';

// ─── Plan de cuentas mínimo (PUC) ───────────────────────────────────────────
export const PUC = {
  caja:      { c:'110505', n:'Caja general' },
  bancos:    { c:'111005', n:'Bancos' },
  pasarela:  { c:'131005', n:'CxC pasarela / banco en tránsito' },
  cxcEmpl:   { c:'136540', n:'CxC trabajadores' },
  clientes:  { c:'130505', n:'Clientes nacionales' },
  deterioro: { c:'139905', n:'Deterioro cuentas por cobrar' },
  ingresos:  { c:'413550', n:'Ingresos operacionales — restaurante' },
  ivaInc:    { c:'240805', n:'Impuesto (IVA/INC) por pagar' },
  propinas:  { c:'233595', n:'Propinas por liquidar' },
  redencion: { c:'529595', n:'Bonos y cortesías redimidos' },
  gastoDet:  { c:'519910', n:'Gasto deterioro de cartera' },
  nomSueldos:{ c:'510506', n:'Sueldos y prestaciones' },
  nomCargas: { c:'510569', n:'Aportes y cargas patronales' },
  nomSegSoc: { c:'237006', n:'Aportes seguridad social por pagar' },
  nomReten:  { c:'236505', n:'Deducciones de nómina por pagar' },
  nomPorPagar:{ c:'250501', n:'Salarios por pagar' },
} as const;

export const PUC_AP = {
  costoAlim:   { c:'613505', n:'Costo de alimentos' },
  costoBeb:    { c:'613510', n:'Costo de bebidas' },
  servicios:   { c:'513505', n:'Servicios públicos' },
  aseo:        { c:'513540', n:'Aseo y mantenimiento' },
  arriendo:    { c:'512010', n:'Arrendamientos' },
  gastoGen:    { c:'519595', n:'Gastos diversos' },
  ivaDesc:     { c:'240810', n:'IVA descontable' },
  proveedores: { c:'220505', n:'Proveedores nacionales' },
  reteFuente:  { c:'236540', n:'Retención en la fuente por pagar' },
} as const;

// ─── Helper para construir el resultado Asiento desde líneas ────────────────
function armar(lineas: AsientoLinea[], meta: Omit<Asiento,'lineas'|'debe'|'haber'|'cuadra'>): Asiento {
  const debe  = lineas.reduce((a, l) => a + l.debe, 0);
  const haber = lineas.reduce((a, l) => a + l.haber, 0);
  return { ...meta, lineas, debe, haber, cuadra: Math.round(debe) === Math.round(haber) };
}

// ─── Ventas: cierre de caja ─────────────────────────────────────────────────
export const cuentaDeMetodo = (label: string): CuentaPUC => {
  const l = label.toLowerCase();
  if (l.includes('efectivo')) return PUC.caja;
  if (l.includes('transfer') || l.includes('anticipo')) return PUC.bancos;
  if (l.includes('empleado')) return PUC.cxcEmpl;
  if (l.includes('bono') || l.includes('regalo')) return PUC.redencion;
  return PUC.pasarela;
};

export function construirAsientoCierre(
  metodos: { label: string; bruto: number; desc: number; prop: number; iva: number }[],
  turno: { responsable: string; hora_apertura: string; hora_cierre?: string; estado: 'abierta'|'cerrada' } | null,
): Asiento {
  const debitosPorCuenta: Record<string, AsientoLinea> = {};
  metodos.forEach(m => {
    const neto = m.bruto - m.desc;
    if (neto <= 0) return;
    const cu = cuentaDeMetodo(m.label);
    if (!debitosPorCuenta[cu.c]) debitosPorCuenta[cu.c] = { cuenta:cu.c, nombre:cu.n, debe:0, haber:0 };
    debitosPorCuenta[cu.c].debe += neto;
  });
  const debitos = Object.values(debitosPorCuenta);
  const totalRecaudo = debitos.reduce((a, d) => a + d.debe, 0);
  const iva  = metodos.reduce((a, m) => a + m.iva, 0);
  const prop = metodos.reduce((a, m) => a + m.prop, 0);
  const baseIngresos = totalRecaudo - iva - prop;
  const lineas: AsientoLinea[] = [
    ...debitos,
    { cuenta:PUC.ingresos.c, nombre:PUC.ingresos.n, debe:0, haber:baseIngresos },
    ...(iva  > 0 ? [{ cuenta:PUC.ivaInc.c,   nombre:PUC.ivaInc.n,   debe:0, haber:iva  }] : []),
    ...(prop > 0 ? [{ cuenta:PUC.propinas.c, nombre:PUC.propinas.n, debe:0, haber:prop }] : []),
  ];
  return armar(lineas, {
    fecha: new Date().toLocaleDateString('es-CO'),
    fuente: turno
      ? `Cierre Z · turno ${turno.responsable} (${turno.hora_apertura}${turno.hora_cierre ? `–${turno.hora_cierre}` : ''})`
      : 'Resumen de ventas del día · sin turno cerrado',
    dim: 'OMM · Restaurante principal',
    origenTipo: 'cierre_caja',
    estado: turno?.estado === 'cerrada' ? 'contabilizado' : 'borrador',
  });
}

// ─── Compras: causación CxP con IVA y retenciones ───────────────────────────
export const reglaGasto = (categoria: string) => {
  const c = (categoria || '').toLowerCase();
  if (c.includes('aliment')) return { cuenta:PUC_AP.costoAlim, rete:0.025, ivaTasa:0    };
  if (c.includes('bebida'))  return { cuenta:PUC_AP.costoBeb,  rete:0.025, ivaTasa:0.19 };
  if (c.includes('servicio'))return { cuenta:PUC_AP.servicios, rete:0.04,  ivaTasa:0.19 };
  if (c.includes('aseo') || c.includes('mtto')) return { cuenta:PUC_AP.aseo, rete:0.04, ivaTasa:0.19 };
  if (c.includes('arrend'))  return { cuenta:PUC_AP.arriendo,  rete:0.035, ivaTasa:0    };
  return { cuenta:PUC_AP.gastoGen, rete:0.025, ivaTasa:0.19 };
};

export function construirAsientoGasto(g: { proveedor:string; concepto:string; base:number; categoria:string; fecha:string; nit?:string })
  : Asiento & { base:number; iva:number; rete:number; neto:number; reteTasa:number } {
  const r = reglaGasto(g.categoria);
  const base = g.base;
  const iva  = Math.round(base * r.ivaTasa);
  const rete = Math.round(base * r.rete);
  const neto = base + iva - rete;
  const lineas: AsientoLinea[] = [
    { cuenta:r.cuenta.c, nombre:r.cuenta.n, debe:base, haber:0 },
    ...(iva  > 0 ? [{ cuenta:PUC_AP.ivaDesc.c, nombre:PUC_AP.ivaDesc.n, debe:iva, haber:0 }] : []),
    ...(rete > 0 ? [{ cuenta:PUC_AP.reteFuente.c, nombre:`${PUC_AP.reteFuente.n} (${(r.rete*100).toFixed(1)}%)`, debe:0, haber:rete }] : []),
    { cuenta:PUC_AP.proveedores.c, nombre:PUC_AP.proveedores.n, debe:0, haber:neto, tercero:g.nit },
  ];
  const a = armar(lineas, {
    fecha:g.fecha, fuente:`Factura proveedor · ${g.proveedor} — ${g.concepto}`,
    dim:'OMM · Restaurante principal', origenTipo:'factura_ap', estado:'contabilizado',
  });
  return { ...a, base, iva, rete, neto, reteTasa:r.rete };
}

// ─── CxC: factura a crédito y recaudo (NIIF 9) ──────────────────────────────
export function construirAsientoARFactura(f: { cliente:string; nit?:string; base:number; iva:number; numero:string; fecha:string }): Asiento {
  const total = f.base + f.iva;
  const lineas: AsientoLinea[] = [
    { cuenta:PUC.clientes.c, nombre:PUC.clientes.n, debe:total, haber:0, tercero:f.nit },
    { cuenta:PUC.ingresos.c, nombre:PUC.ingresos.n, debe:0, haber:f.base },
    ...(f.iva > 0 ? [{ cuenta:PUC.ivaInc.c, nombre:PUC.ivaInc.n, debe:0, haber:f.iva }] : []),
  ];
  return armar(lineas, {
    fecha:f.fecha, fuente:`Factura a crédito · ${f.numero} — ${f.cliente}`,
    dim:'OMM · Restaurante principal', origenTipo:'factura_ar', estado:'contabilizado',
  });
}

export function construirAsientoARRecaudo(r: { cliente:string; monto:number; fecha:string; factura:string }): Asiento {
  const lineas: AsientoLinea[] = [
    { cuenta:PUC.bancos.c,   nombre:PUC.bancos.n,   debe:r.monto, haber:0 },
    { cuenta:PUC.clientes.c, nombre:PUC.clientes.n, debe:0, haber:r.monto },
  ];
  return armar(lineas, {
    fecha:r.fecha, fuente:`Recaudo · ${r.factura} — ${r.cliente}`,
    dim:'OMM · Restaurante principal', origenTipo:'recaudo_ar', estado:'contabilizado',
  });
}

// Deterioro de cartera (ECL, NIIF 9): Dr gasto deterioro ; Cr provisión.
export function construirAsientoDeterioro(monto: number, fecha: string): Asiento {
  const lineas: AsientoLinea[] = [
    { cuenta:PUC.gastoDet.c,  nombre:PUC.gastoDet.n,  debe:monto, haber:0 },
    { cuenta:PUC.deterioro.c, nombre:PUC.deterioro.n, debe:0, haber:monto },
  ];
  return armar(lineas, {
    fecha, fuente:'Provisión deterioro de cartera (ECL · NIIF 9)',
    dim:'OMM · Restaurante principal', origenTipo:'manual', estado:'contabilizado',
  });
}

// ─── Aging de cartera ───────────────────────────────────────────────────────
export type Tramo = 'corriente' | '1-30' | '31-60' | '61-90' | '+90';
export const tramoVencimiento = (vencimiento: string, hoy = new Date()): Tramo => {
  const v = new Date(vencimiento + 'T12:00:00');
  const dias = Math.floor((hoy.getTime() - v.getTime()) / 86400000);
  if (dias <= 0) return 'corriente';
  if (dias <= 30) return '1-30';
  if (dias <= 60) return '31-60';
  if (dias <= 90) return '61-90';
  return '+90';
};
// Tasa de pérdida esperada por tramo (matriz ECL simplificada)
export const TASA_ECL: Record<Tramo, number> = { 'corriente':0.005, '1-30':0.02, '31-60':0.08, '61-90':0.20, '+90':0.50 };

export function agingCartera(facturas: { saldo:number; vencimiento:string }[], hoy = new Date()) {
  const tramos: Record<Tramo,{ saldo:number; ecl:number }> = {
    'corriente':{saldo:0,ecl:0}, '1-30':{saldo:0,ecl:0}, '31-60':{saldo:0,ecl:0}, '61-90':{saldo:0,ecl:0}, '+90':{saldo:0,ecl:0},
  };
  facturas.forEach(f => {
    if (f.saldo <= 0) return;
    const t = tramoVencimiento(f.vencimiento, hoy);
    tramos[t].saldo += f.saldo;
    tramos[t].ecl  += f.saldo * TASA_ECL[t];
  });
  const saldoTotal = Object.values(tramos).reduce((a,t)=>a+t.saldo,0);
  const eclTotal   = Object.values(tramos).reduce((a,t)=>a+t.ecl,0);
  return { tramos, saldoTotal, eclTotal };
}

// ─── Nómina: causación del período ──────────────────────────────────────────
// Dr gasto salarios + cargas patronales ; Cr seguridad social, deducciones y
// nómina por pagar (neto). La base se reparte de modo que Debe = Haber.
export function construirAsientoNomina(d: { salarios:number; cargas:number; seguridadSocial:number; retenciones:number; fecha:string })
  : Asiento & { neto:number } {
  const neto = d.salarios + d.cargas - d.seguridadSocial - d.retenciones;
  const lineas: AsientoLinea[] = [
    { cuenta:PUC.nomSueldos.c,  nombre:PUC.nomSueldos.n,  debe:d.salarios, haber:0 },
    { cuenta:PUC.nomCargas.c,   nombre:PUC.nomCargas.n,   debe:d.cargas,   haber:0 },
    { cuenta:PUC.nomSegSoc.c,   nombre:PUC.nomSegSoc.n,   debe:0, haber:d.seguridadSocial },
    { cuenta:PUC.nomReten.c,    nombre:PUC.nomReten.n,    debe:0, haber:d.retenciones },
    { cuenta:PUC.nomPorPagar.c, nombre:PUC.nomPorPagar.n, debe:0, haber:neto },
  ];
  const a = armar(lineas, {
    fecha:d.fecha, fuente:'Causación de nómina del período',
    dim:'OMM · Restaurante principal', origenTipo:'nomina', estado:'contabilizado',
  });
  return { ...a, neto };
}

// ─── Activos fijos (NIC 16): depreciación ───────────────────────────────────
export function construirAsientoDepreciacion(montoMensual: number, fecha: string): Asiento {
  const lineas: AsientoLinea[] = [
    { cuenta:'516005', nombre:'Gasto depreciación',     debe:montoMensual, haber:0 },
    { cuenta:'159205', nombre:'Depreciación acumulada', debe:0, haber:montoMensual },
  ];
  return armar(lineas, {
    fecha, fuente:'Corrida de depreciación del período',
    dim:'OMM · Restaurante principal', origenTipo:'manual', estado:'contabilizado',
  });
}

export type Activo = { id:string; nombre:string; clase:string; costo:number; vida_util_meses:number; valor_residual:number; fecha_uso:string };
// Depreciación mensual lineal = (costo − residual) / vida útil, solo si ya está en uso.
export const depreciacionMensual = (a: Activo, hoy = new Date()) => {
  if (!a.fecha_uso || new Date(a.fecha_uso + 'T12:00:00') > hoy) return 0; // norma: no depreciar antes de la fecha de uso
  return Math.round((a.costo - a.valor_residual) / a.vida_util_meses);
};

// ─── Cierre de período: cancelar ingresos/gastos/costos a resultado ─────────
// Norma NIC 1/8: cierra clases 4 (ingresos), 5 (gastos) y 6 (costos) contra la
// cuenta de resultado del ejercicio (360505). El asiento siempre cuadra.
export function construirAsientoCierrePeriodo(mayor: SaldoCuenta[], fecha: string): Asiento & { utilidad:number } {
  const ingresos = mayor.filter(c => c.cuenta[0] === '4');
  const gastos   = mayor.filter(c => c.cuenta[0] === '5' || c.cuenta[0] === '6');
  const totalIngresos = ingresos.reduce((a,c)=>a + (c.haber - c.debe), 0);
  const totalGastos   = gastos.reduce((a,c)=>a + (c.debe - c.haber), 0);
  const utilidad = totalIngresos - totalGastos;
  const lineas: AsientoLinea[] = [
    ...ingresos.filter(c=>c.haber-c.debe!==0).map(c => ({ cuenta:c.cuenta, nombre:c.nombre, debe:c.haber - c.debe, haber:0 })),
    ...gastos.filter(c=>c.debe-c.haber!==0).map(c => ({ cuenta:c.cuenta, nombre:c.nombre, debe:0, haber:c.debe - c.haber })),
    utilidad >= 0
      ? { cuenta:'360505', nombre:'Utilidad del ejercicio', debe:0, haber:utilidad }
      : { cuenta:'360505', nombre:'Pérdida del ejercicio',  debe:-utilidad, haber:0 },
  ];
  const a = armar(lineas, {
    fecha, fuente:'Asiento de cierre del período', dim:'OMM · Restaurante principal',
    origenTipo:'manual', estado:'contabilizado',
  });
  return { ...a, utilidad };
}

// ─── Consolidación multiempresa (NIIF 10) ───────────────────────────────────
export type EntidadFin = { entidad:string; ingresos:number; costos:number; gastos:number };
export type Eliminacion = { concepto:string; monto:number };
export function consolidar(entidades: EntidadFin[], eliminaciones: Eliminacion[]) {
  const sum = (k: keyof Omit<EntidadFin,'entidad'>) => entidades.reduce((a,e)=>a + e[k], 0);
  const elimTotal = eliminaciones.reduce((a,e)=>a + e.monto, 0);
  const ingresos = sum('ingresos') - elimTotal;   // se eliminan ingresos intercompañía
  const costos   = sum('costos')   - elimTotal;    // y su costo recíproco
  const gastos   = sum('gastos');
  const utilidad = ingresos - costos - gastos;
  return { ingresosBruto:sum('ingresos'), elimTotal, ingresos, costos, gastos, utilidad };
}

// ─── Impuestos: pago de declaración ─────────────────────────────────────────
export function construirAsientoPagoImpuesto(cuenta: CuentaPUC, monto: number, fecha: string, concepto: string): Asiento {
  const lineas: AsientoLinea[] = [
    { cuenta:cuenta.c,     nombre:cuenta.n,     debe:monto, haber:0 },
    { cuenta:PUC.bancos.c, nombre:PUC.bancos.n, debe:0, haber:monto },
  ];
  return armar(lineas, {
    fecha, fuente:`Pago declaración · ${concepto}`,
    dim:'OMM · Restaurante principal', origenTipo:'impuesto', estado:'contabilizado',
  });
}

// ─── Libro mayor y balance de prueba ────────────────────────────────────────
export type SaldoCuenta = { cuenta:string; nombre:string; debe:number; haber:number; saldo:number };

// Agrega todas las líneas de los asientos contabilizados por cuenta.
export function libroMayor(asientos: Asiento[]): SaldoCuenta[] {
  const map: Record<string, SaldoCuenta> = {};
  asientos.filter(a => a.estado === 'contabilizado').forEach(a => {
    a.lineas.forEach(l => {
      if (!map[l.cuenta]) map[l.cuenta] = { cuenta:l.cuenta, nombre:l.nombre, debe:0, haber:0, saldo:0 };
      map[l.cuenta].debe  += l.debe;
      map[l.cuenta].haber += l.haber;
    });
  });
  return Object.values(map)
    .map(s => ({ ...s, saldo: s.debe - s.haber }))
    .sort((a,b) => a.cuenta.localeCompare(b.cuenta));
}

// Balance de prueba: el mayor + verificación de que ΣDebe = ΣHaber.
export function balancePrueba(asientos: Asiento[]) {
  const cuentas = libroMayor(asientos);
  const totalDebe  = cuentas.reduce((a,c)=>a+c.debe,0);
  const totalHaber = cuentas.reduce((a,c)=>a+c.haber,0);
  return { cuentas, totalDebe, totalHaber, cuadra: Math.round(totalDebe) === Math.round(totalHaber) };
}

// ─── RBAC + Segregación de funciones (SoD) ──────────────────────────────────
export type Rol = 'cajero' | 'analista_cxp' | 'tesorero' | 'contador' | 'cfo' | 'auditor';
export type Accion = 'abrir_caja' | 'cerrar_caja' | 'causar_gasto' | 'preparar_pago' | 'aprobar_pago' | 'postear_asiento' | 'cerrar_periodo' | 'conciliar';
export const ROLES: Record<Rol, { label:string; puede:Accion[] }> = {
  cajero:       { label:'Cajero / Supervisor', puede:['abrir_caja','cerrar_caja'] },
  analista_cxp: { label:'Analista CxP',         puede:['causar_gasto'] },
  tesorero:     { label:'Tesorero',             puede:['preparar_pago','conciliar'] },
  contador:     { label:'Contador',             puede:['causar_gasto','postear_asiento','cerrar_periodo','conciliar'] },
  cfo:          { label:'Controller / CFO',     puede:['abrir_caja','cerrar_caja','causar_gasto','preparar_pago','aprobar_pago','postear_asiento','cerrar_periodo','conciliar'] },
  auditor:      { label:'Auditor interno',      puede:[] },
};
export const can = (rol: Rol, accion: Accion) => ROLES[rol].puede.includes(accion);

// ─── Formato ────────────────────────────────────────────────────────────────
export const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n || 0);
