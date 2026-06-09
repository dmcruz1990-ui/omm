-- ============================================================================
-- NEXUM · Semilla demo del núcleo contable
-- Carga datos de demostración en los subledgers y el libro diario para que el
-- módulo muestre información real desde Supabase. Idempotente: solo siembra si
-- las tablas están vacías.
-- ============================================================================

-- ─── Cartera (CxC) ──────────────────────────────────────────────────────────
insert into public.cont_ar_factura (numero,cliente,nit,fecha,vencimiento,base,iva,total,saldo,estado)
select * from (values
  ('FE-1051','Eventos Corporativos SAS','900123456-1','2026-05-02'::date,'2026-06-01'::date,8400000,1596000,9996000,9996000,'abierta'),
  ('FE-1064','Hotel Andino','860456789-2','2026-05-15','2026-06-14',3200000,608000,3808000,1908000,'parcial'),
  ('FE-1072','Convenio Empresa ABC','901222333-4','2026-04-10','2026-05-10',5600000,1064000,6664000,6664000,'abierta'),
  ('FE-1080','Catering Bodas Luxe','79123456-7','2026-03-01','2026-03-31',4200000,798000,4998000,4998000,'abierta'),
  ('FE-1090','Club Campestre','860112233-5','2026-05-28','2026-06-27',2800000,532000,3332000,3332000,'abierta')
) v(numero,cliente,nit,fecha,vencimiento,base,iva,total,saldo,estado)
where not exists (select 1 from public.cont_ar_factura);

-- ─── Tesorería: bancos + extracto ───────────────────────────────────────────
do $$
declare v_b1 bigint; v_b2 bigint;
begin
  if not exists (select 1 from public.cont_cuenta_banco) then
    insert into public.cont_cuenta_banco (banco,numero,tipo,cuenta_puc,saldo)
      values ('Bancolombia','•••• 7712','Ahorros','111005',48250000) returning id into v_b1;
    insert into public.cont_cuenta_banco (banco,numero,tipo,cuenta_puc,saldo)
      values ('Davivienda','•••• 0341','Corriente','111005',12800000) returning id into v_b2;

    insert into public.cont_extracto_linea (banco_id,fecha,descripcion,referencia,valor,conciliado) values
      (v_b1,'2026-06-08','Payout Stripe lote 24512','po_24512',3180000,true),
      (v_b1,'2026-06-08','Payout Rappi liquidación','rp_8841',2240000,true),
      (v_b1,'2026-06-08','Pago proveedor Pescadería','tr_99812',-850000,true),
      (v_b1,'2026-06-08','Comisión datáfono','fee_0608',-94200,false),
      (v_b2,'2026-06-07','Transferencia no identificada','tr_55120',1500000,false),
      (v_b2,'2026-06-07','Recaudo Hotel Andino','tr_44011',1900000,false);
  end if;
end $$;

-- ─── Impuestos del período ──────────────────────────────────────────────────
insert into public.cont_impuesto_mov (tipo,base,tarifa,valor,origen_tipo,fecha)
select * from (values
  ('IVA'::cont_tipo_impuesto, 18210526::numeric, 0.19::numeric, 3460000::numeric, 'venta',  current_date),
  ('IVA'::cont_tipo_impuesto,  6526316::numeric, 0.19::numeric, 1240000::numeric, 'compra', current_date),
  ('INC'::cont_tipo_impuesto, 14750000::numeric, 0.08::numeric, 1180000::numeric, 'venta',  current_date),
  ('RETEFUENTE'::cont_tipo_impuesto, 16720000::numeric, 0.025::numeric, 418000::numeric, 'venta', current_date),
  ('RETEIVA'::cont_tipo_impuesto, 640000::numeric, 0.15::numeric, 96000::numeric, 'venta', current_date),
  ('ICA'::cont_tipo_impuesto, 41000000::numeric, 0.00696::numeric, 285000::numeric, 'venta', current_date)
) v(tipo,base,tarifa,valor,origen_tipo,fecha)
where not exists (select 1 from public.cont_impuesto_mov);

-- ─── Libro diario: asientos históricos contabilizados ───────────────────────
do $$
declare v_per bigint; v_a1 bigint; v_a2 bigint; v_a3 bigint;
begin
  if not exists (select 1 from public.cont_asiento) then
    select id into v_per from public.cont_periodo where estado='abierto' order by id desc limit 1;

    -- Asiento 1: cierre de caja
    insert into public.cont_asiento (fecha,periodo_id,fuente,origen_tipo,descripcion,estado)
      values ('2026-06-01',v_per,'Cierre Z · 01-jun','cierre_caja','Cierre de caja 01-jun','borrador') returning id into v_a1;
    insert into public.cont_asiento_linea (asiento_id,cuenta,descripcion,debe,haber) values
      (v_a1,'110505','Caja general',5200000,0),
      (v_a1,'131005','CxC pasarela / banco en tránsito',8600000,0),
      (v_a1,'413550','Ingresos operacionales — restaurante',0,11400000),
      (v_a1,'240805','Impuesto (IVA/INC) por pagar',0,1900000),
      (v_a1,'233595','Propinas por liquidar',0,500000);
    update public.cont_asiento set estado='contabilizado' where id=v_a1;

    -- Asiento 2: causación CxP con retención
    insert into public.cont_asiento (fecha,periodo_id,fuente,origen_tipo,descripcion,estado)
      values ('2026-06-03',v_per,'Factura proveedor · Pescadería La Marina','factura_ap','Compra alimentos','borrador') returning id into v_a2;
    insert into public.cont_asiento_linea (asiento_id,cuenta,descripcion,debe,haber) values
      (v_a2,'613505','Costo de alimentos',1240000,0),
      (v_a2,'236540','Retención en la fuente por pagar (2.5%)',0,31000),
      (v_a2,'220505','Proveedores nacionales',0,1209000);
    update public.cont_asiento set estado='contabilizado' where id=v_a2;

    -- Asiento 3: factura a crédito (CxC)
    insert into public.cont_asiento (fecha,periodo_id,fuente,origen_tipo,descripcion,estado)
      values ('2026-06-05',v_per,'Factura a crédito · FE-1090 — Club Campestre','factura_ar','Venta a crédito','borrador') returning id into v_a3;
    insert into public.cont_asiento_linea (asiento_id,cuenta,descripcion,debe,haber) values
      (v_a3,'130505','Clientes nacionales',3332000,0),
      (v_a3,'413550','Ingresos operacionales — restaurante',0,2800000),
      (v_a3,'240805','Impuesto (IVA/INC) por pagar',0,532000);
    update public.cont_asiento set estado='contabilizado' where id=v_a3;
  end if;
end $$;
