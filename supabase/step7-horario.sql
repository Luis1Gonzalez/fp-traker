-- Ejecutar en el SQL Editor de Supabase

create table if not exists horario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asignatura_id uuid not null references asignaturas(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 1 and 5), -- 1=lunes ... 5=viernes
  hora_inicio time not null,
  hora_fin time not null,
  aula text,
  created_at timestamptz not null default now()
);

create index if not exists idx_horario_user on horario(user_id);
create index if not exists idx_horario_dia on horario(dia_semana, hora_inicio);

alter table horario enable row level security;

drop policy if exists "horario_owner" on horario;
create policy "horario_owner" on horario
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
