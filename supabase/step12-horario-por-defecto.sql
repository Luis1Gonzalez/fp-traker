-- Ejecutar en el SQL Editor de Supabase. Es idempotente y va en una transacción.
-- Toda cuenta nueva (registrada por invitación) recibe una copia de las
-- asignaturas y el horario de una cuenta de referencia (la tuya).

begin;

-- ------------------------------------------------------------
-- Fila única de configuración: de quién se copia el horario por defecto.
-- ------------------------------------------------------------
create table if not exists configuracion (
  id boolean primary key default true,
  horario_origen uuid references auth.users(id) on delete set null,
  constraint configuracion_singleton check (id)
);

-- Nadie la lee desde la app (ni siquiera un admin); solo la usa la función de
-- abajo, que se ejecuta con privilegios propios y no pasa por RLS.
alter table configuracion enable row level security;

insert into configuracion (id, horario_origen)
select true, id from auth.users where email = 'luis1gonzalez@hotmail.com'
on conflict (id) do update set horario_origen = excluded.horario_origen;

-- ------------------------------------------------------------
-- Copia el horario por defecto a un usuario nuevo (la llama la Edge Function
-- "registro", con la clave secreta). Si el usuario ya tiene asignaturas, si no
-- hay origen configurado, o si el usuario ES el origen, no hace nada.
-- ------------------------------------------------------------
create or replace function cargar_horario_por_defecto(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origen uuid;
begin
  select horario_origen into v_origen from public.configuracion where id = true;

  if v_origen is null or v_origen = p_user_id then
    return;
  end if;
  if exists (select 1 from public.asignaturas where user_id = p_user_id) then
    return;
  end if;

  insert into public.asignaturas (user_id, nombre, profesor, color)
  select p_user_id, nombre, profesor, color
  from public.asignaturas
  where user_id = v_origen;

  insert into public.horario (user_id, asignatura_id, dia_semana, hora_inicio, hora_fin, aula)
  select p_user_id, a_new.id, h.dia_semana, h.hora_inicio, h.hora_fin, h.aula
  from public.horario h
  join public.asignaturas a_old on a_old.id = h.asignatura_id and a_old.user_id = v_origen
  join public.asignaturas a_new on a_new.user_id = p_user_id and a_new.nombre = a_old.nombre
  where h.user_id = v_origen;
end;
$$;

revoke all on function cargar_horario_por_defecto(uuid) from public, anon, authenticated;
grant execute on function cargar_horario_por_defecto(uuid) to service_role;

commit;
