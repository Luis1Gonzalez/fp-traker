-- Ejecutar en el SQL Editor de Supabase.
-- El token ahora se consume dentro de la Edge Function "registro" (con service key),
-- así que ya no hace falta exponer consumir_invitacion al cliente.

drop function if exists consumir_invitacion(uuid, uuid);

-- validar_invitacion sigue siendo pública (la usa la pantalla de registro para
-- avisar pronto si el enlace no sirve), pero con search_path fijo.
create or replace function validar_invitacion(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_valida boolean;
begin
  select true into v_valida
  from public.invitaciones
  where token = p_token
    and usado_at is null
    and revocado_at is null
    and expira_at > now();
  return coalesce(v_valida, false);
end;
$$;

revoke all on function validar_invitacion(uuid) from public;
grant execute on function validar_invitacion(uuid) to anon, authenticated;
