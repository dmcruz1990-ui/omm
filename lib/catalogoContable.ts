// ═══════════════════════════════════════════════════════════════════════
// Catálogo contable — ahora vive en BD (catalogo_egresos) según spec
// NEXUM Finance Hub. Este módulo solo expone tipos + loader + helpers
// derivados (centros de costo, agrupaciones P&G).
//
// El catálogo se carga UNA vez al montar FinanceHub y se cachea en
// memoria; las búsquedas son sincrónicas contra el array cacheado.
// ═══════════════════════════════════════════════════════════════════════

import { supabase } from './supabase.ts';

export type ImpactoPG = 'si' | 'no' | 'depende';

export type TipoFinanciero =
  | 'costo' | 'gasto' | 'activo' | 'pasivo'
  | 'anticipo' | 'impuesto' | 'propina_por_pagar' | 'medio_pago';

export type CategoriaOperativa =
  | 'costos_directos'
  | 'nomina'
  | 'ocupacion'
  | 'servicios_publicos'
  | 'mantenimiento'
  | 'operacion'
  | 'experiencia'
  | 'administracion'
  | 'comercial'
  | 'financiero'
  | 'impuestos'
  | 'balance'
  | 'caja_menor'
  | 'capex'
  | 'no_recurrente'
  | 'otro_controlado';

export interface ConceptoCatalogo {
  id: string;
  nombre_usuario: string;
  categoria_maestra: string;
  categoria_operativa: CategoriaOperativa;
  grupo_pyg: string;
  subgrupo_pyg: string | null;
  tipo_financiero: TipoFinanciero;
  impacta_pyg: ImpactoPG;
  cuenta_niif_interna: string;
  centro_costo_default: string;
  requiere_factura: boolean;
  requiere_ocr: boolean;
  requiere_aprobacion: boolean;
  monto_aprobacion: number;
  permite_nota_libre: boolean;
  es_recurrente: boolean;
  es_caja_menor: boolean;
  es_capex: boolean;
  es_impuesto_recaudado: boolean;
  es_propina: boolean;
  estado: string;
  orden_ux: number;
  notas_contables: string | null;
}

// Etiquetas de UI para las 16 categorías operativas (lo que ve el usuario).
// Sólo 12 visibles por defecto; el resto se muestra como "ver más".
export const CATEGORIAS_OPERATIVAS_UI: { id: CategoriaOperativa; emoji: string; label: string; desc: string; visible: boolean }[] = [
  { id: 'costos_directos',    emoji: '🍳', label: 'Costos directos',    desc: 'Alimentos, bebidas, bar, empaques',           visible: true },
  { id: 'nomina',             emoji: '👥', label: 'Nómina',              desc: 'Cocina, bar, servicio, prestaciones',         visible: true },
  { id: 'ocupacion',          emoji: '🏠', label: 'Arriendo y ocupación',desc: 'Arriendo, administración, copropiedad',       visible: true },
  { id: 'servicios_publicos', emoji: '⚡', label: 'Servicios públicos',  desc: 'Energía, agua, gas, internet',                visible: true },
  { id: 'mantenimiento',      emoji: '🔧', label: 'Mantenimiento',       desc: 'Reparaciones, equipos, refrigeración',        visible: true },
  { id: 'operacion',          emoji: '🧼', label: 'Operación diaria',    desc: 'Aseo, menaje, uniformes, seguridad',          visible: true },
  { id: 'experiencia',        emoji: '🎵', label: 'Experiencia',         desc: 'DJ, música, decoración, flores',              visible: true },
  { id: 'administracion',     emoji: '📋', label: 'Administración',      desc: 'Gerencia, honorarios, papelería, software',   visible: true },
  { id: 'comercial',          emoji: '📢', label: 'Marketing y ventas',  desc: 'Pauta, influencers, CRM, eventos',            visible: true },
  { id: 'financiero',         emoji: '🏦', label: 'Bancos y deuda',      desc: 'Comisiones, intereses, datáfono, 4x1000',     visible: true },
  { id: 'impuestos',          emoji: '🧾', label: 'Impuestos y tributos',desc: 'ICA, IVA, retenciones, permisos',             visible: true },
  { id: 'balance',            emoji: '💰', label: 'Propinas',            desc: 'Recaudo y pago de propinas (no toca P&G)',    visible: true },
  { id: 'caja_menor',         emoji: '👜', label: 'Caja menor',          desc: 'Reembolsos urgentes (se reclasifican)',       visible: true },
  { id: 'capex',              emoji: '🏗️', label: 'CAPEX / Activos',     desc: 'Equipos, obras, mobiliario (no P&G directo)', visible: true },
  { id: 'no_recurrente',      emoji: '⚠️', label: 'No recurrente / Legal',desc: 'Multas, sanciones, contingencias, robos',    visible: true },
  { id: 'otro_controlado',    emoji: '❓', label: 'Otro (pendiente)',    desc: 'Se reclasifica luego — requiere aprobación',  visible: true },
];

