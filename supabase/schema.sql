-- ============================================================
-- FP TRACKER — Esquema base
-- Ejecutar en el SQL Editor de Supabase, en una base NUEVA y en este orden:
--   schema.sql, step5, step6, step7, step8, step9, step10, step11
-- (step7b es opcional: carga datos personales del horario).
-- NO volver a ejecutar sobre una base existente: recrearía piezas que los pasos
-- 8-10 eliminaron o reemplazaron (consumir_invitacion, el cron de tareas y la
-- política de invitaciones).
-- ============================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_cron;    -- limpieza automática de tareas

-- ------------------------------------------------------------
-- ASIGNATURAS
-- ------------------------------------------------------------
create table if not exists asignaturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  profesor text,
  color text not null default '#2B4C6F',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TAREAS
-- estado: pendiente | terminada
-- terminada_at: se rellena al pulsar "Terminar"; usado para el
--   borrado automático a los 15 días.
-- comentario: nota libre opcional -> dispara el aviso amarillo en la card.
-- ------------------------------------------------------------
create table if not exists tareas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asignatura_id uuid not null references asignaturas(id) on delete cascade,
  titulo text not null,
  descripcion text,
  comentario text,
  fecha_entrega date,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'terminada')),
  terminada_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_tareas_user on tareas(user_id);
create index if not exists idx_tareas_estado_terminada on tareas(estado, terminada_at);

-- ------------------------------------------------------------
-- APUNTES
-- Notas personales, con o sin asignatura. Estado útil/inútil.
-- Si calendarizado = true, fecha/hora son obligatorias en la app
--   (a nivel de constraint solo exigimos que si hay fecha, haya calendarizado=true).
-- color_calendario: color random asignado al crearlo, para pintarlo en el calendario.
-- ------------------------------------------------------------
create table if not exists apuntes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asignatura_id uuid references asignaturas(id) on delete set null,
  titulo text not null,
  contenido text,
  estado text not null default 'util' check (estado in ('util', 'inutil')),
  calendarizado boolean not null default false,
  fecha date,
  hora time,
  color_calendario text,
  created_at timestamptz not null default now(),
  constraint apuntes_fecha_requiere_calendarizado
    check (not calendarizado or fecha is not null)
);

create index if not exists idx_apuntes_user on apuntes(user_id);
create index if not exists idx_apuntes_calendarizado on apuntes(calendarizado, fecha);

-- ------------------------------------------------------------
-- EVALUACIONES
-- Cada nota se colorea individualmente (>=5 aprobada/verde, <5 reprobada/rojo).
-- Sin promedio acumulado a nivel de BD; el promedio de la vista resumen
--   se calcula en el cliente (o con una vista, ver abajo).
-- ------------------------------------------------------------
create table if not exists evaluaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asignatura_id uuid not null references asignaturas(id) on delete cascade,
  titulo text not null,
  evaluado text,              -- qué se evaluó (ej: "Unidad 3 - Torneado")
  fecha date not null,
  hora time,
  nota numeric(4,2) check (nota >= 0 and nota <= 10),
  created_at timestamptz not null default now()
);

create index if not exists idx_evaluaciones_user on evaluaciones(user_id);
create index if not exists idx_evaluaciones_fecha on evaluaciones(fecha);

-- Vista de promedio por asignatura (la usa la pestaña resumen; el color
-- aprobado/reprobado por asignatura se calcula en el cliente con este promedio,
-- pero por ahora la UI solo pinta cada nota individual, no esta vista).
create or replace view v_promedio_por_asignatura as
select
  asignatura_id,
  user_id,
  round(avg(nota), 2) as promedio,
  count(*) as num_evaluaciones
from evaluaciones
where nota is not null
group by asignatura_id, user_id;

-- ------------------------------------------------------------
-- INVITACIONES (registro cerrado por QR de un solo uso)
-- token: va codificado en el QR / link de registro.
-- expira_at: se fija a created_at + 1 hora.
-- usado_at / revocado_at: cualquiera de los dos invalida el token.
-- ------------------------------------------------------------
create table if not exists invitaciones (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  creado_por uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expira_at timestamptz not null default (now() + interval '1 hour'),
  usado_at timestamptz,
  usado_por uuid references auth.users(id),
  revocado_at timestamptz
);

create index if not exists idx_invitaciones_token on invitaciones(token);

-- Función que valida un token en el momento del registro.
-- La llama el flujo de signup ANTES de crear el usuario en Supabase Auth.
create or replace function validar_invitacion(p_token uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_valida boolean;
begin
  select true into v_valida
  from invitaciones
  where token = p_token
    and usado_at is null
    and revocado_at is null
    and expira_at > now();
  return coalesce(v_valida, false);
end;
$$;

-- Función que marca el token como usado (llamarla justo tras crear la cuenta).
create or replace function consumir_invitacion(p_token uuid, p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update invitaciones
  set usado_at = now(), usado_por = p_user_id
  where token = p_token
    and usado_at is null
    and revocado_at is null
    and expira_at > now();
end;
$$;

-- ------------------------------------------------------------
-- LIMPIEZA AUTOMÁTICA: borra tareas terminadas hace más de 15 días.
-- pg_cron ejecuta esto todos los días a las 03:00 UTC.
-- ------------------------------------------------------------
create or replace function limpiar_tareas_terminadas()
returns void
language sql
as $$
  delete from tareas
  where estado = 'terminada'
    and terminada_at < now() - interval '15 days';
$$;

select cron.unschedule('limpiar_tareas_terminadas_diario')
where exists (select 1 from cron.job where jobname = 'limpiar_tareas_terminadas_diario');

select cron.schedule(
  'limpiar_tareas_terminadas_diario',
  '0 3 * * *',
  $$ select limpiar_tareas_terminadas(); $$
);

-- ============================================================
-- ROW LEVEL SECURITY — cada usuario ve y modifica solo lo suyo
-- ============================================================
alter table asignaturas enable row level security;
alter table tareas enable row level security;
alter table apuntes enable row level security;
alter table evaluaciones enable row level security;
alter table invitaciones enable row level security;

drop policy if exists "asignaturas_owner" on asignaturas;
create policy "asignaturas_owner" on asignaturas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tareas_owner" on tareas;
create policy "tareas_owner" on tareas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "apuntes_owner" on apuntes;
create policy "apuntes_owner" on apuntes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "evaluaciones_owner" on evaluaciones;
create policy "evaluaciones_owner" on evaluaciones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Invitaciones: solo el que las creó puede verlas/gestionarlas.
drop policy if exists "invitaciones_owner" on invitaciones;
create policy "invitaciones_owner" on invitaciones
  for all using (auth.uid() = creado_por) with check (auth.uid() = creado_por);
