-- ============================================================================
-- NEXUM · Núcleo contable (record-to-report)
-- Plan de cuentas (PUC), períodos fiscales, libro diario/mayor de partida doble
-- y subledgers de CxC (cartera), tesorería e impuestos.
--
-- Principios de las normativas NEXUM materializados aquí:
--   · Partida doble  -> trigger valida que cada asiento contabilizado cuadre.
--   · Trazabilidad   -> cada asiento referencia su documento fuente (origen_*).
--   · Idempotencia   -> idempotency_key único evita doble posteo del mismo evento.
--   · Inmutabilidad  -> no se borran asientos contabilizados (regla en trigger).
--   · Períodos       -> no se postea en período cerrado.
--   · Multidimensión -> dimension jsonb (empresa/marca/restaurante/centro/canal).
-- ============================================================================

-- ─── Catálogos / tipos ──────────────────────────────────────────────────────
do $$ begin
  create type cont_naturaleza   as enum ('debito','credito');
  exception when duplicate_object then null;
end $$;
do $$ begin
  create type cont_estado_asiento as enum ('borrador','contabilizado','anulado');
  exception when duplicate_object then null;
end $$;
do $$ begin
  create type cont_estado_periodo as enum ('abierto','cerrado');
  exception when duplicate_object then null;
end $$;
do $$ begin
  create type cont_tipo_impuesto as enum ('IVA','INC','RETEFUENTE','RETEIVA','RETEICA','ICA');
  exception when duplicate_object then null;
end $$;

