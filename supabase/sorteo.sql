-- ═══════════════════════════════════════════════════════════════════════════
-- Sorteo Apex Pro
--
-- Tablas con prefijo raffle_ porque `tickets` ya es la tabla de servicios.
--
-- El público (anon) nunca toca raffle_orders ni raffle_tickets: lee la copia
-- sin datos personales (raffle_board / vista public_tickets) y crea o consulta
-- pedidos solo con las funciones RPC de abajo. El id del pedido es un uuid
-- aleatorio y hace de llave de la página /sorteo/estado/:id.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

-- ─── Configuración (una sola fila) ─────────────────────────────────────────

create table if not exists public.raffle_config (
  id              int primary key default 1 check (id = 1),
  titulo          text not null default 'Sorteo Apex Pro',
  precio_ticket   numeric(10,2) not null default 15 check (precio_ticket > 0),
  total_tickets   int not null default 600 check (total_tickets between 1 and 9999),
  max_por_pedido  int not null default 20 check (max_por_pedido between 1 and 100),
  minutos_reserva int not null default 15 check (minutos_reserva between 5 and 120),
  fecha_sorteo    timestamptz,
  premios         jsonb not null default '[]'::jsonb,
  numero_pago     text not null default '959240309',
  titular_pago    text,
  whatsapp        text not null default '959240309',
  instagram       text not null default '@apex.pro.aqp',
  terminos        text,
  estado          text not null default 'abierto' check (estado in ('abierto','cerrado')),
  updated_at      timestamptz not null default now()
);

-- ─── Pedidos ───────────────────────────────────────────────────────────────

create table if not exists public.raffle_orders (
  id                   uuid primary key default gen_random_uuid(),
  nombre_completo      text not null check (char_length(nombre_completo) between 3 and 120),
  dni                  text not null check (dni ~ '^[0-9A-Z]{8,12}$'),
  celular              text not null check (celular ~ '^9[0-9]{8}$'),
  email                text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  cantidad             int not null check (cantidad > 0),
  monto_total          numeric(10,2) not null check (monto_total >= 0),
  medio_pago           text check (medio_pago in ('yape','plin','efectivo','transferencia')),
  n_operacion          text check (char_length(n_operacion) <= 40),
  comprobante_url      text,                 -- ruta dentro del bucket privado raffle-receipts
  status               text not null default 'pending'
                         check (status in ('pending','approved','rejected','expired')),
  origen               text not null default 'web' check (origen in ('web','panel')),
  vendedor             text,
  seller_id            uuid references auth.users(id) on delete set null,
  acepta_terminos      boolean not null default false,
  reserved_until       timestamptz,          -- solo mientras espera el comprobante
  payment_submitted_at timestamptz,          -- se subió comprobante / venta en panel
  reviewed_at          timestamptz,
  reviewed_by          uuid references auth.users(id) on delete set null,
  motivo_rechazo       text,
  created_at           timestamptz not null default now()
);

create index if not exists raffle_orders_status_idx on public.raffle_orders (status, created_at desc);
create index if not exists raffle_orders_seller_idx on public.raffle_orders (seller_id);

-- ─── Tickets ───────────────────────────────────────────────────────────────

create table if not exists public.raffle_tickets (
  number         int primary key check (number > 0),
  status         text not null default 'available'
                   check (status in ('available','reserved','pending_payment','paid','cancelled')),
  order_id       uuid references public.raffle_orders(id) on delete set null,
  reserved_until timestamptz,
  ticket_code    text unique,
  paid_at        timestamptz
);

create index if not exists raffle_tickets_order_idx on public.raffle_tickets (order_id);

-- ─── Tablero público (sin datos personales) ────────────────────────────────
-- Es una tabla y no una vista porque Realtime no emite cambios de vistas.

create table if not exists public.raffle_board (
  number         int primary key,
  status         text not null default 'disponible' check (status in ('disponible','reservado','vendido')),
  nombre         text,
  celular        text,
  reserved_until timestamptz,
  updated_at     timestamptz not null default now()
);

create or replace view public.public_tickets with (security_invoker = true) as
  select number, status, nombre, celular from public.raffle_board;

-- ─── Utilidades ────────────────────────────────────────────────────────────

