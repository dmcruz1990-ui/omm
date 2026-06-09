-- ============================================================================
-- NEXUM · Activos fijos (NIC 16) + cuentas para cierre de período
-- Tabla de activos con depreciación, y cuentas PUC para depreciación, PPE y
-- resultado del ejercicio (usado por el asiento de cierre).
-- ============================================================================

create table if not exists public.cont_activo (
  id                bigint generated always as identity primary key,
  nombre            text not null,
  clase             text,                                  -- equipo, mobiliario, cómputo…
  fecha_compra      date,
  fecha_uso         date,                                  -- inicio de depreciación
  costo             numeric(16,2) not null default 0,
  vida_util_meses   int not null default 60,
  valor_residual    numeric(16,2) not null default 0,
  depreciacion_acum numeric(16,2) not null default 0,
  centro_costo      text,
  restaurante_id    bigint,
  estado            text not null default 'activo',        -- activo|baja|vendido
  cuenta_ppe        text references public.cont_cuenta(codigo),
  created_at        timestamptz not null default now()
);
alter table public.cont_activo enable row level security;
drop policy if exists cont_activo_rw on public.cont_activo;
create policy cont_activo_rw on public.cont_activo for all to authenticated using (true) with check (true);

-- Cuentas PUC adicionales (activos fijos y cierre)
insert into public.cont_cuenta (codigo, nombre, clase, naturaleza, imputable) values
  ('1524',  'Equipo de restaurante',         1, 'debito',  false),
  ('152405','Equipo de restaurante',         1, 'debito',  true),
  ('1592',  'Depreciación acumulada',        1, 'credito', false),
  ('159205','Depreciación acumulada',        1, 'credito', true),
  ('5160',  'Depreciaciones',                5, 'debito',  false),
  ('516005','Gasto depreciación',            5, 'debito',  true),
  ('3605',  'Resultados del ejercicio',      3, 'credito', false),
  ('360505','Utilidad del ejercicio',        3, 'credito', true)
on conflict (codigo) do nothing;

-- Activos demo
insert into public.cont_activo (nombre,clase,fecha_compra,fecha_uso,costo,vida_util_meses,valor_residual,centro_costo,cuenta_ppe)
select * from (values
  ('Horno industrial Rational','Equipo cocina','2024-01-15'::date,'2024-02-01'::date,12000000,120,1200000,'Cocina','152405'),
  ('Cuarto frío / refrigeración','Equipo cocina','2024-01-15','2024-02-01',8000000,120,800000,'Cocina','152405'),
  ('Mobiliario salón','Mobiliario','2023-11-01','2023-12-01',15000000,120,1500000,'Salón','152405'),
  ('Hardware POS x6','Cómputo','2025-03-01','2025-03-15',6000000,60,0,'Administración','152405'),
  ('Equipo de bar','Equipo bar','2024-06-01','2024-07-01',9500000,120,950000,'Bar','152405')
) v(nombre,clase,fecha_compra,fecha_uso,costo,vida_util_meses,valor_residual,centro_costo,cuenta_ppe)
where not exists (select 1 from public.cont_activo);
