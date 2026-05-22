-- Respaldo automatico de clientes a partir de reservas de Oh Yeah.
-- Captura tanto a los registrados como a los que reservan sin registrarse.
--   - Con email  -> upsert en ohyeah_clientes (llave unica: email)
--   - Con telefono -> upsert en customers   (llave unica: phone)
-- En conflicto solo rellena lo que falta; nunca sobrescribe datos buenos ni duplica.
-- SECURITY DEFINER para que funcione aunque la reserva entre con la llave anon publica.

create or replace function public.fn_backup_cliente_ohyeah()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := nullif(btrim(NEW.guest_email), '');
  v_phone text := nullif(btrim(NEW.guest_phone), '');
  v_name  text := coalesce(nullif(btrim(NEW.guest_name), ''), 'Invitado Oh Yeah');
begin
  -- Respaldo en ohyeah_clientes (llave unica: email)
  if v_email is not null then
    insert into public.ohyeah_clientes (nombre, email, telefono, gourmand_level, source)
    values (v_name, lower(v_email), v_phone, coalesce(NEW.gourmand_level, 'INICIADO'), 'ohyeah_reserva')
    on conflict (email) do update set
      telefono = coalesce(ohyeah_clientes.telefono, excluded.telefono),
      nombre   = coalesce(nullif(btrim(ohyeah_clientes.nombre), ''), excluded.nombre);
  end if;

  -- Respaldo en customers (llave unica: phone) -> cubre reservas sin email
  if v_phone is not null then
    insert into public.customers (name, phone, email, origen_captacion)
    values (v_name, v_phone, lower(v_email), 'oh_yeah')
    on conflict (phone) do update set
      email = coalesce(customers.email, excluded.email),
      name  = coalesce(nullif(btrim(customers.name), ''), excluded.name);
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_backup_cliente_ohyeah on public.ohyeah_reservas;
create trigger trg_backup_cliente_ohyeah
after insert or update of guest_email, guest_phone, guest_name
on public.ohyeah_reservas
for each row
execute function public.fn_backup_cliente_ohyeah();
