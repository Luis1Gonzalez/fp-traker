-- Ejecutar en el SQL Editor de Supabase

create or replace function limpiar_evaluaciones_antiguas()
returns void
language sql
as $$
  delete from evaluaciones
  where fecha < (now() - interval '1 year');
$$;

select cron.unschedule('limpiar_evaluaciones_antiguas_diario')
where exists (select 1 from cron.job where jobname = 'limpiar_evaluaciones_antiguas_diario');

select cron.schedule(
  'limpiar_evaluaciones_antiguas_diario',
  '0 4 * * *',
  $$ select limpiar_evaluaciones_antiguas(); $$
);
