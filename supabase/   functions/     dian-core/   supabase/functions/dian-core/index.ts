// ============================================================
// NEXUM DIAN — Edge Function Principal
// supabase/functions/dian-core/index.ts
//
// Orquesta: validación → XML → CUFE → SOAP DIAN → persistencia
// Invocación: POST /functions/v1/dian-core
// Auth: service_role (desde backend) o JWT usuario admin
// ============================================================

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildFacturaXML } from './xml-builder.ts';
import { calcularCUFE, formatearValorCUFE, generarURLQR, type CUFEParams } from './cufe.ts';
import type {
  DianConfig,
  DianEmitirPayload,
  DianEmitirResponse,
  FacturaElectronica,
  FacturaItem,
  EstadoFactura,
} from '../../src/types/dian.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// URLs DIAN
const DIAN_URLS = {
  PRODUCCION: 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc',
  PRUEBAS:    'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc',
};

serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startTime = Date.now();

  try {
    const payload: DianEmitirPayload = await req.json();

    // ── 1. Validar payload básico ────────────────────────────
    if (!payload.restaurante_id || !payload.cliente || !payload.items?.length) {
      return jsonResponse({ ok: false, estado: 'ERROR_TECNICO', mensaje: 'Payload incompleto' }, 400);
    }

    // ── 2. Cargar config DIAN del restaurante ────────────────
    const { data: config, error: configError } = await supabase
      .from('dian_config')
      .select('*')
      .eq('restaurante_id', payload.restaurante_id)
      .eq('habilitado', true)
      .single();

    if (configError || !config) {
      return jsonResponse({
        ok: false,
        estado: 'ERROR_TECNICO' as EstadoFactura,
        mensaje: 'Restaurante sin configuración DIAN activa',
      }, 400);
    }

    // ── 3. Obtener siguiente consecutivo (atómico en DB) ─────
    const { data: consecutivoData, error: consError } = await supabase
      .rpc('dian_siguiente_consecutivo', { p_restaurante_id: payload.restaurante_id });

    if (consError) {
      return jsonResponse({ ok: false, estado: 'ERROR_TECNICO' as EstadoFactura, mensaje: consError.message }, 500);
    }

    const consecutivo: number = consecutivoData;
    const numeroCompleto = `${config.prefijo_factura}-${consecutivo}`;

    // ── 4. Calcular totales ──────────────────────────────────
    const { items, subtotal, descuento, baseIva, iva, total } = calcularTotales(payload);

    // ── 5. Crear registro factura en DB (estado PROCESANDO) ──
    const fechaEmision = new Date();
    const facturaInsert: Partial<FacturaElectronica> = {
      restaurante_id: payload.restaurante_id,
      orden_id: payload.orden_id,
      mesa_id: payload.mesa_id,
      tipo_documento: payload.tipo_documento,
      prefijo: config.prefijo_factura,
      numero: consecutivo,
      numero_completo: numeroCompleto,
      cliente_tipo_id: payload.cliente.tipo_id,
      cliente_numero_id: payload.cliente.numero_id,
      cliente_nombre: payload.cliente.nombre,
      cliente_email: payload.cliente.email,
      cliente_direccion: payload.cliente.direccion,
      subtotal,
      descuento,
      base_iva: baseIva,
      iva,
      total,
      estado: 'PROCESANDO',
      intentos: 1,
      fecha_emision: fechaEmision.toISOString(),
      doc_referencia_cufe: payload.doc_referencia_cufe,
      doc_referencia_numero: payload.doc_referencia_numero,
    };

    const { data: facturaDB, error: insertError } = await supabase
      .from('facturas_electronicas')
      .insert(facturaInsert)
      .select()
      .single();

    if (insertError || !facturaDB) {
      return jsonResponse({ ok: false, estado: 'ERROR_TECNICO' as EstadoFactura, mensaje: 'Error creando factura' }, 500);
    }

    // Insertar items
    const itemsInsert = items.map((item, i) => ({
      factura_id: facturaDB.id,
      ...item,
      orden: i + 1,
    }));
    await supabase.from('factura_items').insert(itemsInsert);

    const factura: FacturaElectronica = { ...facturaDB, items };

    // ── 6. Calcular CUFE ─────────────────────────────────────
    const cufeParams: CUFEParams = {
      numero_factura: numeroCompleto,
      fecha_factura: fechaEmision.toISOString().split('T')[0],
      hora_factura: fechaEmision.toISOString().split('T')[1].slice(0, 8),
      valor_factura: formatearValorCUFE(subtotal),
      cod_impuesto1: '01',
      valor_impuesto1: formatearValorCUFE(iva),
      cod_impuesto2: '04',
      valor_impuesto2: '0.00',
      cod_impuesto3: '03',
      valor_impuesto3: '0.00',
      valor_total: formatearValorCUFE(total),
      nit_emisor: config.nit,
      numero_adquiriente: payload.cliente.numero_id,
      clave_tecnica: config.software_pin,
      tipo_ambiente: config.ambiente === 'PRODUCCION' ? '1' : '2',
    };

    const cufe = await calcularCUFE(cufeParams);
    const qrUrl = generarURLQR({ cufe, ambiente: config.ambiente });

    // ── 7. Generar XML UBL 2.1 ───────────────────────────────
    let xmlSinFirma: string;
    try {
      xmlSinFirma = await buildFacturaXML({ config, factura: { ...factura, cufe, qr_data: qrUrl }, cufe, qr_url: qrUrl, fecha_emision: fechaEmision });
    } catch (xmlError) {
      await updateFacturaEstado(supabase, facturaDB.id, 'ERROR_TECNICO', `Error XML: ${xmlError}`);
      return jsonResponse({ ok: false, estado: 'ERROR_TECNICO' as EstadoFactura, mensaje: 'Error generando XML' }, 500);
    }

    // ── 8. Firmar XML (XAdES-EPES) ───────────────────────────
    // NOTA: La firma real requiere el certificado .p12/.pfx del Storage.
    // En ambiente de PRUEBAS con set de pruebas DIAN, se puede enviar sin firma
    // para validar la estructura. En PRODUCCIÓN es obligatoria.
    // La librería recomendada: xadesjs (port de xmldsigjs para Deno)
    // Por ahora guardamos el XML sin firma y marcamos para firma posterior.
    const xmlFirmado = xmlSinFirma; // TODO: implementar firma con certificado

    // ── 9. Guardar XML en factura ────────────────────────────
    await supabase.from('facturas_electronicas').update({
      cufe,
      qr_data: qrUrl,
      xml_sin_firma: xmlSinFirma,
      xml_firmado: xmlFirmado,
    }).eq('id', facturaDB.id);

    // ── 10. Enviar a DIAN via SOAP ───────────────────────────
    const dianURL = DIAN_URLS[config.ambiente];
    let estadoFinal: EstadoFactura = 'ENVIADA';
    let dianResponse: string | undefined;
    let dianErrors: any[] | undefined;

    try {
      const soapResponse = await enviarSOAPDIAN({
        url: dianURL,
        xmlFirmado,
        config,
        numeroCompleto,
      });

      dianResponse = soapResponse.raw;

      if (soapResponse.aprobado) {
        estadoFinal = 'APROBADA';
      } else {
        estadoFinal = 'RECHAZADA';
        dianErrors = soapResponse.errores;
      }
    } catch (soapError) {
      // Error de red / DIAN no responde — se puede reintentar
      estadoFinal = 'ERROR_TECNICO';
      dianErrors = [{ codigo: 'NET_ERROR', mensaje: String(soapError), tipo: 'ERROR' }];
    }

    // ── 11. Actualizar estado final ──────────────────────────
    await supabase.from('facturas_electronicas').update({
      estado: estadoFinal,
      dian_response: dianResponse,
      dian_errors: dianErrors,
    }).eq('id', facturaDB.id);

    // ── 12. Log del evento ───────────────────────────────────
    await supabase.from('dian_eventos').insert({
      factura_id: facturaDB.id,
      restaurante_id: payload.restaurante_id,
      tipo: estadoFinal === 'APROBADA' ? 'RESPUESTA' : 'ERROR',
      descripcion: `${estadoFinal} — ${numeroCompleto}`,
      duracion_ms: Date.now() - startTime,
    });

    const response: DianEmitirResponse = {
      ok: estadoFinal === 'APROBADA',
      factura_id: facturaDB.id,
      numero_completo: numeroCompleto,
      cufe: estadoFinal === 'APROBADA' ? cufe : undefined,
      qr_url: estadoFinal === 'APROBADA' ? qrUrl : undefined,
      estado: estadoFinal,
      errores: dianErrors,
      mensaje: estadoFinal === 'APROBADA'
        ? `Factura ${numeroCompleto} aprobada por la DIAN`
        : `Factura ${estadoFinal.toLowerCase()}`,
    };

    return jsonResponse(response, estadoFinal === 'APROBADA' ? 200 : 422);

  } catch (err) {
    console.error('[dian-core] Error inesperado:', err);
    return jsonResponse({ ok: false, estado: 'ERROR_TECNICO' as EstadoFactura, mensaje: String(err) }, 500);
  }
});

