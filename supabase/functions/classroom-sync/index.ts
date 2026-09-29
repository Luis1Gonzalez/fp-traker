// Edge Function: renueva el token con Google, trae los cursos activos del
// alumno y sus tareas/anuncios, y los guarda como "classroom_items". Se
// llama a demanda desde el botón "Sincronizar ahora" de la app.
// Desplegar con: supabase functions deploy classroom-sync
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function userIdDe(req: Request): string | null {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const partes = token.split('.')
  if (partes.length !== 3) return null
  try {
    return JSON.parse(atob(partes[1].replace(/-/g, '+').replace(/_/g, '/'))).sub ?? null
  } catch {
    return null
  }
}

// Trae todas las páginas de un listado de la API de Classroom.
async function paginar(url: string, accessToken: string, clave: string) {
  const items: Record<string, unknown>[] = []
  let pageToken: string | undefined
  do {
    const u = new URL(url)
    u.searchParams.set('pageSize', '100')
    if (pageToken) u.searchParams.set('pageToken', pageToken)
    const res = await fetch(u, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) {
      const texto = await res.text()
      throw new Error(`Classroom API ${res.status} en ${url}: ${texto.slice(0, 300)}`)
    }
    const data = await res.json()
    items.push(...(data[clave] ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)
  return items
}

function fechaISO(dueDate?: { year: number; month: number; day: number }) {
  if (!dueDate) return null
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${dueDate.year}-${p2(dueDate.month)}-${p2(dueDate.day)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const userId = userIdDe(req)
  if (!userId) return json({ error: 'Sesión no válida.' }, 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: conexion, error: conexionError } = await admin
    .from('classroom_conexiones')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()
  if (conexionError || !conexion) return json({ error: 'No has conectado Google Classroom.' }, 400)

  // 1) Renovar el access_token. Se hace siempre (no se guarda uno cacheado):
  //    la sincronización es manual y poco frecuente, así que no compensa la
  //    complejidad de gestionar su caducidad (dura ~1 hora).
  const clientId = Deno.env.get('CLASSROOM_CLIENT_ID')!
  const clientSecret = Deno.env.get('CLASSROOM_CLIENT_SECRET')!
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conexion.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const tokenJson = await tokenRes.json()
  if (!tokenRes.ok) {
    console.error('No se pudo renovar el token de Google:', tokenJson)
    // Típico si el permiso caducó (proyecto sin verificar: cada 7 días) o si
    // el usuario lo revocó desde su cuenta de Google.
    return json({ error: 'La conexión con Google Classroom caducó. Vuelve a conectarla.' }, 409)
  }
  const accessToken = tokenJson.access_token as string

  try {
    // 2) Cursos activos donde el usuario es alumno.
    const cursos = await paginar(
      'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&studentId=me',
      accessToken,
      'courses',
    )

    let nuevos = 0
    for (const curso of cursos as { id: string; name: string }[]) {
      const [tareas, anuncios] = await Promise.all([
        paginar(`https://classroom.googleapis.com/v1/courses/${curso.id}/courseWork`, accessToken, 'courseWork'),
        paginar(
          `https://classroom.googleapis.com/v1/courses/${curso.id}/announcements`,
          accessToken,
          'announcements',
        ),
      ])

      type Filas = {
        user_id: string
        google_id: string
        curso_id: string
        curso_nombre: string
        tipo: 'tarea' | 'anuncio'
        titulo: string
        descripcion: string | null
        fecha_entrega: string | null
        publicado_at: string
      }

      const filas: Filas[] = [
        ...tareas.map((t: any) => ({
          user_id: userId,
          google_id: t.id,
          curso_id: curso.id,
          curso_nombre: curso.name,
          tipo: 'tarea' as const,
          titulo: t.title,
          descripcion: t.description ?? null,
          fecha_entrega: fechaISO(t.dueDate),
          publicado_at: t.creationTime,
        })),
        ...anuncios.map((a: any) => ({
          user_id: userId,
          google_id: a.id,
          curso_id: curso.id,
          curso_nombre: curso.name,
          tipo: 'anuncio' as const,
          titulo: (a.text ?? '').slice(0, 120) || '(sin texto)',
          descripcion: a.text ?? null,
          fecha_entrega: null,
          publicado_at: a.creationTime,
        })),
      ]

      if (filas.length === 0) continue

      // ignoreDuplicates: los que ya existían (misma sincronización anterior)
      // no se tocan ni se devuelven, así "nuevos" solo cuenta lo realmente nuevo.
      const { data: insertadas, error: insertError } = await admin
        .from('classroom_items')
        .upsert(filas, { onConflict: 'user_id,google_id', ignoreDuplicates: true })
        .select('id')
      if (insertError) throw insertError
      nuevos += insertadas?.length ?? 0
    }

    await admin
      .from('classroom_conexiones')
      .update({ ultima_sincronizacion: new Date().toISOString() })
      .eq('user_id', userId)

    return json({ ok: true, nuevos, cursos: cursos.length })
  } catch (e) {
    console.error('Fallo sincronizando Classroom:', e)
    return json({ error: 'No se pudo sincronizar con Classroom. Inténtalo de nuevo.' }, 500)
  }
})
