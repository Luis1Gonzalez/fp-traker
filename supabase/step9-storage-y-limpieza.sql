-- Ejecutar en el SQL Editor de Supabase.

-- 1) La limpieza de tareas terminadas (+15 días) pasa a hacerse desde la app,
--    porque borrar filas por SQL no borra las fotos de Storage (quedan huérfanas).
--    Se desprograma el job de pg_cron.
select cron.unschedule('limpiar_tareas_terminadas_diario')
where exists (select 1 from cron.job where jobname = 'limpiar_tareas_terminadas_diario');

drop function if exists limpiar_tareas_terminadas();

-- 2) Límites del bucket de fotos: 10 MB y solo imágenes.
--    Debe coincidir con MAX_FOTO_BYTES / EXT_POR_MIME de src/lib/fotos.js.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'tarea-fotos';
