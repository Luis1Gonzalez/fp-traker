-- Ejecutar en el SQL Editor de Supabase.
-- Solo los administradores pueden crear/gestionar invitaciones.

create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table admins enable row level security;

-- Cada usuario solo puede ver si él mismo es admin. No hay políticas de
-- insert/update/delete: los admins se gestionan únicamente desde el SQL Editor.
drop policy if exists "admins_select_propio" on admins;
create policy "admins_select_propio" on admins
  for select using (auth.uid() = user_id);

create or replace function es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function es_admin() from public;
grant execute on function es_admin() to authenticated;

-- Sustituye la política anterior (cualquier usuario podía invitar).
drop policy if exists "invitaciones_owner" on invitaciones;
drop policy if exists "invitaciones_admin" on invitaciones;
create policy "invitaciones_admin" on invitaciones
  for all
  using (es_admin() and auth.uid() = creado_por)
  with check (es_admin() and auth.uid() = creado_por);

-- Primer administrador. Cambia el correo si hace falta.
insert into admins (user_id)
select id from auth.users where email = 'TU_CORREO@ejemplo.com'
on conflict do nothing;

-- Comprobación: debe devolver 1 fila.
select a.user_id, u.email from admins a join auth.users u on u.id = a.user_id;
