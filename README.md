# FP Tracker

App personal para llevar el ciclo de FP: tareas (con foto), apuntes, evaluaciones y notas, calendario y horario de clases. React + Vite + Tailwind, con Supabase (Postgres, Auth, Storage y Edge Functions).

El registro es **cerrado**: solo se entra por invitación (QR de un solo uso) creada por un administrador.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y rellena los dos valores
npm run dev            # http://localhost:5173
```

Variables de `.env` (Supabase → Project Settings → API):

| Variable | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clave publicable (`sb_publishable_…`) |

Nunca pongas la `service_role` en el frontend ni en `.env`.

## Base de datos

En el SQL Editor de Supabase, sobre un proyecto **nuevo** y en este orden (pega el contenido de cada archivo):

1. `supabase/schema.sql`
2. `supabase/step5-fotos.sql`
3. `supabase/step6-limpieza-evaluaciones.sql`
4. `supabase/step7-horario.sql`
5. `supabase/step8-cerrar-registro.sql`
6. `supabase/step9-storage-y-limpieza.sql`
7. `supabase/step10-admins.sql` — cambia el correo del primer administrador antes de ejecutarlo
8. `supabase/step11-mejoras-sql.sql`

Las asignaturas y el horario se crean desde la propia app (Materias y la pestaña Horario del panel). Un script de carga masiva con datos personales quedó fuera del repositorio a propósito.

No vuelvas a ejecutar `schema.sql` sobre una base que ya existe.

## Registro por invitación

1. Despliega la función:
   ```bash
   supabase functions deploy registro --no-verify-jwt
   ```
   `--no-verify-jwt` es necesario porque quien se registra aún no tiene sesión.
2. En Supabase → Authentication → Sign In / Providers, **desactiva "Allow new users to sign up"**. Sin este paso cualquiera puede llamar a `signUp` directamente y saltarse la invitación.
3. Un administrador genera el QR en **Invitar**. Caduca a la hora y se puede usar una sola vez.

Añadir otro administrador:

```sql
insert into admins (user_id) select id from auth.users where email = 'correo@ejemplo.com';
```

## Despliegue del frontend

`npm run build` genera `dist/`. `public/_redirects` deja preparado el enrutado de la SPA (Netlify / Cloudflare Pages). Configura las dos variables `VITE_…` en el panel del hosting.

## Pruebas manuales tras desplegar

- Registro con un QR válido crea la cuenta; reutilizar el mismo QR falla.
- Un `signUp` directo contra la API de Auth se rechaza.
- Un usuario que no es administrador no ve "Invitar" y `/invitar` lo devuelve al panel.
- Fotos de tareas: subir, cambiar, quitar y eliminar no deja archivos huérfanos en Storage.

## Notas de diseño

- Las tareas terminadas hace más de 15 días se borran desde la app al abrir Tareas (con sus fotos), no con `pg_cron`: borrar filas por SQL dejaría las fotos huérfanas en Storage.
- Las evaluaciones con más de un año las borra un job de `pg_cron` diario.
- Todas las tablas tienen RLS por `user_id`; las claves foráneas a `asignaturas` son compuestas `(asignatura_id, user_id)` para que nadie enlace filas con asignaturas ajenas.
