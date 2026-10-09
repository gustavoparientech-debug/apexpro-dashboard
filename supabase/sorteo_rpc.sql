-- Sorteo Apex Pro (2/2): RPC, permisos, storage, realtime y datos iniciales.
-- Se aplica después de sorteo.sql.

-- ─── RPC públicas ──────────────────────────────────────────────────────────

create or replace function public.reserve_tickets(
  p_numbers int[], p_nombre text, p_dni text, p_celular text,
  p_email text default null, p_acepta_terminos boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare o raffle_orders;
begin
  o := raffle_create_order(p_numbers, p_nombre, p_dni, p_celular, p_email,
                           p_acepta_terminos, 'web', null, null);
  return jsonb_build_object(
    'order_id', o.id, 'reserved_until', o.reserved_until,
    'monto_total', o.monto_total, 'cantidad', o.cantidad,
    'numbers', (select jsonb_agg(number order by number) from raffle_tickets where order_id = o.id)
  );
end $$;

-- El navegador sube primero la imagen a raffle-receipts/<order_id>/... y
-- luego llama aquí con la ruta.
create or replace function public.submit_payment(
  p_order uuid, p_medio text, p_n_operacion text, p_path text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o raffle_orders;
  n int;
begin
  select * into o from raffle_orders where id = p_order for update;
  if not found then raise exception 'PEDIDO_NO_EXISTE'; end if;
  if o.status <> 'pending' or o.payment_submitted_at is not null then raise exception 'PEDIDO_NO_PENDIENTE'; end if;

  -- Mientras los números sigan reservados a este pedido se acepta el pago,
  -- aunque el reloj haya pasado unos segundos del límite.
  select count(*) into n from raffle_tickets where order_id = p_order and status = 'reserved';
  if n <> o.cantidad then raise exception 'RESERVA_VENCIDA'; end if;

  if p_medio not in ('yape','plin') then raise exception 'MEDIO_PAGO'; end if;
  if p_path is null or split_part(p_path, '/', 1) <> p_order::text
     or not exists (select 1 from storage.objects where bucket_id = 'raffle-receipts' and name = p_path) then
    raise exception 'COMPROBANTE';
  end if;

  update raffle_orders
     set medio_pago = p_medio, n_operacion = nullif(btrim(coalesce(p_n_operacion, '')), ''),
         comprobante_url = p_path, payment_submitted_at = now(), reserved_until = null
   where id = p_order;

  update raffle_tickets set status = 'pending_payment', reserved_until = null where order_id = p_order;

  return jsonb_build_object('ok', true);
end $$;

create or replace function public.get_order_status(p_order uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o raffle_orders;
  cfg raffle_config;
begin
  perform raffle_release_expired();
  select * into o from raffle_orders where id = p_order;
  if not found then return null; end if;
  select * into cfg from raffle_config where id = 1;

  return jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'etapa', case
      when o.status = 'approved' then 'aprobado'
      when o.status = 'rejected' then 'rechazado'
      when o.status = 'expired'  then 'expirado'
      when o.payment_submitted_at is null then 'esperando_pago'
      else 'en_revision' end,
    'nombre', o.nombre_completo,
    'dni', left(o.dni, 2) || repeat('*', greatest(char_length(o.dni) - 4, 0)) || right(o.dni, 2),
    'cantidad', o.cantidad,
    'monto_total', o.monto_total,
    'medio_pago', o.medio_pago,
    'reserved_until', o.reserved_until,
    'created_at', o.created_at,
    'motivo_rechazo', o.motivo_rechazo,
    'titulo', cfg.titulo,
    'fecha_sorteo', cfg.fecha_sorteo,
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
               'number', t.number,
               'code', case when o.status = 'approved' then t.ticket_code end,
               'paid_at', t.paid_at)
             order by t.number)
        from raffle_tickets t where t.order_id = o.id), '[]'::jsonb)
  );
end $$;

-- ─── RPC del panel (trabajadores y administradores) ────────────────────────