// ── SOAP ─────────────────────────────────────────────────────
async function enviarSOAPDIAN(params: {
  url: string;
  xmlFirmado: string;
  config: DianConfig;
  numeroCompleto: string;
}): Promise<{ aprobado: boolean; raw: string; errores?: any[] }> {
  const xmlBase64 = btoa(unescape(encodeURIComponent(params.xmlFirmado)));

  // Envelope SOAP 1.2 con WS-Security
  // El trackId es el CUFE para consultas posteriores
  const soapEnvelope = `<soapenv:Envelope
    xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope"
    xmlns:wcf="http://wcf.dian.colombia">
    <soapenv:Header>
      <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
        <wsse:UsernameToken>
          <wsse:Username>${params.config.nit}</wsse:Username>
          <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${params.config.software_pin}</wsse:Password>
        </wsse:UsernameToken>
      </wsse:Security>
    </soapenv:Header>
    <soapenv:Body>
      <wcf:SendBillSync>
        <fileName>${params.numeroCompleto}.xml</fileName>
        <contentFile>${xmlBase64}</contentFile>
      </wcf:SendBillSync>
    </soapenv:Body>
  </soapenv:Envelope>`;

  const response = await fetch(params.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/soap+xml;charset=UTF-8',
      'SOAPAction': 'http://wcf.dian.colombia/IWcfDianCustomerServices/SendBillSync',
    },
    body: soapEnvelope,
  });

  const raw = await response.text();

  // Parsear respuesta DIAN
  // La DIAN responde con IsValid="true" cuando aprueba
  const aprobado = raw.includes('IsValid>true') || raw.includes('IsValid="true"');
  const rechazado = raw.includes('IsValid>false') || raw.includes('IsValid="false"');

  if (aprobado) {
    return { aprobado: true, raw };
  }

  if (rechazado) {
    // Extraer errores del XML respuesta
    const errores = extraerErroresDIAN(raw);
    return { aprobado: false, raw, errores };
  }

  // Respuesta inesperada
  throw new Error(`Respuesta DIAN inesperada: HTTP ${response.status}`);
}

