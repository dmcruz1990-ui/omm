// ============================================================
// NEXUM DIAN — CUFE / CUDE Calculator
// supabase/functions/dian-core/cufe.ts
//
// Algoritmo oficial DIAN: SHA-384 sobre concatenación de campos
// Ref: Anexo Técnico 1.9 DIAN — Sección 7.3
// ============================================================

/**
 * Calcula el CUFE (Código Único de Factura Electrónica)
 * Formato concatenación:
 * NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 + CodImp2 + ValImp2 +
 * CodImp3 + ValImp3 + ValTot + NitOFE + NumAdq + ClTec + TipoAmb
 */
export async function calcularCUFE(params: CUFEParams): Promise<string> {
  const cadena = buildCadenaCUFE(params);
  const hash = await sha384(cadena);
  return hash;
}

export interface CUFEParams {
  numero_factura: string;       // Ej: "FE-1234"
  fecha_factura: string;        // YYYY-MM-DD
  hora_factura: string;         // HH:MM:SS
  valor_factura: string;        // 2 decimales sin separadores: "150000.00"
  cod_impuesto1: string;        // "01" para IVA
  valor_impuesto1: string;      // Valor IVA: "28500.00"
  cod_impuesto2: string;        // "04" para INC (impuesto consumo) — "0.00" si no aplica
  valor_impuesto2: string;
  cod_impuesto3: string;        // "03" para ICA — "0.00" si no aplica
  valor_impuesto3: string;
  valor_total: string;          // Total factura: "178500.00"
  nit_emisor: string;           // NIT sin puntos ni DV: "900123456"
  numero_adquiriente: string;   // CC/NIT del cliente
  clave_tecnica: string;        // Software PIN de la DIAN
  tipo_ambiente: '1' | '2';     // '1' = Producción, '2' = Pruebas
}

function buildCadenaCUFE(p: CUFEParams): string {
  return (
    p.numero_factura +
    p.fecha_factura +
    p.hora_factura +
    p.valor_factura +
    p.cod_impuesto1 +
    p.valor_impuesto1 +
    p.cod_impuesto2 +
    p.valor_impuesto2 +
    p.cod_impuesto3 +
    p.valor_impuesto3 +
    p.valor_total +
    p.nit_emisor +
    p.numero_adquiriente +
    p.clave_tecnica +
    p.tipo_ambiente
  );
}

async function sha384(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-384', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Formatea un número para la cadena CUFE
 * Ej: 150000 → "150000.00"
 */
export function formatearValorCUFE(valor: number): string {
  return valor.toFixed(2);
}

/**
 * Genera el URL del QR de validación DIAN
 */
export function generarURLQR(params: {
  cufe: string;
  ambiente: 'PRUEBAS' | 'PRODUCCION';
}): string {
  const base = params.ambiente === 'PRODUCCION'
    ? 'https://catalogo-vpfe.dian.gov.co/document/searchqr'
    : 'https://catalogo-vpfe-hab.dian.gov.co/document/searchqr';
  return `${base}?documentkey=${params.cufe}`;
}// ============================================================
// NEXUM DIAN — CUFE / CUDE Calculator
// supabase/functions/dian-core/cufe.ts
//
// Algoritmo oficial DIAN: SHA-384 sobre concatenación de campos
// Ref: Anexo Técnico 1.9 DIAN — Sección 7.3
// ============================================================

/**
 * Calcula el CUFE (Código Único de Factura Electrónica)
 * Formato concatenación:
 * NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 + CodImp2 + ValImp2 +
 * CodImp3 + ValImp3 + ValTot + NitOFE + NumAdq + ClTec + TipoAmb
 */
export async function calcularCUFE(params: CUFEParams): Promise<string> {
  const cadena = buildCadenaCUFE(params);
  const hash = await sha384(cadena);
  return hash;
}

export interface CUFEParams {
  numero_factura: string;       // Ej: "FE-1234"
  fecha_factura: string;        // YYYY-MM-DD
  hora_factura: string;         // HH:MM:SS
  valor_factura: string;        // 2 decimales sin separadores: "150000.00"
  cod_impuesto1: string;        // "01" para IVA
  valor_impuesto1: string;      // Valor IVA: "28500.00"
  cod_impuesto2: string;        // "04" para INC (impuesto consumo) — "0.00" si no aplica
  valor_impuesto2: string;
  cod_impuesto3: string;        // "03" para ICA — "0.00" si no aplica
  valor_impuesto3: string;
  valor_total: string;          // Total factura: "178500.00"
  nit_emisor: string;           // NIT sin puntos ni DV: "900123456"
  numero_adquiriente: string;   // CC/NIT del cliente
  clave_tecnica: string;        // Software PIN de la DIAN
  tipo_ambiente: '1' | '2';     // '1' = Producción, '2' = Pruebas
}

function buildCadenaCUFE(p: CUFEParams): string {
  return (
    p.numero_factura +
    p.fecha_factura +
    p.hora_factura +
    p.valor_factura +
    p.cod_impuesto1 +
    p.valor_impuesto1 +
    p.cod_impuesto2 +
    p.valor_impuesto2 +
    p.cod_impuesto3 +
    p.valor_impuesto3 +
    p.valor_total +
    p.nit_emisor +
    p.numero_adquiriente +
    p.clave_tecnica +
    p.tipo_ambiente
  );
}

async function sha384(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-384', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Formatea un número para la cadena CUFE
 * Ej: 150000 → "150000.00"
 */
export function formatearValorCUFE(valor: number): string {
  return valor.toFixed(2);
}

/**
 * Genera el URL del QR de validación DIAN
 */
export function generarURLQR(params: {
  cufe: string;
  ambiente: 'PRUEBAS' | 'PRODUCCION';
}): string {
  const base = params.ambiente === 'PRODUCCION'
    ? 'https://catalogo-vpfe.dian.gov.co/document/searchqr'
    : 'https://catalogo-vpfe-hab.dian.gov.co/document/searchqr';
  return `${base}?documentkey=${params.cufe}`;
}