// Orígenes del egreso (Paso 1 del PDF).
export const ORIGENES_EGRESO = [
  { id: 'efectivo',      emoji: '💵', label: 'Efectivo' },
  { id: 'caja_menor',    emoji: '👜', label: 'Caja menor' },
  { id: 'banco',         emoji: '🏦', label: 'Banco' },
  { id: 'tarjeta',       emoji: '💳', label: 'Tarjeta' },
  { id: 'transferencia', emoji: '📲', label: 'Transferencia' },
  { id: 'anticipo',      emoji: '📥', label: 'Anticipo' },
  { id: 'reembolso',     emoji: '🔁', label: 'Reembolso' },
  { id: 'proveedor',     emoji: '🚚', label: 'Crédito proveedor' },
] as const;

// Color por grupo P&G — para los chips de la UI.
export const GRUPO_PYG_COLORS: Record<string, string> = {
  'Costo de venta':        '#FF5252',
  'Gasto operacional':     '#FFB547',
  'Gasto administrativo':  '#448AFF',
  'Gasto comercial':       '#B388FF',
  'Gasto financiero':      '#FF2D78',
  'No recurrente':         '#FF7043',
  'Balance':               '#00E676',
};

// ── Loader cacheado ──────────────────────────────────────────────────
let _cache: ConceptoCatalogo[] | null = null;
let _cargandoPromise: Promise<ConceptoCatalogo[]> | null = null;

export async function cargarCatalogoEgresos(forzar = false): Promise<ConceptoCatalogo[]> {
  if (_cache && !forzar) return _cache;
  if (_cargandoPromise) return _cargandoPromise;
  _cargandoPromise = (async () => {
    const { data, error } = await supabase
      .from('catalogo_egresos')
      .select('*')
      .eq('estado', 'activo')
      .order('categoria_operativa').order('orden_ux').order('nombre_usuario');
    _cargandoPromise = null;
    if (error || !data) return [];
    _cache = data as ConceptoCatalogo[];
    return _cache;
  })();
  return _cargandoPromise;
}

export function conceptosDeCategoria(catalogo: ConceptoCatalogo[], categoriaOperativa: string): ConceptoCatalogo[] {
  return catalogo.filter(c => c.categoria_operativa === categoriaOperativa);
}

export function buscarConcepto(catalogo: ConceptoCatalogo[], id: string): ConceptoCatalogo | undefined {
  return catalogo.find(c => c.id === id);
}

// Lista única de centros de costo presentes en el catálogo (para el override).
export function centrosCostoDisponibles(catalogo: ConceptoCatalogo[]): string[] {
  return Array.from(new Set(catalogo.map(c => c.centro_costo_default))).sort();
}

// ── Regla automática del Punto 5: dado un concepto, devuelve la frase
//    que explica al usuario qué pasará con su egreso.
export function explicarImpacto(c: ConceptoCatalogo): string {
  if (c.tipo_financiero === 'costo')             return 'Afecta P&G como costo de venta';
  if (c.tipo_financiero === 'gasto')             return `Afecta P&G como ${c.grupo_pyg.toLowerCase()}`;
  if (c.tipo_financiero === 'activo')            return 'Va a Balance · impactará P&G por depreciación/amortización';
  if (c.tipo_financiero === 'pasivo')            return 'Va a Balance · reduce deuda, NO afecta P&G';
  if (c.tipo_financiero === 'anticipo')          return 'Va a Balance · impactará P&G cuando se reciba el servicio/producto';
  if (c.tipo_financiero === 'impuesto')          return 'Va a Balance fiscal · NO es gasto operativo';
  if (c.tipo_financiero === 'propina_por_pagar') return 'Va a Cuenta por pagar al equipo · NO afecta P&G';
  if (c.tipo_financiero === 'medio_pago')        return 'Pendiente reclasificar al concepto real';
  return '';
}