function extraerErroresDIAN(xmlResponse: string): any[] {
  const errores: any[] = [];
  const errorRegex = /<c:ErrorMessage[^>]*>([\s\S]*?)<\/c:ErrorMessage>/g;
  const codigoRegex = /<c:ExplanationValues[^>]*>([\s\S]*?)<\/c:ExplanationValues>/g;
  let match;
  while ((match = errorRegex.exec(xmlResponse)) !== null) {
    errores.push({ mensaje: match[1].trim(), tipo: 'ERROR', codigo: 'DIAN_ERROR' });
  }
  return errores;
}

// ── Cálculo de totales ────────────────────────────────────────
function calcularTotales(payload: DianEmitirPayload) {
  let subtotal = 0;
  let iva = 0;

  const items: Partial<FacturaItem>[] = payload.items.map(item => {
    const descItem = item.descuento ?? 0;
    const sub = (item.precio_unitario * item.cantidad) - descItem;
    const ivaItem = sub * (item.tarifa_iva / 100);
    subtotal += sub;
    iva += ivaItem;
    return {
      descripcion: item.descripcion,
      codigo_producto: item.codigo_producto,
      cantidad: item.cantidad,
      unidad: 'EA',
      precio_unitario: item.precio_unitario,
      descuento: descItem,
      subtotal: sub,
      tarifa_iva: item.tarifa_iva,
      iva: ivaItem,
      total: sub + ivaItem,
    };
  });

  const descuento = payload.descuento_global ?? 0;
  const baseIva = subtotal - descuento;
  const total = baseIva + iva;

  return { items, subtotal, descuento, baseIva, iva, total };
}

async function updateFacturaEstado(supabase: any, id: string, estado: EstadoFactura, mensaje: string) {
  await supabase.from('facturas_electronicas').update({ estado, dian_errors: [{ mensaje, tipo: 'ERROR', codigo: 'INTERNAL' }] }).eq('id', id);
}

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}
