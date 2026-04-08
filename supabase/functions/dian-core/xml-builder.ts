// ============================================================
// NEXUM DIAN — XML UBL 2.1 Builder
// supabase/functions/dian-core/xml-builder.ts
//
// Genera el XML de Factura Electrónica según Anexo Técnico DIAN 1.9
// UBL 2.1 — namespace oficial DIAN Colombia
// ============================================================

import type { DianConfig, FacturaElectronica, FacturaItem } from '../../src/types/dian.ts';

export interface BuildXMLParams {
  config: DianConfig;
  factura: FacturaElectronica;
  cufe: string;
  qr_url: string;
  fecha_emision: Date;
}

export function buildFacturaXML(p: BuildXMLParams): string {
  const { config, factura, cufe, qr_url, fecha_emision } = p;
  const fechaStr = toISODate(fecha_emision);
  const horaStr = toISOTime(fecha_emision);
  const esNota = factura.tipo_documento !== 'FACTURA';

  const rootTag = factura.tipo_documento === 'FACTURA'
    ? 'Invoice'
    : factura.tipo_documento === 'NOTA_CREDITO'
      ? 'CreditNote'
      : 'DebitNote';

  const invoiceTypeCode = factura.tipo_documento === 'FACTURA' ? '01' : undefined;

  return `<?xml version="1.0" encoding="UTF-8"?>
<${rootTag} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${rootTag}-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1"
  xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"
  xmlns:xades141="http://uri.etsi.org/01903/v1.4.1#"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#">

  <!-- ── Extensiones DIAN (firma digital va aquí) ── -->
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent>
        <sts:DianExtensions>
          <sts:InvoiceControl>
            <sts:InvoiceAuthorization>${config.resolucion_dian}</sts:InvoiceAuthorization>
            <sts:AuthorizationPeriod>
              <cbc:StartDate>${config.fecha_resolucion}</cbc:StartDate>
              <cbc:EndDate>${config.fecha_vence_resolucion}</cbc:EndDate>
            </sts:AuthorizationPeriod>
            <sts:AuthorizedInvoices>
              <sts:Prefix>${config.prefijo_factura}</sts:Prefix>
              <sts:From>${config.consecutivo_desde}</sts:From>
              <sts:To>${config.consecutivo_hasta}</sts:To>
            </sts:AuthorizedInvoices>
          </sts:InvoiceControl>
          <sts:InvoiceSource>
            <cbc:IdentificationCode listAgencyID="6" listAgencyName="United Nations Economic Commission for Europe" listSchemeURI="urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1">CO</cbc:IdentificationCode>
          </sts:InvoiceSource>
          <sts:SoftwareProvider>
            <sts:ProviderID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)">${config.nit}</sts:ProviderID>
            <sts:SoftwareID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)">${config.software_id}</sts:SoftwareID>
          </sts:SoftwareProvider>
          <sts:SoftwareSecurityCode schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)">${await buildSoftwareSecurityCode(config)}</sts:SoftwareSecurityCode>
          <sts:AuthorizationProvider>
            <sts:AuthorizationProviderID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="4" schemeName="31">800197268</sts:AuthorizationProviderID>
          </sts:AuthorizationProvider>
          <sts:QRCode>${qr_url}</sts:QRCode>
        </sts:DianExtensions>
      </ext:ExtensionContent>
    </ext:UBLExtension>
    <!-- Nodo reservado para firma XAdES-EPES — se inyecta después de firmar -->
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>

  <!-- ── Cabecera ── -->
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>10</cbc:CustomizationID>
  <cbc:ProfileID>DIAN 2.1</cbc:ProfileID>
  <cbc:ProfileExecutionID>${config.ambiente === 'PRODUCCION' ? '1' : '2'}</cbc:ProfileExecutionID>
  <cbc:ID>${factura.numero_completo}</cbc:ID>
  <cbc:UUID schemeID="${config.ambiente === 'PRODUCCION' ? '1' : '2'}" schemeName="CUFE-SHA384">${cufe}</cbc:UUID>
  <cbc:IssueDate>${fechaStr}</cbc:IssueDate>
  <cbc:IssueTime>${horaStr}</cbc:IssueTime>
  ${invoiceTypeCode ? `<cbc:InvoiceTypeCode listAgencyID="195" listAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" listSchemeURI="http://www.dian.gov.co/contratos/facturaelectronica/v1/InvoiceType">${invoiceTypeCode}</cbc:InvoiceTypeCode>` : ''}
  <cbc:Note>${factura.numero_completo}</cbc:Note>
  <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${factura.items.length}</cbc:LineCountNumeric>

  ${esNota && factura.doc_referencia_cufe ? buildBillingReference(factura) : ''}

  <!-- ── Período de facturación ── -->
  <cac:InvoicePeriod>
    <cbc:StartDate>${fechaStr}</cbc:StartDate>
    <cbc:EndDate>${fechaStr}</cbc:EndDate>
  </cac:InvoicePeriod>

  <!-- ── Emisor ── -->
  ${buildEmisor(config)}

  <!-- ── Receptor / Adquiriente ── -->
  ${buildReceptor(factura)}

  <!-- ── Método de pago ── -->
  <cac:PaymentMeans>
    <cbc:ID>1</cbc:ID>
    <cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>
    <cbc:PaymentDueDate>${fechaStr}</cbc:PaymentDueDate>
  </cac:PaymentMeans>

  <!-- ── Impuestos totales ── -->
  ${buildImpuestosTotales(factura)}

  <!-- ── Totales monetarios ── -->
  ${buildTotalesMonetarios(factura)}

  <!-- ── Líneas de factura ── -->
  ${factura.items.map((item, i) => buildLineaFactura(item, i + 1)).join('\n')}

</${rootTag}>`;
}

// ── Helpers ─────────────────────────────────────────────────

function buildEmisor(config: DianConfig): string {
  return `<cac:AccountingSupplierParty>
    <cbc:AdditionalAccountID>${config.tipo_persona === 'JURIDICA' ? '1' : '2'}</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${escXML(config.nombre_comercial || config.razon_social)}</cbc:Name>
      </cac:PartyName>
      <cac:PhysicalLocation>
        <cac:Address>
          <cbc:CityName>${escXML(config.ciudad)}</cbc:CityName>
          <cbc:CountrySubentity>${escXML(config.departamento)}</cbc:CountrySubentity>
          <cac:Country>
            <cbc:IdentificationCode>CO</cbc:IdentificationCode>
            <cbc:Name languageID="es">Colombia</cbc:Name>
          </cac:Country>
        </cac:Address>
      </cac:PhysicalLocation>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>${escXML(config.razon_social)}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN" schemeID="${config.nit_dv}" schemeName="31">${config.nit}</cbc:CompanyID>
        <cbc:TaxLevelCode listName="48">${config.regimen === 'RESPONSABLE_IVA' ? 'O-13' : 'O-49'}</cbc:TaxLevelCode>
        <cac:TaxScheme>
          <cbc:ID>01</cbc:ID>
          <cbc:Name>IVA</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escXML(config.razon_social)}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN" schemeID="${config.nit_dv}" schemeName="31">${config.nit}</cbc:CompanyID>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:ElectronicMail>${config.email_facturacion}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>`;
}

