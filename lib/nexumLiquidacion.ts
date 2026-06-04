// ═══════════════════════════════════════════════════════════════════════
// MOTOR OFICIAL NEXUM · Liquidación + Indemnización
// Fuente: Manual técnico NEXUM Talent (Colombia 2026)
// Reglas: separación entre liquidación normal e indemnización por despido.
// No reemplaza revisión jurídica de casos especiales.
// ═══════════════════════════════════════════════════════════════════════

// SMMLV 2026 (proxy) — actualizar cuando se publique oficial
export const SMMLV_2026 = 1423500;
export const AUXILIO_TRANSPORTE_2026 = 200000;
// Aplica si el salario es <= 2 SMMLV (CST art 5 Ley 15/1959)
export const aplicaAuxilioTransporte = (salario:number) =>
  salario > 0 && salario <= 2 * SMMLV_2026;

// ── Tipos ─────────────────────────────────────────────────────────────
export type TipoContrato = 'indefinido' | 'fijo' | 'obra_labor';
export type CausaRetiro =
  | 'renuncia'
  | 'justa_causa'
  | 'sin_justa_causa'
  | 'mutuo_acuerdo'
  | 'terminacion_imputable_al_empleador'
  | 'fin_contrato';

export interface InputLiquidacion {
  // Identificación
  salario_mensual: number;
  salario_variable_promedio?: number;  // comisiones, recargos, bonos salariales
  auxilio_transporte?: number;          // valor mensual (suele ser AUXILIO_TRANSPORTE_2026)
  aplica_auxilio_transporte?: boolean;  // override; si no se pasa, se calcula por salario
  salario_integral?: boolean;
  // Fechas
  fecha_ingreso?: string;               // YYYY-MM-DD
  fecha_retiro?: string;                // YYYY-MM-DD (default = hoy)
  fecha_fin_contrato?: string;          // para tipo fijo
  // Días (si no se dan se calculan de las fechas)
  dias_laborados_mes?: number;          // del mes corriente al retiro
  dias_trabajados_ano?: number;         // total del año actual
  dias_trabajados_semestre?: number;    // total del semestre actual
  dias_faltantes_obra?: number;         // para tipo obra/labor
  dias_vacaciones_pendientes?: number;
  // Pagos previos (evita doble pago)
  cesantias_ya_consignadas?: number;
  prima_ya_pagada?: number;
  vacaciones_ya_pagadas?: number;
  otros_pagos_pendientes?: number;
  // Descuentos
  descuentos_autorizados?: number;
  anticipos?: number;
  prestamos?: number;
  embargos?: number;
  pagos_previos?: number;
}

export interface InputIndemnizacion extends InputLiquidacion {
  tipo_contrato: TipoContrato;
  causa_retiro: CausaRetiro;
}

// ── Helpers de fechas ─────────────────────────────────────────────────
const ymdToDate = (s:string) => new Date(s + 'T12:00:00');
const diffDays = (a:Date, b:Date) => Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));

export const diasAntiguedad = (fechaIngreso?:string, fechaRetiro?:string) => {
  if (!fechaIngreso) return 0;
  const ini = ymdToDate(fechaIngreso);
  const fin = fechaRetiro ? ymdToDate(fechaRetiro) : new Date();
  return diffDays(ini, fin);
};

const inicioAnoActual = (refIso?:string) => {
  const ref = refIso ? ymdToDate(refIso) : new Date();
  return new Date(ref.getFullYear(), 0, 1);
};
const inicioSemestreActual = (refIso?:string) => {
  const ref = refIso ? ymdToDate(refIso) : new Date();
  return ref.getMonth() < 6
    ? new Date(ref.getFullYear(), 0, 1)
    : new Date(ref.getFullYear(), 6, 1);
};

// Días trabajados en el año (clamped a [fecha_ingreso, fecha_retiro])
export const diasTrabajadosEnAno = (fechaIngreso?:string, fechaRetiro?:string) => {
  if (!fechaIngreso) return 0;
  const ingreso = ymdToDate(fechaIngreso);
  const retiro  = fechaRetiro ? ymdToDate(fechaRetiro) : new Date();
  const ini     = inicioAnoActual(fechaRetiro);
  const desde   = ingreso > ini ? ingreso : ini;
  return Math.min(360, diffDays(desde, retiro));
};

export const diasTrabajadosEnSemestre = (fechaIngreso?:string, fechaRetiro?:string) => {
  if (!fechaIngreso) return 0;
  const ingreso = ymdToDate(fechaIngreso);
  const retiro  = fechaRetiro ? ymdToDate(fechaRetiro) : new Date();
  const ini     = inicioSemestreActual(fechaRetiro);
  const desde   = ingreso > ini ? ingreso : ini;
  return Math.min(180, diffDays(desde, retiro));
};

