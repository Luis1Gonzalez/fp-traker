// Edge Function: revoca el permiso en Google y borra la conexión y los
// items importados de ese usuario.
// Desplegar con: supabase functions deploy classroom-desconectar
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const userId = userIdDe(req)
  if (!userId) return json({ error: 'Sesión no válida.' }, 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: conexion } = await admin
    .from('classroom_conexiones')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()

  if (conexion?.refresh_token) {
    // Si falla (p. ej. ya estaba revocado desde la cuenta de Google), no
    // pasa nada: seguimos borrando la conexión local igualmente.
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: conexion.refresh_token }),
    }).catch(() => {})
  }

  await admin.from('classroom_conexiones').delete().eq('user_id', userId)
  await admin.from('classroom_items').delete().eq('user_id', userId)

  return json({ ok: true })
})
