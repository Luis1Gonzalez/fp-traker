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
9. `supabase/step12-horario-por-defecto.sql` — cambia el correo antes de ejecutarlo: esa cuenta es la que presta su horario a los invitados
10. `supabase/step13-corregir-aulas.sql` — solo si vienes de una carga anterior con aulas mal cargadas; no aplica a una base nueva
11. `supabase/step14-classroom.sql` — opcional, solo si vas a activar la sección Classroom (ver más abajo)

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

## Horario por defecto para cuentas nuevas

Toda cuenta que se registra por invitación recibe una copia de las asignaturas y el horario de una cuenta de referencia (fila única en la tabla `configuracion`). Puede editarlo o borrarlo libremente; no afecta a la cuenta de referencia.

Cambiar de quién se copia:

```sql
update configuracion set horario_origen = (select id from auth.users where email = 'correo@ejemplo.com');
```

Si `horario_origen` es `null`, o esa cuenta no tiene asignaturas cargadas, las cuentas nuevas simplemente empiezan vacías.

## Classroom (opcional): importar tareas y anuncios de Google

Sección aparte de Tareas/Apuntes: cada persona conecta su propia cuenta de Google y ve ahí, en su propia bandeja, las tareas y anuncios de sus cursos de Classroom. No se mezcla con el resto de la app ni convierte nada en Tareas/Apuntes automáticamente.

Requiere un proyecto de Google Cloud (gratuito) que **solo tú puedes crear**, porque va ligado a tu cuenta de Google. Pasos, en [Google Cloud Console](https://console.cloud.google.com):

1. **Crear el proyecto** (o usar uno existente) y, en *APIs & Services → Library*, buscar **Google Classroom API** y pulsar **Enable**.
2. **Pantalla de consentimiento OAuth** (*APIs & Services → OAuth consent screen*):
   - Tipo de usuario: **External**.
   - *Publishing status*: déjalo en **Testing**. Verificar la app ante Google es un trámite propio de Google, y no compensa para un puñado de usuarios.
   - *Scopes*: añade los tres de Classroom (`.../auth/classroom.courses.readonly`, `.../classroom.coursework.me.readonly`, `.../classroom.announcements.readonly`) más `openid` y `email`.
   - **Test users**: añade el correo de Google de cada persona que vaya a conectar su Classroom (el tuyo y el de cada invitado). **Mientras el proyecto esté en Testing, quien no esté en esta lista no puede conectar** — Google le bloquea con un error, no es un fallo de la app.
3. **Crear credenciales** (*APIs & Services → Credentials → Create Credentials → OAuth client ID*):
   - Tipo: **Web application**.
   - *Authorized redirect URIs*, añade exactamente (con `/classroom` al final, sin barra extra):
     - `https://TU-DOMINIO.netlify.app/classroom`
     - `http://localhost:5173/classroom` (para probar en local)
   - Guarda el **Client ID** y el **Client secret** que te da Google.
4. En Supabase → **Edge Functions → Secrets**, añade dos secretos:
   - `CLASSROOM_CLIENT_ID` = el Client ID
   - `CLASSROOM_CLIENT_SECRET` = el Client secret (este sí es secreto: nunca lo pongas en el frontend ni en `.env`)
5. Añade la variable **`VITE_GOOGLE_CLASSROOM_CLIENT_ID`** (el mismo Client ID; este no es secreto) en tu `.env` local y en las variables de entorno de Netlify.
6. Ejecuta `supabase/step14-classroom.sql` en el SQL Editor.
7. Despliega las tres funciones (a diferencia de `registro`, estas **sí** exigen sesión iniciada, así que van sin `--no-verify-jwt`):
   ```bash
   supabase functions deploy classroom-conectar
   supabase functions deploy classroom-sync
   supabase functions deploy classroom-desconectar
   ```

**Limitación de Google, no de la app:** mientras el proyecto siga en modo *Testing*, el permiso de cada persona puede caducar cada 7 días, y entonces "Sincronizar ahora" avisará de que hay que volver a pulsar "Conectar". Además, cada nuevo invitado que quiera usar Classroom hay que añadirlo a mano como *Test user* (paso 2), aparte de invitarlo a la app.

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