export const diasLaboradosDelMes = (fechaRetiro?:string) => {
  const retiro = fechaRetiro ? ymdToDate(fechaRetiro) : new Date();
  return retiro.getDate();
};

// ── Bases salariales (§3 del manual) ──────────────────────────────────
export const calcularBases = (i: InputLiquidacion) => {
  const sal = Number(i.salario_mensual) || 0;
  const variable = Number(i.salario_variable_promedio) || 0;
  const auxBase = Number(i.auxilio_transporte) || AUXILIO_TRANSPORTE_2026;
  const aplicaAux = i.aplica_auxilio_transporte !== undefined
    ? i.aplica_auxilio_transporte
    : aplicaAuxilioTransporte(sal);
  const auxilio = aplicaAux ? auxBase : 0;
  return {
    salario_base_indemnizacion: sal + variable,            // SIN auxilio
    salario_base_prestaciones:  sal + variable + auxilio,  // CON auxilio
    salario_base_vacaciones:    sal + variable,            // SIN auxilio
    salario_diario:             sal / 30,
    auxilio_transporte:         auxilio,
    aplica_auxilio:             aplicaAux,
  };
};

// ── Liquidación normal (§5 del manual) ────────────────────────────────
export interface ResultadoLiquidacion {
  bases: ReturnType<typeof calcularBases>;
  salario_pendiente: number;
  auxilio_pendiente: number;
  cesantias_causadas: number;
  cesantias_a_pagar: number;
  intereses_cesantias: number;
  prima_causada: number;
  prima_a_pagar: number;
  vacaciones_causadas: number;
  vacaciones_a_pagar: number;
  otros_pagos_pendientes: number;
  descuentos_totales: number;
  total_liquidacion: number;
  // metadatos
  dias_laborados_mes: number;
  dias_trabajados_ano: number;
  dias_trabajados_semestre: number;
  dias_vacaciones_pendientes: number;
}

export function calcularLiquidacion(i: InputLiquidacion): ResultadoLiquidacion {
  const bases = calcularBases(i);
  const diasMes      = i.dias_laborados_mes      ?? diasLaboradosDelMes(i.fecha_retiro);
  const diasAno      = i.dias_trabajados_ano     ?? diasTrabajadosEnAno(i.fecha_ingreso, i.fecha_retiro);
  const diasSemestre = i.dias_trabajados_semestre?? diasTrabajadosEnSemestre(i.fecha_ingreso, i.fecha_retiro);
  const diasVac      = Number(i.dias_vacaciones_pendientes) || 0;

  const salario_pendiente = (Number(i.salario_mensual) || 0) / 30 * diasMes;
  const auxilio_pendiente = bases.aplica_auxilio ? (bases.auxilio_transporte / 30 * diasMes) : 0;
  // Cesantías y intereses
  const cesantias_causadas  = bases.salario_base_prestaciones * diasAno / 360;
  const cesantias_a_pagar   = Math.max(0, cesantias_causadas - (Number(i.cesantias_ya_consignadas) || 0));
  const intereses_cesantias = cesantias_causadas * diasAno * 0.12 / 360;
  // Prima
  const prima_causada = bases.salario_base_prestaciones * diasSemestre / 360;
  const prima_a_pagar = Math.max(0, prima_causada - (Number(i.prima_ya_pagada) || 0));
  // Vacaciones
  const vacaciones_causadas = bases.salario_base_vacaciones * diasVac / 720;
  const vacaciones_a_pagar  = Math.max(0, vacaciones_causadas - (Number(i.vacaciones_ya_pagadas) || 0));
  // Otros pagos pendientes (recargos, extras, comisiones causadas no pagadas)
  const otros_pagos_pendientes = Number(i.otros_pagos_pendientes) || 0;
  // Descuentos
  const descuentos_totales =
      (Number(i.descuentos_autorizados) || 0)
    + (Number(i.anticipos)              || 0)
    + (Number(i.prestamos)              || 0)
    + (Number(i.embargos)               || 0)
    + (Number(i.pagos_previos)          || 0);
  const total_liquidacion =
      salario_pendiente
    + auxilio_pendiente
    + cesantias_a_pagar
    + intereses_cesantias
    + prima_a_pagar
    + vacaciones_a_pagar
    + otros_pagos_pendientes
    - descuentos_totales;
  return {
    bases,
    salario_pendiente, auxilio_pendiente,
    cesantias_causadas, cesantias_a_pagar, intereses_cesantias,
    prima_causada, prima_a_pagar,
    vacaciones_causadas, vacaciones_a_pagar,
    otros_pagos_pendientes, descuentos_totales,
    total_liquidacion,
    dias_laborados_mes: diasMes,
    dias_trabajados_ano: diasAno,
    dias_trabajados_semestre: diasSemestre,
    dias_vacaciones_pendientes: diasVac,
  };
}