-- "gustavo pariente ruiz" → "Gustavo Pa******"
create or replace function public.raffle_mask_name(p text)
returns text language sql immutable set search_path = public as $$
  select case
    when p is null or btrim(p) = '' then null
    when array_length(regexp_split_to_array(btrim(p), '\s+'), 1) = 1
      then initcap((regexp_split_to_array(btrim(p), '\s+'))[1]) || ' ******'
    else initcap((regexp_split_to_array(btrim(p), '\s+'))[1]) || ' '
      || initcap(left((regexp_split_to_array(btrim(p), '\s+'))[2], 2)) || '******'
  end
$$;

-- "959240309" → "959***309"
create or replace function public.raffle_mask_phone(p text)
returns text language sql immutable set search_path = public as $$
  select case when p is null then null else left(p, 3) || '***' || right(p, 3) end
$$;

-- APX-XXXX-XXXX con 32 símbolos sin 0/O/1/I (256 es múltiplo de 32: sin sesgo).
create or replace function public.raffle_new_code()
returns text language plpgsql volatile set search_path = public, extensions as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  s text;
begin
  loop
    b := gen_random_bytes(8);
    s := '';
    for i in 0..7 loop
      s := s || substr(alfabeto, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    s := 'APX-' || left(s, 4) || '-' || right(s, 4);
    exit when not exists (select 1 from raffle_tickets where ticket_code = s);
  end loop;
  return s;
end $$;

create or replace function public.raffle_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin','worker') and coalesce(active, true)
  )
$$;

create or replace function public.raffle_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin' and coalesce(active, true)
  )
$$;

-- ─── Sincronización del tablero ────────────────────────────────────────────

create or replace function public.raffle_sync_board()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  o raffle_orders;
  libre boolean;
begin
  if tg_op = 'DELETE' then
    delete from raffle_board where number = old.number;
    return old;
  end if;

  libre := new.status in ('available','cancelled');
  if not libre and new.order_id is not null then
    select * into o from raffle_orders where id = new.order_id;
  end if;

  insert into raffle_board (number, status, nombre, celular, reserved_until, updated_at)
  values (
    new.number,
    case when libre then 'disponible' when new.status = 'paid' then 'vendido' else 'reservado' end,
    case when libre then null else raffle_mask_name(o.nombre_completo) end,
    case when libre then null else raffle_mask_phone(o.celular) end,
    case when new.status = 'reserved' then new.reserved_until end,
    now()
  )
  on conflict (number) do update set
    status = excluded.status, nombre = excluded.nombre, celular = excluded.celular,
    reserved_until = excluded.reserved_until, updated_at = excluded.updated_at;
  return new;
end $$;

drop trigger if exists raffle_tickets_board on public.raffle_tickets;
create trigger raffle_tickets_board
  after insert or update or delete on public.raffle_tickets
  for each row execute function public.raffle_sync_board();

-- Crea o quita números cuando cambia total_tickets. No deja quitar números
-- que ya tienen dueño.
create or replace function public.raffle_sync_ticket_count(p_total int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from raffle_tickets where number > p_total and status <> 'available') then
    raise exception 'TOTAL_MENOR_QUE_VENDIDOS';
  end if;
  delete from raffle_tickets where number > p_total;
  insert into raffle_tickets (number)
    select g from generate_series(1, p_total) g
  on conflict (number) do nothing;
end $$;

create or replace function public.raffle_config_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' or new.total_tickets is distinct from old.total_tickets then
    perform raffle_sync_ticket_count(new.total_tickets);
  end if;
  return new;
end $$;

drop trigger if exists raffle_config_changed on public.raffle_config;
create trigger raffle_config_changed
  before insert or update on public.raffle_config
  for each row execute function public.raffle_config_changed();

-- ─── Expiración de reservas ────────────────────────────────────────────────

create or replace function public.raffle_release_expired()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with vencidos as (
    update raffle_orders
       set status = 'expired', reserved_until = null
     where status = 'pending' and payment_submitted_at is null and reserved_until < now()
    returning id
  )
  update raffle_tickets t
     set status = 'available', order_id = null, reserved_until = null
    from vencidos v
   where t.order_id = v.id and t.status = 'reserved';
  get diagnostics n = row_count;
  return n;
