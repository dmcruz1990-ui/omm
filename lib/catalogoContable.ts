// ═══════════════════════════════════════════════════════════════════════
// Catálogo contable controlado para Egresos.
//
// Cada concepto operativo está pre-mapeado a:
//   - cuenta_contable: nombre de la cuenta NIIF (lo que verá el contador)
//   - centro_costo:    Cocina / Bar / Sala / Administración / Marketing /
//                      Eventos / Local / Operativo / Comercial
//   - impacto_pg:      cómo afecta al estado de resultados
//   - requiereNota:    obliga a escribir nota antes de guardar
//   - requiereAprobacion: queda en estado "pendiente" hasta que un gerente
//                         lo apruebe (típicamente conceptos "Otro").
//
// El usuario solo elige categoría operativa + concepto. El sistema
// completa el resto automáticamente. El centro de costo se puede
// sobreescribir si el egreso fue para un centro distinto al default
// (ej: compra de cocina para un evento → cambia a "Eventos").
// ═══════════════════════════════════════════════════════════════════════

export type ImpactoPG =
  | 'costo_ventas'
  | 'gasto_operativo'
  | 'gasto_administrativo'
  | 'gasto_comercial'
  | 'gasto_financiero'
  | 'cuenta_por_pagar'
  | 'anticipo'
  | 'activo'
  | 'ajuste'
  | 'gasto_no_recurrente'
  | 'pendiente';

export const IMPACTO_PG_LABELS: Record<ImpactoPG, { label: string; color: string }> = {
  costo_ventas:         { label: 'Costo de ventas',        color: '#FF5252' },
  gasto_operativo:      { label: 'Gasto operativo',        color: '#FFB547' },
  gasto_administrativo: { label: 'Gasto administrativo',   color: '#448AFF' },
  gasto_comercial:      { label: 'Gasto comercial',        color: '#B388FF' },
  gasto_financiero:     { label: 'Gasto financiero',       color: '#FF2D78' },
  cuenta_por_pagar:     { label: 'Cuenta por pagar',       color: '#00E676' },
  anticipo:             { label: 'Anticipo',               color: '#22d3ee' },
  activo:               { label: 'Activo',                 color: '#00E676' },
  ajuste:               { label: 'Ajuste contable',        color: '#A0A0B8' },
  gasto_no_recurrente:  { label: 'Gasto no recurrente',    color: '#B388FF' },
  pendiente:            { label: 'Pendiente clasificar',   color: '#FFB547' },
};

export const CENTROS_COSTO = [
  'Cocina', 'Bar', 'Sala', 'Administración', 'Marketing',
  'Comercial', 'Eventos', 'Local', 'Operativo',
] as const;
export type CentroCosto = typeof CENTROS_COSTO[number];

export interface ConceptoContable {
  id: string;
  label: string;
  cuenta: string;
  centroCosto: CentroCosto;
  impacto: ImpactoPG;
  requiereNota?: boolean;
  requiereAprobacion?: boolean;
}