function buildReceptor(f: FacturaElectronica): string {
  // schemeID según tipo de documento de identidad DIAN
  const schemeMap: Record<string, string> = {
    CC: '13', NIT: '31', CE: '22', PAS: '41', NIT_EXTRANJERO: '50'
  };
  const schemeID = schemeMap[f.cliente_tipo_id] || '13';

  return `<cac:AccountingCustomerParty>
    <cbc:AdditionalAccountID>1</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeAgencyID="195" schemeAgencyName="CO, DIAN" schemeID="${schemeID}">${f.cliente_numero_id}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escXML(f.cliente_nombre)}</cbc:Name>
      </cac:PartyName>
      <cac:PhysicalLocation>
        <cac:Address>
          <cbc:CityName>Bogotá D.C.</cbc:CityName>
          <cac:Country>
            <cbc:IdentificationCode>CO</cbc:IdentificationCode>
          </cac:Country>
        </cac:Address>
      </cac:PhysicalLocation>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>${escXML(f.cliente_nombre)}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN" schemeID="${schemeID}">${f.cliente_numero_id}</cbc:CompanyID>
        <cbc:TaxLevelCode listName="48">R-99-PN</cbc:TaxLevelCode>
        <cac:TaxScheme>
          <cbc:ID>ZZ</cbc:ID>
          <cbc:Name>No aplica</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escXML(f.cliente_nombre)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      ${f.cliente_email ? `<cac:Contact><cbc:ElectronicMail>${f.cliente_email}</cbc:ElectronicMail></cac:Contact>` : ''}
    </cac:Party>
  </cac:AccountingCustomerParty>`;
}

function buildImpuestosTotales(f: FacturaElectronica): string {
  if (f.iva === 0) return '';
  return `<cac:TaxTotal>
    <cbc:TaxAmount currencyID="COP">${f.iva.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="COP">${f.base_iva.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="COP">${f.iva.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>19.00</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>01</cbc:ID>
          <cbc:Name>IVA</cbc:Name>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>`;
}

function buildTotalesMonetarios(f: FacturaElectronica): string {
  return `<cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="COP">${f.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="COP">${f.base_iva.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="COP">${f.total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="COP">${f.descuento.toFixed(2)}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="COP">${f.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>`;
}

function buildLineaFactura(item: FacturaItem, lineNum: number): string {
  return `<cac:InvoiceLine>
    <cbc:ID>${lineNum}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${item.unidad}">${item.cantidad.toFixed(3)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="COP">${item.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${escXML(item.descripcion)}</cbc:Description>
      ${item.codigo_producto ? `<cac:SellersItemIdentification><cbc:ID>${item.codigo_producto}</cbc:ID></cac:SellersItemIdentification>` : ''}
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="COP">${item.precio_unitario.toFixed(2)}</cbc:PriceAmount>
      <cbc:BaseQuantity unitCode="${item.unidad}">1.000</cbc:BaseQuantity>
    </cac:Price>
    ${item.iva > 0 ? `<cac:TaxTotal>
      <cbc:TaxAmount currencyID="COP">${item.iva.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="COP">${item.subtotal.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="COP">${item.iva.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>${item.tarifa_iva.toFixed(2)}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>` : ''}
  </cac:InvoiceLine>`;
}

function buildBillingReference(f: FacturaElectronica): string {
  return `<cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${f.doc_referencia_numero}</cbc:ID>
      <cbc:UUID>${f.doc_referencia_cufe}</cbc:UUID>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`;
}

async function buildSoftwareSecurityCode(config: DianConfig): Promise<string> {
  // SHA-384 de: SoftwareID + Pin + NumeroFactura
  // Se calcula en el contexto de buildFacturaXML — aquí como placeholder
  const raw = config.software_id + config.software_pin;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hash = await crypto.subtle.digest('SHA-384', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Escapa caracteres especiales XML
function escXML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function toISOTime(d: Date): string {
  return d.toISOString().split('T')[1].replace('Z', '-05:00'); // Colombia UTC-5
}