-- Venta en el local. Si vende un administrador queda aprobada al instante;
-- si vende un trabajador queda en revisión hasta que un administrador la apruebe.
create or replace function public.staff_sell_tickets(
  p_numbers int[], p_nombre text, p_dni text, p_celular text, p_email text,
  p_medio text, p_n_operacion text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o raffle_orders;
  quien text;
begin
  if not raffle_is_staff() then raise exception 'NO_AUTORIZADO'; end if;
  if p_medio not in ('yape','plin','efectivo','transferencia') then raise exception 'MEDIO_PAGO'; end if;

  select coalesce(nullif(display_name, ''), email) into quien from profiles where id = auth.uid();

  o := raffle_create_order(p_numbers, p_nombre, p_dni, p_celular, p_email, true,
                           'panel', auth.uid(), quien);

  update raffle_orders
     set medio_pago = p_medio, n_operacion = nullif(btrim(coalesce(p_n_operacion, '')), ''),
         payment_submitted_at = now(), reserved_until = null
   where id = o.id;
  update raffle_tickets set status = 'pending_payment', reserved_until = null where order_id = o.id;

  if raffle_is_admin() then
    perform raffle_approve_internal(o.id);
  end if;

  return get_order_status(o.id);
end $$;

-- Para adjuntar la foto del Yape a una venta del panel (opcional).
create or replace function public.staff_attach_receipt(p_order uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not raffle_is_staff() then raise exception 'NO_AUTORIZADO'; end if;
  if p_path is null or p_path not like 'panel/' || p_order::text || '/%' then raise exception 'COMPROBANTE'; end if;
  update raffle_orders set comprobante_url = p_path
   where id = p_order and (seller_id = auth.uid() or raffle_is_admin());
end $$;

create or replace function public.approve_order(p_order uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not raffle_is_admin() then raise exception 'NO_AUTORIZADO'; end if;
  perform raffle_approve_internal(p_order);
  return get_order_status(p_order);
end $$;

create or replace function public.reject_order(p_order uuid, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o raffle_orders;
begin
  if not raffle_is_admin() then raise exception 'NO_AUTORIZADO'; end if;
  select * into o from raffle_orders where id = p_order for update;
  if not found then raise exception 'PEDIDO_NO_EXISTE'; end if;
  if o.status <> 'pending' then raise exception 'PEDIDO_NO_PENDIENTE'; end if;

  update raffle_orders
     set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(),
         reserved_until = null, motivo_rechazo = nullif(btrim(coalesce(p_motivo, '')), '')
   where id = p_order;
  update raffle_tickets
     set status = 'available', order_id = null, reserved_until = null
   where order_id = p_order;
  return get_order_status(p_order);
end $$;

-- ─── Permisos ──────────────────────────────────────────────────────────────

-- Internas: nadie las llama desde el navegador.
revoke all on function public.raffle_create_order(int[], text, text, text, text, boolean, text, uuid, text) from public, anon, authenticated;
revoke all on function public.raffle_approve_internal(uuid) from public, anon, authenticated;
revoke all on function public.raffle_release_expired() from public, anon, authenticated;
revoke all on function public.raffle_sync_ticket_count(int) from public, anon, authenticated;
revoke all on function public.raffle_sync_board() from public, anon, authenticated;
revoke all on function public.raffle_config_changed() from public, anon, authenticated;
revoke all on function public.raffle_new_code() from public, anon, authenticated;

-- Del panel: solo con sesión (además validan el rol por dentro).
revoke all on function public.staff_sell_tickets(int[], text, text, text, text, text, text) from public, anon;
revoke all on function public.staff_attach_receipt(uuid, text) from public, anon;
revoke all on function public.approve_order(uuid) from public, anon;
revoke all on function public.reject_order(uuid, text) from public, anon;
grant execute on function public.staff_sell_tickets(int[], text, text, text, text, text, text) to authenticated;
grant execute on function public.staff_attach_receipt(uuid, text) to authenticated;
grant execute on function public.approve_order(uuid) to authenticated;
grant execute on function public.reject_order(uuid, text) to authenticated;

grant execute on function public.reserve_tickets(int[], text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.submit_payment(uuid, text, text, text) to anon, authenticated;
grant execute on function public.get_order_status(uuid) to anon, authenticated;

alter table public.raffle_config  enable row level security;
alter table public.raffle_orders  enable row level security;
alter table public.raffle_tickets enable row level security;
alter table public.raffle_board   enable row level security;

drop policy if exists raffle_config_read   on public.raffle_config;
drop policy if exists raffle_config_admin  on public.raffle_config;
create policy raffle_config_read  on public.raffle_config for select using (true);
create policy raffle_config_admin on public.raffle_config for update
  using (public.raffle_is_admin()) with check (public.raffle_is_admin());

drop policy if exists raffle_orders_read on public.raffle_orders;
create policy raffle_orders_read on public.raffle_orders for select to authenticated
  using (public.raffle_is_admin() or seller_id = auth.uid());

drop policy if exists raffle_tickets_read on public.raffle_tickets;
create policy raffle_tickets_read on public.raffle_tickets for select to authenticated
  using (public.raffle_is_admin()
         or exists (select 1 from public.raffle_orders o where o.id = order_id and o.seller_id = auth.uid()));

drop policy if exists raffle_board_read on public.raffle_board;
create policy raffle_board_read on public.raffle_board for select using (true);

revoke insert, update, delete on public.raffle_board, public.raffle_tickets, public.raffle_orders from anon, authenticated;
revoke insert, delete on public.raffle_config from anon, authenticated;
revoke update on public.raffle_config from anon;

-- ─── Storage: comprobantes privados ────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('raffle-receipts', 'raffle-receipts', false, 5242880,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Solo se puede subir a la carpeta de un pedido que está esperando su pago.
create or replace function public.raffle_can_upload_receipt(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (
       select 1 from raffle_orders o
        where o.id = split_part(p_name, '/', 1)::uuid
          and o.status = 'pending' and o.payment_submitted_at is null
          and exists (select 1 from raffle_tickets t where t.order_id = o.id and t.status = 'reserved')
     )
$$;

drop policy if exists raffle_receipts_public_upload on storage.objects;
drop policy if exists raffle_receipts_staff_upload  on storage.objects;
drop policy if exists raffle_receipts_admin_read    on storage.objects;
create policy raffle_receipts_public_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'raffle-receipts' and public.raffle_can_upload_receipt(name));
create policy raffle_receipts_staff_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'raffle-receipts' and name like 'panel/%' and public.raffle_is_staff());
create policy raffle_receipts_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'raffle-receipts' and public.raffle_is_admin());

-- ─── Realtime y tareas programadas ─────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and tablename = 'raffle_board') then
    alter publication supabase_realtime add table public.raffle_board;
  end if;
end $$;

select cron.schedule('raffle-release-expired', '* * * * *', 'select public.raffle_release_expired()');

-- ─── Datos iniciales ───────────────────────────────────────────────────────

insert into public.raffle_config (id, premios, terminos) values (1,
  '[
    {"nombre": "PPF Full Body",                      "cantidad": 1, "valor": null},
    {"nombre": "Pintura completa",                   "cantidad": 1, "valor": null},
    {"nombre": "Cerámico CarPro",                    "cantidad": 2, "valor": null},
    {"nombre": "Polarizado nanocerámico Lexen",      "cantidad": 2, "valor": null},
    {"nombre": "Detallado completo",                 "cantidad": 2, "valor": null}
  ]'::jsonb,
  'Cada ticket cuesta S/15 y participa con un número del 001 al 600. Los números se reservan por 15 minutos; si no se sube el comprobante en ese tiempo, se liberan. El pedido queda confirmado cuando Apex Pro Detailing verifica el pago. Los premios no son canjeables por dinero. El sorteo se realiza en la fecha publicada y se transmite por @apex.pro.aqp. Los ganadores se contactan al celular registrado.'
) on conflict (id) do nothing;

-- ─── Reinicio (para limpiar pruebas) ───────────────────────────────────────

-- Borra todos los pedidos y deja los números libres. Solo admin.
create or replace function public.raffle_reset(p_confirm text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not raffle_is_admin() then raise exception 'NO_AUTORIZADO'; end if;
  if p_confirm <> 'REINICIAR' then raise exception 'CONFIRMACION'; end if;
  update raffle_tickets
     set status = 'available', order_id = null, reserved_until = null, ticket_code = null, paid_at = null
   where status <> 'available' or order_id is not null or ticket_code is not null;
  delete from raffle_orders where true;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.raffle_reset(text) from public, anon;
grant execute on function public.raffle_reset(text) to authenticated;

-- El admin puede borrar comprobantes (lo usa el reinicio).
drop policy if exists raffle_receipts_admin_delete on storage.objects;
create policy raffle_receipts_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'raffle-receipts' and public.raffle_is_admin());

-- ─── DNI opcional ──────────────────────────────────────────────────────────
-- Aplicado como migración sorteo_dni_opcional: dni pasa a ser nullable y
-- raffle_create_order solo lo valida si viene.
alter table public.raffle_orders alter column dni drop not null;
alter table public.raffle_orders drop constraint if exists raffle_orders_dni_check;
alter table public.raffle_orders add constraint raffle_orders_dni_check check (dni is null or dni ~ '^[0-9A-Z]{8,12}$');
