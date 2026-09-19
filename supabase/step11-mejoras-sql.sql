-- Ejecutar en el SQL Editor de Supabase. Es idempotente y va en una transacción:
-- si algo falla, no se aplica nada.
-- Requiere PostgreSQL 15+ (Supabase lo cumple): security_invoker y "set null (columna)".

begin;

-- ------------------------------------------------------------
-- 1) Índices en las claves foráneas a asignaturas
--    (borrar una asignatura o filtrar por ella recorría la tabla entera)
-- ------------------------------------------------------------
create index if not exists idx_tareas_asignatura on tareas(asignatura_id);
create index if not exists idx_apuntes_asignatura on apuntes(asignatura_id);
create index if not exists idx_evaluaciones_asignatura on evaluaciones(asignatura_id);
create index if not exists idx_horario_asignatura on horario(asignatura_id);
create index if not exists idx_invitaciones_creado_por on invitaciones(creado_por);

-- ------------------------------------------------------------
-- 2) La vista de promedios respeta las RLS de quien la consulta
--    (sin esto se ejecuta con los permisos de su dueño y salta la RLS)
-- ------------------------------------------------------------
alter view v_promedio_por_asignatura set (security_invoker = true);

-- ------------------------------------------------------------
-- 3) Una clase no puede acabar antes de empezar
-- ------------------------------------------------------------
alter table horario drop constraint if exists horario_hora_valida;
alter table horario add constraint horario_hora_valida check (hora_fin > hora_inicio);

-- ------------------------------------------------------------
-- 4) Una fila solo puede colgar de una asignatura del MISMO usuario.
--    Antes bastaba con conocer el UUID de una asignatura ajena.
--    Se hace con una clave foránea compuesta (asignatura_id, user_id).
-- ------------------------------------------------------------
-- Primero se sueltan todas las claves foráneas (las originales y las compuestas de
-- una ejecución anterior); la restricción única no se puede borrar mientras
-- alguna dependa de ella.
alter table tareas drop constraint if exists tareas_asignatura_id_fkey;
alter table tareas drop constraint if exists tareas_asignatura_user_fkey;
alter table evaluaciones drop constraint if exists evaluaciones_asignatura_id_fkey;
alter table evaluaciones drop constraint if exists evaluaciones_asignatura_user_fkey;
alter table horario drop constraint if exists horario_asignatura_id_fkey;
alter table horario drop constraint if exists horario_asignatura_user_fkey;
alter table apuntes drop constraint if exists apuntes_asignatura_id_fkey;
alter table apuntes drop constraint if exists apuntes_asignatura_user_fkey;

alter table asignaturas drop constraint if exists asignaturas_id_user_key;
alter table asignaturas add constraint asignaturas_id_user_key unique (id, user_id);

alter table tareas add constraint tareas_asignatura_user_fkey
  foreign key (asignatura_id, user_id) references asignaturas(id, user_id) on delete cascade;

alter table evaluaciones add constraint evaluaciones_asignatura_user_fkey
  foreign key (asignatura_id, user_id) references asignaturas(id, user_id) on delete cascade;

alter table horario add constraint horario_asignatura_user_fkey
  foreign key (asignatura_id, user_id) references asignaturas(id, user_id) on delete cascade;

-- Apuntes: la asignatura es opcional y al borrarla solo se anula asignatura_id
-- (user_id no puede anularse, por eso "set null (asignatura_id)").
alter table apuntes add constraint apuntes_asignatura_user_fkey
  foreign key (asignatura_id, user_id) references asignaturas(id, user_id)
  on delete set null (asignatura_id);

commit;
