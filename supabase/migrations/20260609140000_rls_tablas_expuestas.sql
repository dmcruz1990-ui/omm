-- ============================================================================
-- NEXUM · Habilitar RLS en tablas expuestas (advisor de Supabase)
-- 32 tablas operativas: RLS + política permisiva (anon+authenticated) para
-- preservar el acceso actual de la app sin romper nada.
-- 7 tablas de respaldo (*_backup_*): RLS sin política → quedan accesibles solo
-- por service_role (no deben exponerse a la anon key).
--
-- Nota: las políticas permisivas dejan RLS activo pero el acceso sigue abierto;
-- es una línea base. El endurecimiento real (por usuario/rol/tenant) requiere
-- definir reglas por tabla según el patrón de acceso de cada módulo.
-- ============================================================================
do $$
declare
  t text;
  abiertas text[] := array[
    'ritual_tasks','benchmark_profiles','vendors','supply_items','supply_item_offers',
    'supply_orders','supply_order_items','tables','pagos_split','reportes',
    'foro_posts','foro_likes','progreso_academia','nx_movimientos','nx_saldo',
    'comunicados','crew_propinas','reservas_config','catalogo_egresos',
    'ohyeah_top_platos','ohyeah_eventos','ohyeah_gourmand_regalos',
    'propinas_solicitudes_cobro','nx_beneficios','nx_retos','nx_solicitudes',
    'nx_wallet_movimientos','flow_chat_meseros','academia_cursos','clima_encuestas',
    'crew_denuncias','crew_comunicados'
  ];
  backups text[] := array[
    'menu_items_backup_20260526','menu_platos_backup_20260526',
    'staff_nexum_backup_20260527','profiles_backup_20260527',
    'mesas_backup_20260527','tables_backup_20260527','empleados_backup_20260527'
  ];
begin
  foreach t in array abiertas loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists %I_anon_auth on public.%I;', t, t);
      execute format('create policy %I_anon_auth on public.%I for all to anon, authenticated using (true) with check (true);', t, t);
    end if;
  end loop;

  foreach t in array backups loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('alter table public.%I enable row level security;', t);
      -- sin política: solo service_role accede a los respaldos
    end if;
  end loop;
end $$;