-- ─── Plan de cuentas (PUC Colombia) ─────────────────────────────────────────
create table if not exists public.cont_cuenta (
  codigo      text primary key,
  nombre      text not null,
  clase       smallint not null,                       -- 1 activo .. 6 costos
  naturaleza  cont_naturaleza not null,
  padre       text references public.cont_cuenta(codigo),
  imputable   boolean not null default true,           -- solo imputables reciben movimiento
  activa      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─── Períodos fiscales ──────────────────────────────────────────────────────
create table if not exists public.cont_periodo (
  id          bigint generated always as identity primary key,
  empresa     text not null default 'OMM',
  anio        smallint not null,
  mes         smallint not null check (mes between 1 and 12),
  estado      cont_estado_periodo not null default 'abierto',
  cerrado_por text,
  cerrado_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (empresa, anio, mes)
);

-- ─── Libro diario: encabezado del asiento ───────────────────────────────────
create table if not exists public.cont_asiento (
  id              bigint generated always as identity primary key,
  consecutivo     text,
  fecha           date not null default current_date,
  periodo_id      bigint references public.cont_periodo(id),
  descripcion     text,
  fuente          text not null,                       -- documento fuente legible
  origen_tipo     text not null,                       -- 'cierre_caja','factura_ap','factura_ar','nomina','impuesto','manual','tesoreria'
  origen_id       text,
  dimension       jsonb not null default '{}'::jsonb,  -- {empresa,marca,restaurante,centro_costo,canal}
  estado          cont_estado_asiento not null default 'borrador',
  idempotency_key text unique,                         -- norma: no duplicar posteo del mismo evento
  restaurante_id  bigint,
  creado_por      text,
  posteado_por    text,
  posteado_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ─── Libro diario: líneas (partida doble) ───────────────────────────────────
create table if not exists public.cont_asiento_linea (
  id           bigint generated always as identity primary key,
  asiento_id   bigint not null references public.cont_asiento(id) on delete cascade,
  cuenta       text not null references public.cont_cuenta(codigo),
  descripcion  text,
  tercero      text,                                   -- NIT/cédula del tercero
  debe         numeric(16,2) not null default 0 check (debe  >= 0),
  haber        numeric(16,2) not null default 0 check (haber >= 0),
  dimension    jsonb not null default '{}'::jsonb,
  constraint chk_linea_un_lado check (not (debe > 0 and haber > 0))
);
create index if not exists idx_asiento_linea_asiento on public.cont_asiento_linea(asiento_id);
create index if not exists idx_asiento_linea_cuenta  on public.cont_asiento_linea(cuenta);
create index if not exists idx_asiento_periodo       on public.cont_asiento(periodo_id);
create index if not exists idx_asiento_origen        on public.cont_asiento(origen_tipo, origen_id);

-- ─── Subledger CxC / cartera (NIIF 9) ───────────────────────────────────────
create table if not exists public.cont_ar_factura (
  id            bigint generated always as identity primary key,
  numero        text not null,
  cliente       text not null,
  nit           text,
  fecha         date not null default current_date,
  vencimiento   date,
  base          numeric(16,2) not null default 0,
  iva           numeric(16,2) not null default 0,
  total         numeric(16,2) not null default 0,
  saldo         numeric(16,2) not null default 0,
  estado        text not null default 'abierta',       -- abierta|parcial|pagada|castigada
  asiento_id    bigint references public.cont_asiento(id),
  restaurante_id bigint,
  created_at    timestamptz not null default now()
);
create table if not exists public.cont_ar_recaudo (
  id          bigint generated always as identity primary key,
  factura_id  bigint not null references public.cont_ar_factura(id) on delete cascade,
  fecha       date not null default current_date,
  monto       numeric(16,2) not null,
  medio       text,
  asiento_id  bigint references public.cont_asiento(id),
  created_at  timestamptz not null default now()
);

-- ─── Subledger tesorería ────────────────────────────────────────────────────
create table if not exists public.cont_cuenta_banco (
  id            bigint generated always as identity primary key,
  banco         text not null,
  numero        text,
  tipo          text default 'ahorros',
  moneda        text default 'COP',
  cuenta_puc    text references public.cont_cuenta(codigo),
  saldo         numeric(16,2) not null default 0,
  restaurante_id bigint,
  created_at    timestamptz not null default now()
);
create table if not exists public.cont_extracto_linea (
  id              bigint generated always as identity primary key,
  banco_id        bigint not null references public.cont_cuenta_banco(id) on delete cascade,
  fecha           date not null,
  descripcion     text,
  referencia      text,
  valor           numeric(16,2) not null,              -- + ingreso, - egreso
  conciliado      boolean not null default false,
  asiento_id      bigint references public.cont_asiento(id),
  created_at      timestamptz not null default now()
);
create index if not exists idx_extracto_banco on public.cont_extracto_linea(banco_id, fecha);

-- ─── Subledger impuestos ────────────────────────────────────────────────────
create table if not exists public.cont_impuesto_mov (
  id            bigint generated always as identity primary key,
  tipo          cont_tipo_impuesto not null,
  base          numeric(16,2) not null default 0,
  tarifa        numeric(6,4) not null default 0,
  valor         numeric(16,2) not null default 0,
  jurisdiccion  text default 'CO',
  origen_tipo   text,                                  -- 'venta'|'compra'|'nomina'
  origen_id     text,
  periodo_id    bigint references public.cont_periodo(id),
  fecha         date not null default current_date,
  declarado     boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_impuesto_periodo on public.cont_impuesto_mov(periodo_id, tipo);

-- ─── Reglas de integridad contable (triggers) ───────────────────────────────
-- Al contabilizar un asiento: debe cuadrar (partida doble), tener líneas y el
-- período debe estar abierto. Los asientos contabilizados no se borran.
create or replace function public.fn_cont_validar_posteo()
returns trigger
language plpgsql
as $$
declare
  v_debe  numeric(16,2);
  v_haber numeric(16,2);
  v_n     int;
  v_estado_periodo cont_estado_periodo;
begin
  if NEW.estado = 'contabilizado'
     and (TG_OP = 'INSERT' or OLD.estado is distinct from 'contabilizado') then

    select coalesce(sum(debe),0), coalesce(sum(haber),0), count(*)
      into v_debe, v_haber, v_n
      from public.cont_asiento_linea where asiento_id = NEW.id;

    if v_n = 0 then
      raise exception 'Asiento % sin líneas: no se puede contabilizar', NEW.id;
    end if;
    if v_debe <> v_haber then
      raise exception 'Asiento % descuadrado (debe % <> haber %)', NEW.id, v_debe, v_haber;
    end if;

    if NEW.periodo_id is not null then
      select estado into v_estado_periodo from public.cont_periodo where id = NEW.periodo_id;
      if v_estado_periodo = 'cerrado' then
        raise exception 'Período % cerrado: no se postea', NEW.periodo_id;
      end if;
    end if;

    NEW.posteado_at := coalesce(NEW.posteado_at, now());
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_cont_validar_posteo on public.cont_asiento;
create trigger trg_cont_validar_posteo
before insert or update on public.cont_asiento
for each row execute function public.fn_cont_validar_posteo();

-- No borrar asientos contabilizados (inmutabilidad del libro)
create or replace function public.fn_cont_no_borrar_posteado()
returns trigger
language plpgsql
as $$
begin
  if OLD.estado = 'contabilizado' then
    raise exception 'No se puede borrar un asiento contabilizado (%). Use anulación.', OLD.id;
  end if;
  return OLD;
end;
$$;
drop trigger if exists trg_cont_no_borrar on public.cont_asiento;
create trigger trg_cont_no_borrar
before delete on public.cont_asiento
for each row execute function public.fn_cont_no_borrar_posteado();

-- ─── Vista de balance de prueba ─────────────────────────────────────────────
create or replace view public.cont_balance_prueba as
select
  l.cuenta,
  c.nombre,
  c.clase,
  a.periodo_id,
  sum(l.debe)  as total_debe,
  sum(l.haber) as total_haber,
  sum(l.debe) - sum(l.haber) as saldo
from public.cont_asiento_linea l
join public.cont_asiento a on a.id = l.asiento_id and a.estado = 'contabilizado'
join public.cont_cuenta   c on c.codigo = l.cuenta
group by l.cuenta, c.nombre, c.clase, a.periodo_id;

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.cont_cuenta          enable row level security;
alter table public.cont_periodo         enable row level security;
alter table public.cont_asiento         enable row level security;
alter table public.cont_asiento_linea   enable row level security;
alter table public.cont_ar_factura      enable row level security;
alter table public.cont_ar_recaudo      enable row level security;
alter table public.cont_cuenta_banco    enable row level security;
alter table public.cont_extracto_linea  enable row level security;
alter table public.cont_impuesto_mov    enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'cont_cuenta','cont_periodo','cont_asiento','cont_asiento_linea',
    'cont_ar_factura','cont_ar_recaudo','cont_cuenta_banco',
    'cont_extracto_linea','cont_impuesto_mov'
  ] loop
    execute format('drop policy if exists %I_rw on public.%I;', t, t);
    execute format(
      'create policy %I_rw on public.%I for all to authenticated using (true) with check (true);',
      t, t);
  end loop;
end $$;

-- ─── Semilla: PUC mínimo usado por el motor de asientos ─────────────────────
insert into public.cont_cuenta (codigo, nombre, clase, naturaleza, imputable) values
  ('1105',  'Caja',                                1, 'debito',  false),
  ('110505','Caja general',                        1, 'debito',  true),
  ('1110',  'Bancos',                              1, 'debito',  false),
  ('111005','Bancos moneda nacional',              1, 'debito',  true),
  ('1305',  'Clientes',                            1, 'debito',  false),
  ('130505','Clientes nacionales',                 1, 'debito',  true),
  ('1310',  'Cuentas por cobrar',                  1, 'debito',  false),
  ('131005','CxC pasarela / banco en tránsito',    1, 'debito',  true),
  ('1365',  'CxC trabajadores',                    1, 'debito',  false),
  ('136540','CxC trabajadores',                    1, 'debito',  true),
  ('1399',  'Deterioro (provisión cartera)',       1, 'credito', false),
  ('139905','Deterioro cuentas por cobrar',        1, 'credito', true),
  ('2205',  'Proveedores',                         2, 'credito', false),
  ('220505','Proveedores nacionales',              2, 'credito', true),
  ('2505',  'Salarios por pagar',                  2, 'credito', false),
  ('250501','Salarios por pagar',                  2, 'credito', true),
  ('2370',  'Retenciones y aportes de nómina',     2, 'credito', false),
  ('237006','Aportes seguridad social por pagar',  2, 'credito', true),
  ('236505','Deducciones de nómina por pagar',     2, 'credito', true),
  ('510569','Aportes y cargas patronales',         5, 'debito',  true),
  ('2335',  'Costos y gastos por pagar',           2, 'credito', false),
  ('233595','Propinas por liquidar',               2, 'credito', true),
  ('2365',  'Retención en la fuente',              2, 'credito', false),
  ('236540','Retención en la fuente por pagar',    2, 'credito', true),
  ('2367',  'Impuesto a las ventas retenido',      2, 'credito', false),
  ('236701','Retención de IVA por pagar',          2, 'credito', true),
  ('2408',  'Impuesto sobre las ventas por pagar', 2, 'credito', false),
  ('240805','IVA/INC generado por pagar',          2, 'credito', true),
  ('240810','IVA descontable',                     2, 'debito',  true),
  ('2412',  'Impuesto de industria y comercio',    2, 'credito', false),
  ('241205','ICA por pagar',                        2, 'credito', true),
  ('4135',  'Comercio al por mayor y menor',       4, 'credito', false),
  ('413550','Ingresos operacionales — restaurante',4, 'credito', true),
  ('4295',  'Diversos (otros ingresos)',           4, 'credito', false),
  ('429595','Otros ingresos',                      4, 'credito', true),
  ('5105',  'Gastos de personal',                  5, 'debito',  false),
  ('510506','Sueldos y prestaciones',              5, 'debito',  true),
  ('5120',  'Arrendamientos',                      5, 'debito',  false),
  ('512010','Arrendamientos',                      5, 'debito',  true),
  ('5135',  'Servicios',                            5, 'debito',  false),
  ('513505','Servicios públicos',                  5, 'debito',  true),
  ('513540','Aseo y mantenimiento',                5, 'debito',  true),
  ('5195',  'Diversos (gastos)',                   5, 'debito',  false),
  ('519595','Gastos diversos',                     5, 'debito',  true),
  ('519910','Gasto deterioro de cartera',          5, 'debito',  true),
  ('6135',  'Costo de ventas',                     6, 'debito',  false),
  ('613505','Costo de alimentos',                  6, 'debito',  true),
  ('613510','Costo de bebidas',                    6, 'debito',  true)
on conflict (codigo) do nothing;

-- Período abierto del mes corriente
insert into public.cont_periodo (empresa, anio, mes, estado)
values ('OMM', extract(year from current_date)::smallint, extract(month from current_date)::smallint, 'abierto')
on conflict (empresa, anio, mes) do nothing;
