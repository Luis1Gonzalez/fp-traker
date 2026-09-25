-- Ejecutar en el SQL Editor de Supabase.
-- Corrige las aulas mal cargadas originalmente (se habían usado por error
-- unos códigos que no eran las aulas reales). Cada asignatura usa siempre la
-- misma aula en todas sus clases de la semana, según el horario oficial.

update horario h
set aula = x.aula_correcta
from asignaturas a
join (values
  ('Ejecución de procesos de fabricación', 'T31 - Mecanizado'),
  ('Verificación de productos', 'T41'),
  ('Itinerario personal empleabilidad I', '128'),
  ('Interpretación gráfica', 'T23'),
  ('Gestión de la Calidad, PRL y Protección ambiental', '128'),
  ('Definición de procesos de mecanizado, conformado y montaje', '128'),
  ('Digitalización aplicada a los sectores productivos (GS)', '128'),
  ('Inglés profesional', '128')
) as x(nombre, aula_correcta) on a.nombre = x.nombre
where h.asignatura_id = a.id
  and a.user_id = (select id from auth.users where email = 'luis1gonzalez@hotmail.com');

-- Comprobación: debe mostrar 8 filas, cada una con su aula ya corregida.
select a.nombre, h.aula
from horario h
join asignaturas a on a.id = h.asignatura_id
where a.user_id = (select id from auth.users where email = 'luis1gonzalez@hotmail.com')
group by a.nombre, h.aula
order by a.nombre;
