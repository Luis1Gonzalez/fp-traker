-- Ejecutar en el SQL Editor de Supabase. Es idempotente y va en una transacción.
-- Sección "Classroom": conecta la cuenta de Google del usuario y guarda un
-- espejo de sus tareas y anuncios de Google Classroom, como una bandeja de
-- notificaciones aparte (no se mezcla con las tablas tareas/apuntes/evaluaciones).

begin;

-- ------------------------------------------------------------
-- Conexión con Google (un refresh_token por usuario). Nadie la lee ni la
-- escribe desde la app directamente (ni siquiera su dueño): solo la tocan las
-- Edge Functions, con la service key. El estado se consulta con
-- classroom_estado(), que no expone el token.
-- ------------------------------------------------------------
create table if not exists classroom_conexiones (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text,
  refresh_token text not null,
  conectado_at timestamptz not null default now(),
  ultima_sincronizacion timestamptz
);

alter table classroom_conexiones enable row level security;

-- ------------------------------------------------------------
-- Espejo de tareas y anuncios importados. google_id es el id del recurso en
-- Classroom (compartido por todos los alumnos del curso); la clave única va
-- con user_id para que cada alumno tenga su propia copia sin chocar entre sí.
-- ------------------------------------------------------------
create table if not exists classroom_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_id text not null,
  curso_id text not null,
  curso_nombre text not null,
  tipo text not null check (tipo in ('tarea', 'anuncio')),
  titulo text not null,
  descripcion text,
  fecha_entrega date,
  publicado_at timestamptz not null,
  leido boolean not null default false,
  creado_en timestamptz not null default now(),
  constraint classroom_items_user_google_key unique (user_id, google_id)
);

create index if not exists idx_classroom_items_user on classroom_items(user_id, publicado_at desc);

alter table classroom_items enable row level security;

drop policy if exists "classroom_items_owner" on classroom_items;
create policy "classroom_items_owner" on classroom_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Estado de la conexión (conectado o no, con qué correo, cuándo sincronizó
-- por última vez), sin exponer el refresh_token.
-- ------------------------------------------------------------
create or replace function classroom_estado()
returns table(conectado boolean, google_email text, ultima_sincronizacion timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select (c.user_id is not null), c.google_email, c.ultima_sincronizacion
  from (select auth.uid() as uid) u
  left join public.classroom_conexiones c on c.user_id = u.uid;
$$;

revoke all on function classroom_estado() from public;
grant execute on function classroom_estado() to authenticated;

commit;