export const CATALOGO_CONTABLE: Record<string, ConceptoContable[]> = {
  // ── PROPINAS — NO afecta P&G como gasto, es cuenta por pagar al personal ──
  propina_efectivo: [
    { id: 'prop_meseros',   label: 'Liquidación propinas meseros', cuenta: 'Propinas por pagar — Sala',     centroCosto: 'Sala',           impacto: 'cuenta_por_pagar' },
    { id: 'prop_cocina',    label: 'Liquidación propinas cocina',  cuenta: 'Propinas por pagar — Cocina',   centroCosto: 'Cocina',         impacto: 'cuenta_por_pagar' },
    { id: 'prop_bar',       label: 'Liquidación propinas bar',     cuenta: 'Propinas por pagar — Bar',      centroCosto: 'Bar',            impacto: 'cuenta_por_pagar' },
    { id: 'prop_steward',   label: 'Liquidación propinas steward', cuenta: 'Propinas por pagar — Steward',  centroCosto: 'Cocina',         impacto: 'cuenta_por_pagar' },
    { id: 'prop_ajuste',    label: 'Ajuste de propinas',           cuenta: 'Propinas por pagar — Ajustes',  centroCosto: 'Administración', impacto: 'ajuste',          requiereNota: true },
    { id: 'prop_pendiente', label: 'Propina pendiente por distribuir', cuenta: 'Propinas por pagar — Pendientes', centroCosto: 'Administración', impacto: 'cuenta_por_pagar' },
  ],

  // ── COMPRA MENOR — afecta P&G según tipo: insumos = COGS, otros = OPEX ──
  compra_menor: [
    { id: 'cm_cocina',    label: 'Insumos cocina',          cuenta: 'Costo de alimentos',            centroCosto: 'Cocina',         impacto: 'costo_ventas' },
    { id: 'cm_bar',       label: 'Insumos bar',             cuenta: 'Costo de bebidas',              centroCosto: 'Bar',            impacto: 'costo_ventas' },
    { id: 'cm_aseo',      label: 'Aseo',                    cuenta: 'Gastos de aseo y cafetería',    centroCosto: 'Operativo',      impacto: 'gasto_operativo' },
    { id: 'cm_papeleria', label: 'Papelería',               cuenta: 'Útiles, papelería y fotocopias',centroCosto: 'Administración', impacto: 'gasto_administrativo' },
    { id: 'cm_decor',     label: 'Decoración menor',        cuenta: 'Decoración y ambientación',     centroCosto: 'Sala',           impacto: 'gasto_operativo' },
    { id: 'cm_menaje',    label: 'Menaje menor',            cuenta: 'Menaje y dotación',             centroCosto: 'Sala',           impacto: 'gasto_operativo' },
    { id: 'cm_empaques',  label: 'Empaques',                cuenta: 'Empaques y desechables',        centroCosto: 'Cocina',         impacto: 'gasto_operativo' },
    { id: 'cm_mercado',   label: 'Mercado urgente',         cuenta: 'Costo de alimentos',            centroCosto: 'Cocina',         impacto: 'costo_ventas' },
    { id: 'cm_hielo',     label: 'Hielo',                   cuenta: 'Costo de bebidas',              centroCosto: 'Bar',            impacto: 'costo_ventas' },
    { id: 'cm_flores',    label: 'Flores',                  cuenta: 'Decoración y ambientación',     centroCosto: 'Sala',           impacto: 'gasto_operativo' },
    { id: 'cm_otro',      label: 'Otro insumo operativo',   cuenta: 'Gastos operativos varios',      centroCosto: 'Operativo',      impacto: 'gasto_operativo', requiereNota: true },
  ],

  // ── MANTENIMIENTO — todo a P&G como gasto operativo (subcategoría locativa) ──
  mantenimiento: [
    { id: 'mt_locativa',     label: 'Reparación locativa',     cuenta: 'Mantenimiento locativo',        centroCosto: 'Local',  impacto: 'gasto_operativo' },
    { id: 'mt_electricidad', label: 'Electricidad',            cuenta: 'Mantenimiento eléctrico',       centroCosto: 'Local',  impacto: 'gasto_operativo' },
    { id: 'mt_plomeria',     label: 'Plomería',                cuenta: 'Mantenimiento plomería',        centroCosto: 'Local',  impacto: 'gasto_operativo' },
    { id: 'mt_equipos',      label: 'Equipos de cocina',       cuenta: 'Mantenimiento equipos cocina',  centroCosto: 'Cocina', impacto: 'gasto_operativo' },
    { id: 'mt_refrig',       label: 'Refrigeración',           cuenta: 'Mantenimiento refrigeración',   centroCosto: 'Cocina', impacto: 'gasto_operativo' },
    { id: 'mt_aire',         label: 'Aires acondicionados',    cuenta: 'Mantenimiento AC y ventilación',centroCosto: 'Local',  impacto: 'gasto_operativo' },
    { id: 'mt_av',           label: 'Sonido / luces',          cuenta: 'Mantenimiento equipos AV',      centroCosto: 'Sala',   impacto: 'gasto_operativo' },
    { id: 'mt_preventivo',   label: 'Mantenimiento preventivo',cuenta: 'Mantenimiento preventivo',     centroCosto: 'Local',  impacto: 'gasto_operativo' },
    { id: 'mt_correctivo',   label: 'Mantenimiento correctivo',cuenta: 'Mantenimiento correctivo',     centroCosto: 'Local',  impacto: 'gasto_operativo' },
    { id: 'mt_repuestos',    label: 'Repuestos',               cuenta: 'Repuestos y materiales',        centroCosto: 'Local',  impacto: 'gasto_operativo' },
  ],

  // ── TRANSPORTE — separado para detectar fugas ──
  transporte: [
    { id: 'tr_dom_int',    label: 'Domicilio interno',         cuenta: 'Transporte operativo',         centroCosto: 'Operativo',      impacto: 'gasto_operativo' },
    { id: 'tr_mensajeria', label: 'Mensajería',                cuenta: 'Mensajería',                   centroCosto: 'Administración', impacto: 'gasto_administrativo' },
    { id: 'tr_personal',   label: 'Transporte de personal',    cuenta: 'Transporte de personal',       centroCosto: 'Administración', impacto: 'gasto_administrativo' },
    { id: 'tr_insumos',    label: 'Transporte de insumos',     cuenta: 'Transporte de mercancía',      centroCosto: 'Cocina',         impacto: 'costo_ventas' },
    { id: 'tr_eventos',    label: 'Transporte eventos',        cuenta: 'Eventos especiales',           centroCosto: 'Eventos',        impacto: 'gasto_comercial' },
    { id: 'tr_plataforma', label: 'Plataforma de mensajería',  cuenta: 'Mensajería',                   centroCosto: 'Administración', impacto: 'gasto_administrativo' },
    { id: 'tr_taxi',       label: 'Taxi / Uber operativo',     cuenta: 'Transporte operativo',         centroCosto: 'Operativo',      impacto: 'gasto_operativo' },
  ],

  // ── OTRO — todos requieren nota; "Otro requiere aprobación" entra como pendiente ──
  otro: [
    { id: 'ot_admin',         label: 'Gasto administrativo',    cuenta: 'Gastos administrativos varios', centroCosto: 'Administración', impacto: 'gasto_administrativo', requiereNota: true },
    { id: 'ot_comercial',     label: 'Gasto comercial',         cuenta: 'Gastos comerciales',            centroCosto: 'Comercial',      impacto: 'gasto_comercial',     requiereNota: true },
    { id: 'ot_financiero',    label: 'Gasto financiero',        cuenta: 'Gastos financieros',            centroCosto: 'Administración', impacto: 'gasto_financiero',   requiereNota: true },
    { id: 'ot_legal',         label: 'Gasto legal',             cuenta: 'Honorarios legales',            centroCosto: 'Administración', impacto: 'gasto_administrativo', requiereNota: true },
    { id: 'ot_marketing',     label: 'Gasto de marketing',      cuenta: 'Publicidad y marketing',        centroCosto: 'Marketing',      impacto: 'gasto_comercial',     requiereNota: true },
    { id: 'ot_ajuste',        label: 'Ajuste contable',         cuenta: 'Ajustes contables',             centroCosto: 'Administración', impacto: 'ajuste',              requiereNota: true },
    { id: 'ot_no_recurrente', label: 'Gasto no recurrente',     cuenta: 'Gastos no recurrentes',         centroCosto: 'Administración', impacto: 'gasto_no_recurrente', requiereNota: true },
    { id: 'ot_aprobacion',    label: 'Otro, requiere aprobación', cuenta: 'Pendiente de clasificación', centroCosto: 'Administración', impacto: 'pendiente',           requiereNota: true, requiereAprobacion: true },
  ],
};

export function buscarConcepto(categoriaId: string, conceptoId: string): ConceptoContable | undefined {
  return (CATALOGO_CONTABLE[categoriaId] || []).find(c => c.id === conceptoId);
}
