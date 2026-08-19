-- ============================================================
-- APEX PRO — Supabase Schema + Seeds
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Extensión UUID
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLAS
-- ============================================================

create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_salary numeric not null,
  weekly_hours numeric not null default 48,
  active boolean not null default true,
  hire_date date,
  role text not null default 'worker', -- 'admin' | 'worker'
  created_at timestamptz default now()
);

create table if not exists salary_history (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references workers(id) on delete cascade,
  base_salary numeric not null,
  weekly_hours numeric not null,
  effective_date date not null,
  created_at timestamptz default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null, -- 'basico' | 'ceramico' | 'polarizado' | 'ppf'
  min_price numeric not null,
  max_price numeric not null,
  margin_percent numeric not null default 85,
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists monthly_costs (
  id uuid primary key default gen_random_uuid(),
  month integer not null,
  year integer not null,
  rent numeric not null default 2700,
  supplies numeric not null default 800,
  utility_goal numeric not null default 2000,
  created_at timestamptz default now(),
  unique(month, year)
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  worker_id uuid references workers(id) on delete set null,
  service_id uuid references services(id) on delete set null,
  price_charged numeric not null,
  vehicle_type text not null default 'auto', -- 'auto' | 'suv' | 'camioneta' | 'pickup'
  payment_method text not null default 'efectivo', -- 'efectivo' | 'yape'
  notes text,
  created_at timestamptz default now()
);

create table if not exists daily_summary (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  total_income numeric not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists attendance_incidents (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references workers(id) on delete cascade,
  date date not null,
  type text not null, -- 'falta' | 'permiso' | 'tardanza'
  hours_late numeric not null default 0,
  discount_amount numeric not null default 0,
  apply_discount boolean not null default true,
  observation text,
  created_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  worker_id uuid references workers(id) on delete set null,
  role text not null default 'worker' -- 'admin' | 'worker'
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table workers enable row level security;
alter table services enable row level security;
alter table tickets enable row level security;
alter table daily_summary enable row level security;
alter table attendance_incidents enable row level security;
alter table monthly_costs enable row level security;
alter table salary_history enable row level security;
alter table profiles enable row level security;

-- Helper: obtener rol del usuario actual
create or replace function get_my_role()
returns text as $$
  select role from profiles where id = auth.uid()
$$ language sql security definer;

-- Helper: obtener worker_id del usuario actual
create or replace function get_my_worker_id()
returns uuid as $$
  select worker_id from profiles where id = auth.uid()
$$ language sql security definer;

-- Workers: admin ve todos, worker solo se ve a sí mismo
create policy "workers_select" on workers for select using (
  get_my_role() = 'admin' or id = get_my_worker_id()
);
create policy "workers_insert" on workers for insert with check (get_my_role() = 'admin');
create policy "workers_update" on workers for update using (get_my_role() = 'admin');

-- Services: todos pueden ver, solo admin edita
create policy "services_select" on services for select using (true);
create policy "services_insert" on services for insert with check (get_my_role() = 'admin');
create policy "services_update" on services for update using (get_my_role() = 'admin');

-- Tickets: admin ve todos, worker solo los suyos
create policy "tickets_select" on tickets for select using (
  get_my_role() = 'admin' or worker_id = get_my_worker_id()
);
create policy "tickets_insert" on tickets for insert with check (get_my_role() = 'admin');
create policy "tickets_update" on tickets for update using (get_my_role() = 'admin');
create policy "tickets_delete" on tickets for delete using (get_my_role() = 'admin');

-- Daily summary: solo admin
create policy "daily_summary_all" on daily_summary for all using (get_my_role() = 'admin');

-- Incidents: admin ve todas, worker solo las suyas
create policy "incidents_select" on attendance_incidents for select using (
  get_my_role() = 'admin' or worker_id = get_my_worker_id()
);
create policy "incidents_insert" on attendance_incidents for insert with check (get_my_role() = 'admin');
create policy "incidents_update" on attendance_incidents for update using (get_my_role() = 'admin');
create policy "incidents_delete" on attendance_incidents for delete using (get_my_role() = 'admin');

-- Monthly costs: solo admin
create policy "monthly_costs_all" on monthly_costs for all using (get_my_role() = 'admin');

-- Salary history: solo admin
create policy "salary_history_all" on salary_history for all using (get_my_role() = 'admin');

-- Profiles: cada usuario solo ve el suyo (admin ve todos)
create policy "profiles_select" on profiles for select using (
  id = auth.uid() or get_my_role() = 'admin'
);

-- ============================================================
-- SEEDS — TRABAJADORES INICIALES
-- ============================================================

insert into workers (name, base_salary, weekly_hours, active, hire_date, role) values
  ('Gustavo',  2000, 48, true, '2023-01-01', 'admin'),
  ('Elías',    1850, 48, true, '2023-01-01', 'worker'),
  ('Josué',    1650, 33, true, '2023-03-01', 'worker'),
  ('Isaac',    1430, 48, true, '2023-02-01', 'worker'),
  ('Gabriela', 1400, 33, true, '2023-04-01', 'worker')
on conflict do nothing;

-- ============================================================
-- SEEDS — CATÁLOGO DE SERVICIOS
-- ============================================================

insert into services (name, category, min_price, max_price, margin_percent) values
  -- Básicos / Mid-tier (85%)
  ('Descontaminación química',    'basico',    60,   80,  85),
  ('Descontaminación mecánica',   'basico',   120,  160,  85),
  ('Abrillantado Apex Pro',       'basico',   130,  170,  85),
  ('Corrección de pintura',       'basico',   260,  300,  85),
  -- Cerámicos (45%)
  ('Cerámico Miyavi 1 año',       'ceramico', 350,  450,  45),
  ('Cerámico Meguiars 1 año',     'ceramico', 400,  500,  45),
  ('Cerámico AutoPremium 3 años', 'ceramico', 599,  799,  45),
  ('Cerámico CarPro 2 años',      'ceramico', 899, 1099,  45),
  ('Cerámico CarPro 3 años',      'ceramico', 999, 1199,  45),
  -- Polarizados (45%)
  ('APPfilm Basic',               'polarizado', 299,  350, 45),
  ('Nanocerámica Lexen',          'polarizado', 440,  640, 45),
  ('Nanocerámica Protec',         'polarizado', 480,  680, 45),
  ('Nanocerámica 3M Coreano',     'polarizado', 700,  900, 45),
  ('3M Original certificado',     'polarizado',1400, 1400, 45),
  -- PPF (45%)
  ('PPF Zonas de impacto (auto)',              'ppf', 2700, 2700, 45),
  ('PPF Zonas de impacto (SUV)',               'ppf', 3100, 3100, 45),
  ('PPF Zonas de impacto (camioneta 3 filas)', 'ppf', 3400, 3400, 45),
  ('PPF Zonas + Cerámico (auto)',              'ppf', 3200, 3200, 45),
  ('PPF Full Body (auto)',                     'ppf', 4700, 4700, 45),
  ('PPF Full Body (SUV)',                      'ppf', 5400, 5400, 45),
  ('PPF Full Body (camioneta)',                'ppf', 5900, 5900, 45)
on conflict do nothing;

-- ============================================================
-- SEED — COSTOS FIJOS MES ACTUAL
-- ============================================================

insert into monthly_costs (month, year, rent, supplies, utility_goal)
values (
  extract(month from current_date)::int,
  extract(year from current_date)::int,
  2700, 800, 2000
) on conflict (month, year) do nothing;

-- ============================================================
-- METAS DE SERVICIOS — AVANCE DEL EQUIPO
-- ============================================================
-- Los trabajadores solo pueden leer sus propios tickets (RLS), así que el
-- avance del equipo llega por esta función, que devuelve lo mínimo para contar
-- metas: fecha, tipo de vehículo y nombres de los adicionales. Sin precios,
-- placas ni datos del cliente.

create or replace function public.metas_tickets_mes(p_prefix text)
returns table (
  fecha date,
  vehicle_type text,
  vehicle_subtype text,
  extras_names text[],
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.date,
    coalesce(t.vehicle_type, ''),
    coalesce(t.vehicle_subtype, ''),
    coalesce(
      array(select e->>'name' from jsonb_array_elements(coalesce(t.extras, '[]'::jsonb)) e),
      '{}'::text[]
    ),
    coalesce(t.status, 'cerrado')
  from public.tickets t
  where to_char(t.date, 'YYYY-MM') = p_prefix;
$$;

revoke all on function public.metas_tickets_mes(text) from public;
grant execute on function public.metas_tickets_mes(text) to authenticated;

-- ============================================================
-- FIDELIZACIÓN — tarjeta virtual de sellos por placa
-- ============================================================
-- El cliente entra a /fidelidad (público, sin login) con su placa y un PIN de
-- 4 dígitos. Los sellos se cuentan solos: 1 ticket cerrado de esa placa = 1
-- sello. Los niveles de premio y las promos se editan desde /clientes y viven
-- en app_settings.key = 'fidelidad'.
--
-- Toda la lectura pública pasa por funciones security definer, así que el
-- visitante nunca toca las tablas: no puede ver precios, gastos ni las placas
-- de los demás.

alter table public.vehicle_clients
  add column if not exists pin         text,
  add column if not exists stamps_used integer not null default 0,  -- sellos ya consumidos por tarjetas completadas
  add column if not exists cycle_index integer not null default 0,  -- número de tarjeta actual
  add column if not exists updated_at  timestamptz default now();

-- Placa normalizada: "ABC-123", "abc123" y "ABC 123" son el mismo cliente.
alter table public.vehicle_clients
  add column if not exists plate_norm text
  generated always as (upper(regexp_replace(coalesce(plate,''), '[^A-Za-z0-9]', '', 'g'))) stored;

create unique index if not exists vehicle_clients_plate_norm_idx on public.vehicle_clients (plate_norm);

create table if not exists public.loyalty_redemptions (
  id           uuid primary key default gen_random_uuid(),
  plate_norm   text not null,
  plate        text not null,
  tier_stamps  integer not null,
  reward_label text not null default '',
  pct          numeric not null default 0,
  cycle_index  integer not null default 0,
  note         text,
  redeemed_at  timestamptz not null default now()
);

create index if not exists loyalty_redemptions_plate_idx on public.loyalty_redemptions (plate_norm, cycle_index);

alter table public.loyalty_redemptions enable row level security;

create policy vehicle_clients_auth on public.vehicle_clients
  for all to authenticated using (true) with check (true);
create policy loyalty_redemptions_auth on public.loyalty_redemptions
  for all to authenticated using (true) with check (true);

-- Funciones: loyalty_config, loyalty_public_config, loyalty_card,
-- loyalty_activate y loyalty_redeem. El cuerpo completo está en la migración
-- `loyalty_program` ya aplicada en Supabase (Dashboard > Database > Migrations).

-- ============================================================
-- FIDELIZACIÓN DESDE EL TALLER
-- ============================================================
-- Dentro del ticket se ven las visitas de la placa y se cobra el bono. El que
-- mira ya inició sesión, así que estas funciones no piden PIN; siguen siendo
-- security definer para que un trabajador no necesite leer vehicle_clients ni
-- los tickets de otros.
--
--   loyalty_card_staff(placa)      → tarjeta de una placa (sellos, ciclo, canjes)
--   loyalty_cards_staff(placas[])  → lo mismo para varias placas de un saque,
--                                    lo usa la lista de tickets del día
--   loyalty_redeem_staff(placa, nivel, nota)
--                                  → registra el canje; si la placa no tiene
--                                    ficha de cliente la crea, porque el que
--                                    nunca activó su tarjeta igual tiene bono.
--                                    Al canjear el nivel más alto la tarjeta se
--                                    reinicia (stamps_used += ciclo, cycle_index++).
--
-- El cuerpo completo está en las migraciones `loyalty_staff_lookup` y
-- `loyalty_redeem_staff`, ya aplicadas en Supabase.
