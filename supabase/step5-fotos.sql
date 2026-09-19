-- Ejecutar en el SQL Editor de Supabase (después del schema.sql inicial)

-- Columna para guardar la ruta del archivo en Storage
alter table tareas add column if not exists foto_path text;

-- Bucket privado para las fotos de tareas
insert into storage.buckets (id, name, public)
values ('tarea-fotos', 'tarea-fotos', false)
on conflict (id) do nothing;

-- Cada usuario solo puede leer/escribir dentro de su propia carpeta
-- (la carpeta es su user_id, la app se encarga de eso al subir el archivo)
create policy "tarea_fotos_select_owner" on storage.objects
  for select using (bucket_id = 'tarea-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "tarea_fotos_insert_owner" on storage.objects
  for insert with check (bucket_id = 'tarea-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "tarea_fotos_update_owner" on storage.objects
  for update using (bucket_id = 'tarea-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "tarea_fotos_delete_owner" on storage.objects
  for delete using (bucket_id = 'tarea-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