// ── Indemnización por despido (§4 del manual) ─────────────────────────
export interface ResultadoIndemnizacion {
  aplica: boolean;
  motivo_no_aplica?: string;
  tipo_contrato: TipoContrato;
  causa_retiro: CausaRetiro;
  salario_base_indemnizacion: number;
  salario_diario: number;
  dias_antiguedad: number;
  dias_indemnizacion: number;
  total_indemnizacion: number;
  detalle: string; // descripción de la regla aplicada
}

export function calcularIndemnizacion(i: InputIndemnizacion): ResultadoIndemnizacion {
  const tipo  = i.tipo_contrato;
  const causa = i.causa_retiro;
  const bases = calcularBases(i);
  const diasAnt = diasAntiguedad(i.fecha_ingreso, i.fecha_retiro);
  const sd = bases.salario_base_indemnizacion / 30; // salario diario sobre base indemnización

  const base = {
    aplica: false,
    tipo_contrato: tipo,
    causa_retiro: causa,
    salario_base_indemnizacion: bases.salario_base_indemnizacion,
    salario_diario: sd,
    dias_antiguedad: diasAnt,
    dias_indemnizacion: 0,
    total_indemnizacion: 0,
    detalle: '',
  };

  // Regla de activación (§4.1)
  if (causa === 'renuncia')              return { ...base, motivo_no_aplica: 'Renuncia voluntaria · no aplica indemnización', detalle:'§4.1 · renuncia → 0' };
  if (causa === 'justa_causa')           return { ...base, motivo_no_aplica: 'Despido con justa causa · no aplica indemnización', detalle:'§4.1 · justa causa → 0' };
  if (causa === 'mutuo_acuerdo')         return { ...base, motivo_no_aplica: 'Mutuo acuerdo · no aplica salvo pacto especial', detalle:'§4.1 · mutuo acuerdo → 0 (salvo pacto)' };
  if (causa === 'fin_contrato')          return { ...base, motivo_no_aplica: 'Fin de contrato a término · no aplica si se respetó el plazo', detalle:'§4.1 · fin natural del contrato' };

  // causa = sin_justa_causa o terminacion_imputable_al_empleador → CALCULAR
  let dias = 0;
  let detalle = '';

  if (tipo === 'fijo') {
    // §4.4 — días faltantes hasta fecha fin contrato
    if (!i.fecha_fin_contrato || !i.fecha_retiro) {
      return { ...base, aplica:false, motivo_no_aplica:'Falta fecha_fin_contrato para calcular término fijo', detalle:'§4.4 falta fecha' };
    }
    const fin  = ymdToDate(i.fecha_fin_contrato);
    const ret  = ymdToDate(i.fecha_retiro);
    dias = Math.max(0, diffDays(ret, fin));
    detalle = `§4.4 · fijo · días faltantes = ${dias}`;
  }
  else if (tipo === 'obra_labor') {
    // §4.5 — MAX(días faltantes, 15)
    dias = Math.max(Number(i.dias_faltantes_obra) || 0, 15);
    detalle = `§4.5 · obra/labor · MAX(días faltantes, 15) = ${dias}`;
  }
  else {
    // §4.2 / §4.3 — indefinido por umbral 10 SMMLV
    const limite10 = 10 * SMMLV_2026;
    const menor10 = bases.salario_base_indemnizacion < limite10;
    if (diasAnt <= 360) {
      dias = menor10 ? 30 : 20;
      detalle = menor10
        ? `§4.2 · indef <10SMMLV, antigüedad ≤1año → 30 días`
        : `§4.3 · indef ≥10SMMLV, antigüedad ≤1año → 20 días`;
    } else {
      const adicionales = ((diasAnt - 360) / 360) * (menor10 ? 20 : 15);
      dias = (menor10 ? 30 : 20) + adicionales;
      detalle = menor10
        ? `§4.2 · indef <10SMMLV, antigüedad >1año → 30 + (años−1)×20 = ${dias.toFixed(1)} días`
        : `§4.3 · indef ≥10SMMLV, antigüedad >1año → 20 + (años−1)×15 = ${dias.toFixed(1)} días`;
    }
  }

  return {
    ...base,
    aplica: true,
    dias_indemnizacion: dias,
    total_indemnizacion: sd * dias,
    detalle,
  };
}

// ── Total a pagar (liquidación + indemnización si aplica) ─────────────
export function calcularRetiroCompleto(i: InputIndemnizacion) {
  const liq = calcularLiquidacion(i);
  const ind = calcularIndemnizacion(i);
  return {
    liquidacion: liq,
    indemnizacion: ind,
    total_a_pagar: liq.total_liquidacion + (ind.aplica ? ind.total_indemnizacion : 0),
  };
}

// ── Helper de formato ─────────────────────────────────────────────────
export const cop = (n:number) => '$' + Math.round(n || 0).toLocaleString('es-CO');
