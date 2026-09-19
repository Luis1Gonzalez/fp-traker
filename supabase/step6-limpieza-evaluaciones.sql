-- Ejecutar en el SQL Editor de Supabase

create or replace function limpiar_evaluaciones_antiguas()
returns void
language sql
as $$
  delete from evaluaciones
  where fecha < (now() - interval '1 year');
$$;

select cron.schedule(
  'limpiar_evaluaciones_antiguas_diario',
  '0 4 * * *',
  $$ select limpiar_evaluaciones_antiguas(); $$
);
