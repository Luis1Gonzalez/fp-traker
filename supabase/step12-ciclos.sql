-- Ejecutar en el SQL Editor de Supabase. Es idempotente y va en una transacción.
-- Plantillas de asignaturas + horario por ciclo. Una invitación puede llevar un
-- ciclo: al registrarse con ella, la cuenta nueva recibe esa plantilla ya cargada.

begin;

-- ------------------------------------------------------------
-- 1) Ciclos y sus plantillas
-- ------------------------------------------------------------
create table if not exists ciclos (
  id text primary key,                 -- código corto, p. ej. '1MST'
  nombre text not null,
  created_at timestamptz not null default now()
);

create table if not exists ciclo_asignaturas (
  id uuid primary key default gen_random_uuid(),
  ciclo_id text not null references ciclos(id) on delete cascade,
  nombre text not null,
  profesor text,
  color text not null default '#2B4C6F',
  constraint ciclo_asignaturas_ciclo_nombre_key unique (ciclo_id, nombre)
);

create table if not exists ciclo_horario (
  id uuid primary key default gen_random_uuid(),
  ciclo_id text not null,
  asignatura_nombre text not null,
  dia_semana smallint not null check (dia_semana between 1 and 5), -- 1=lunes ... 5=viernes
  hora_inicio time not null,
  hora_fin time not null,
  aula text,
  constraint ciclo_horario_hora_valida check (hora_fin > hora_inicio),
  constraint ciclo_horario_asignatura_fkey
    foreign key (ciclo_id, asignatura_nombre)
    references ciclo_asignaturas(ciclo_id, nombre) on delete cascade
);

create index if not exists idx_ciclo_horario_ciclo on ciclo_horario(ciclo_id);

-- Solo los administradores ven la lista de ciclos (la usa la pantalla Invitar).
-- Las plantillas no tienen políticas: nadie las lee desde la app; solo las usan
-- las funciones de abajo.
alter table ciclos enable row level security;
alter table ciclo_asignaturas enable row level security;
alter table ciclo_horario enable row level security;

drop policy if exists "ciclos_admin_select" on ciclos;
create policy "ciclos_admin_select" on ciclos for select using (es_admin());

-- ------------------------------------------------------------
-- 2) La invitación indica qué ciclo cargar (opcional)
-- ------------------------------------------------------------
alter table invitaciones add column if not exists ciclo_id text;

alter table invitaciones drop constraint if exists invitaciones_ciclo_id_fkey;
alter table invitaciones add constraint invitaciones_ciclo_id_fkey
  foreign key (ciclo_id) references ciclos(id) on delete set null;

-- ------------------------------------------------------------
-- 3) Copiar la plantilla a un usuario nuevo (la llama la Edge Function "registro")
--    Si el usuario ya tiene asignaturas no hace nada, para no duplicar.
-- ------------------------------------------------------------
create or replace function cargar_plantilla_ciclo(p_user_id uuid, p_ciclo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.asignaturas where user_id = p_user_id) then
    return;
  end if;

  insert into public.asignaturas (user_id, nombre, profesor, color)
  select p_user_id, nombre, profesor, color
  from public.ciclo_asignaturas
  where ciclo_id = p_ciclo;

  insert into public.horario (user_id, asignatura_id, dia_semana, hora_inicio, hora_fin, aula)
  select p_user_id, a.id, h.dia_semana, h.hora_inicio, h.hora_fin, h.aula
  from public.ciclo_horario h
  join public.asignaturas a on a.user_id = p_user_id and a.nombre = h.asignatura_nombre
  where h.ciclo_id = p_ciclo;
end;
$$;

-- ------------------------------------------------------------
-- 4) Crear o actualizar la plantilla de un ciclo a partir de los datos reales
--    de un usuario (tus asignaturas y tu horario). Solo se usa desde el SQL Editor.
--    Si el ciclo ya existía, su plantilla se sustituye por completo.
-- ------------------------------------------------------------
create or replace function crear_plantilla_desde_usuario(p_ciclo text, p_nombre text, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_asig integer;
  v_hor integer;
begin
  select id into v_user from auth.users where email = p_email;
  if v_user is null then
    raise exception 'No existe un usuario con el correo %', p_email;
  end if;

  insert into public.ciclos (id, nombre) values (p_ciclo, p_nombre)
  on conflict (id) do update set nombre = excluded.nombre;

  delete from public.ciclo_asignaturas where ciclo_id = p_ciclo; -- su horario cae en cascada

  insert into public.ciclo_asignaturas (ciclo_id, nombre, profesor, color)
  select p_ciclo, nombre, profesor, color
  from public.asignaturas
  where user_id = v_user;
  get diagnostics v_asig = row_count;

  insert into public.ciclo_horario (ciclo_id, asignatura_nombre, dia_semana, hora_inicio, hora_fin, aula)
  select p_ciclo, a.nombre, h.dia_semana, h.hora_inicio, h.hora_fin, h.aula
  from public.horario h
  join public.asignaturas a on a.id = h.asignatura_id
  where h.user_id = v_user;
  get diagnostics v_hor = row_count;

  return format('Plantilla %s guardada: %s asignaturas y %s clases.', p_ciclo, v_asig, v_hor);
end;
$$;

-- Ninguna de las dos debe poder llamarse desde la app.
revoke all on function cargar_plantilla_ciclo(uuid, text) from public, anon, authenticated;
grant execute on function cargar_plantilla_ciclo(uuid, text) to service_role;
revoke all on function crear_plantilla_desde_usuario(text, text, text) from public, anon, authenticated;

commit;
