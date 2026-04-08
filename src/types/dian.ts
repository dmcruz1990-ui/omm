// ============================================================
// NEXUM — DIAN Types
// Compartidos entre frontend (DIANModule.tsx) y Edge Functions
// src/types/dian.ts
// ============================================================

export interface DianConfig {
  id: string;
  restaurante_id: string;
  nit: string;
  nit_dv: string;
  razon_social: string;
  nombre_comercial: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  telefono: string;
  email_facturacion: string;
  regimen: 'RESPONSABLE_IVA' | 'NO_RESPONSABLE';
  tipo_persona: 'JURIDICA' | 'NATURAL';
  software_id: string;
  software_pin: string;
  set_pruebas_id?: string;
  certificado_path: string;
  certificado_password: string;
  prefijo_factura: string;
  consecutivo_desde: number;
  consecutivo_hasta: number;
  consecutivo_actual: number;
  resolucion_dian: string;
  fecha_resolucion: string;
  fecha_vence_resolucion: string;
  ambiente: 'PRUEBAS' | 'PRODUCCION';
  habilitado: boolean;
  created_at: string;
  updated_at: string;
}

export type EstadoFactura =
  | 'PENDIENTE'
  | 'PROCESANDO'
  | 'ENVIADA'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'ERROR_TECNICO';

export type TipoDocumento = 'FACTURA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';

export interface FacturaElectronica {
  id: string;
  restaurante_id: string;
  orden_id?: string;
  mesa_id?: number;
  tipo_documento: TipoDocumento;
  prefijo: string;
  numero: number;
  numero_completo: string;
  cufe?: string;
  qr_data?: string;
  cliente_tipo_id: 'CC' | 'NIT' | 'CE' | 'PAS' | 'NIT_EXTRANJERO';
  cliente_numero_id: string;
  cliente_nombre: string;
  cliente_email?: string;
  cliente_telefono?: string;
  cliente_direccion?: string;
  subtotal: number;
  descuento: number;
  base_iva: number;
  iva: number;
  total: number;
  items: FacturaItem[];
  estado: EstadoFactura;
  dian_response?: string;
  dian_errors?: DianError[];
  intentos: number;
  xml_sin_firma?: string;
  xml_firmado?: string;
  doc_referencia_cufe?: string;
  doc_referencia_numero?: string;
  created_at: string;
  updated_at: string;
  fecha_emision: string;
}

export interface FacturaItem {
  id: string;
  factura_id: string;
  descripcion: string;
  codigo_producto?: string;
  codigo_estandar?: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
  tarifa_iva: number;
  iva: number;
  total: number;
}

export interface DianError {
  codigo: string;
  mensaje: string;
  tipo: 'ERROR' | 'ADVERTENCIA';
}

export interface DianEvento {
  id: string;
  factura_id: string;
  restaurante_id: string;
  tipo: 'ENVIO' | 'RESPUESTA' | 'REINTENTO' | 'ERROR';
  descripcion: string;
  payload?: string;
  duracion_ms?: number;
  created_at: string;
}

export interface DianEmitirPayload {
  restaurante_id: string;
  tipo_documento: TipoDocumento;
  cliente: {
    tipo_id: FacturaElectronica['cliente_tipo_id'];
    numero_id: string;
    nombre: string;
    email?: string;
    direccion?: string;
  };
  items: Array<{
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    descuento?: number;
    tarifa_iva: 0 | 5 | 19;
    codigo_producto?: string;
  }>;
  descuento_global?: number;
  orden_id?: string;
  mesa_id?: number;
  doc_referencia_cufe?: string;
  doc_referencia_numero?: string;
}

export interface DianEmitirResponse {
  ok: boolean;
  factura_id?: string;
  numero_completo?: string;
  cufe?: string;
  qr_url?: string;
  estado: EstadoFactura;
  errores?: DianError[];
  mensaje?: string;
}

export interface DianStats {
  total_hoy: number;
  aprobadas_hoy: number;
  rechazadas_hoy: number;
  pendientes: number;
  total_mes: number;
  valor_facturado_mes: number;
  tasa_aprobacion: number;
  consecutivo_actual: number;
  consecutivo_hasta: number;
  dias_vence_resolucion: number;
}
