-- Ejecutar en el SQL Editor de Supabase. Es idempotente y va en una transacción.
-- Registro de ausencias por asignatura y fecha, con marca de justificada y
-- un motivo opcional. No hay límite de una por día: si un día tiene dos
-- clases seguidas de la misma asignatura (pasa en el horario real) y
-- faltaste a las dos, se registran como dos filas.

begin;

create table if not exists ausencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asignatura_id uuid not null,
  fecha date not null,
  justificada boolean not null default false,
  motivo text,
  created_at timestamptz not null default now()
);

-- Misma protección que tareas/evaluaciones/horario (step11): no se puede
-- enlazar una ausencia a una asignatura de otro usuario aunque se conozca su id.
alter table ausencias drop constraint if exists ausencias_asignatura_user_fkey;
alter table ausencias add constraint ausencias_asignatura_user_fkey
  foreign key (asignatura_id, user_id) references asignaturas(id, user_id) on delete cascade;

create index if not exists idx_ausencias_user on ausencias(user_id);
create index if not exists idx_ausencias_asignatura on ausencias(asignatura_id);

alter table ausencias enable row level security;

drop policy if exists "ausencias_owner" on ausencias;
create policy "ausencias_owner" on ausencias
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;