end $$;

-- ─── Núcleo interno: crear pedido y aprobar ────────────────────────────────

create or replace function public.raffle_create_order(
  p_numbers int[], p_nombre text, p_dni text, p_celular text, p_email text,
  p_acepta boolean, p_origen text, p_seller uuid, p_vendedor text
) returns raffle_orders language plpgsql security definer set search_path = public as $$
declare
  cfg     raffle_config;
  v_nums  int[];
  v_taken int[];
  v_order raffle_orders;
begin
  perform raffle_release_expired();

  select * into cfg from raffle_config where id = 1;
  if cfg.estado <> 'abierto' then raise exception 'SORTEO_CERRADO'; end if;
  if not coalesce(p_acepta, false) then raise exception 'TERMINOS'; end if;

  select array_agg(distinct n order by n) into v_nums from unnest(p_numbers) n where n is not null;
  if v_nums is null then raise exception 'SIN_NUMEROS'; end if;
  if cardinality(v_nums) > cfg.max_por_pedido then raise exception 'MAXIMO:%', cfg.max_por_pedido; end if;

  p_nombre  := regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  p_dni     := upper(regexp_replace(coalesce(p_dni, ''), '[^0-9A-Za-z]', '', 'g'));
  p_celular := regexp_replace(coalesce(p_celular, ''), '\D', '', 'g');
  if p_celular ~ '^519[0-9]{8}$' then p_celular := substr(p_celular, 3); end if;
  p_email   := nullif(lower(btrim(coalesce(p_email, ''))), '');

  if char_length(p_nombre) < 3 or p_nombre !~ '\s' then raise exception 'NOMBRE'; end if;
  if p_dni !~ '^[0-9A-Z]{8,12}$' then raise exception 'DNI'; end if;
  if p_celular !~ '^9[0-9]{8}$' then raise exception 'CELULAR'; end if;
  if p_email is not null and p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'EMAIL'; end if;

  -- Bloqueo de filas en orden fijo: dos compras simultáneas del mismo número
  -- se encolan aquí y la segunda ve el número ya tomado.
  perform 1 from raffle_tickets where number = any(v_nums) order by number for update;

  select array_agg(n order by n) into v_taken
    from unnest(v_nums) n
   where not exists (select 1 from raffle_tickets t where t.number = n and t.status = 'available');
  if v_taken is not null then
    raise exception 'NO_DISPONIBLES:%', array_to_string(v_taken, ',');
  end if;

  insert into raffle_orders (nombre_completo, dni, celular, email, cantidad, monto_total,
                             acepta_terminos, origen, seller_id, vendedor, reserved_until)
  values (p_nombre, p_dni, p_celular, p_email, cardinality(v_nums),
          cardinality(v_nums) * cfg.precio_ticket, true, p_origen, p_seller, p_vendedor,
          now() + make_interval(mins => cfg.minutos_reserva))
  returning * into v_order;

  update raffle_tickets
     set status = 'reserved', order_id = v_order.id, reserved_until = v_order.reserved_until
   where number = any(v_nums);

  return v_order;
end $$;

create or replace function public.raffle_approve_internal(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  o raffle_orders;
  t record;
  n int;
begin
  select * into o from raffle_orders where id = p_order for update;
  if not found then raise exception 'PEDIDO_NO_EXISTE'; end if;
  if o.status <> 'pending' then raise exception 'PEDIDO_NO_PENDIENTE'; end if;

  select count(*) into n from raffle_tickets
   where order_id = p_order and status in ('reserved','pending_payment');
  if n <> o.cantidad then raise exception 'TICKETS_LIBERADOS'; end if;

  for t in select number from raffle_tickets where order_id = p_order order by number for update loop
    update raffle_tickets
       set status = 'paid', paid_at = now(), reserved_until = null, ticket_code = raffle_new_code()
     where number = t.number;
  end loop;

  update raffle_orders
     set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), reserved_until = null,
         payment_submitted_at = coalesce(payment_submitted_at, now())
   where id = p_order;
end $$;

-- Continúa en sorteo_rpc.sql (RPC, permisos, storage, realtime y datos iniciales).
