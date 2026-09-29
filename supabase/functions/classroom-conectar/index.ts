// Edge Function: recibe el "code" de OAuth que devuelve Google tras el
// permiso, lo cambia por un refresh_token y lo guarda para ese usuario.
// A diferencia de "registro", esta función SÍ exige sesión (JWT) — la
// verifica la propia plataforma de Supabase antes de invocarla.
// Desplegar con: supabase functions deploy classroom-conectar
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

// El gateway de Supabase ya verificó la firma del JWT antes de invocar esta
// función (esta NO se despliega con --no-verify-jwt); aquí solo hace falta
// leer el "sub" (id de usuario) del token, sin volver a verificarlo.
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

  let body: { code?: string; redirect_uri?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Petición inválida.' }, 400)
  }

  const code = body.code?.trim() ?? ''
  const redirectUri = body.redirect_uri?.trim() ?? ''
  if (!code || !redirectUri) return json({ error: 'Faltan datos.' }, 400)

  const clientId = Deno.env.get('CLASSROOM_CLIENT_ID')!
  const clientSecret = Deno.env.get('CLASSROOM_CLIENT_SECRET')!

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const tokenJson = await tokenRes.json()

  if (!tokenRes.ok || !tokenJson.refresh_token) {
    console.error('Google no devolvió refresh_token:', tokenJson)
    // Causa típica: el usuario ya había conectado antes y Google no reemite
    // refresh_token sin "prompt=consent" (el frontend ya lo pide, pero se
    // deja el aviso por si Google cambia de comportamiento).
    return json({ error: 'Google no concedió el permiso. Inténtalo de nuevo.' }, 400)
  }

  // El email de la cuenta de Google conectada viene en el id_token (JWT),
  // porque se pidió el scope "openid email". Es solo informativo.
  let googleEmail: string | null = null
  try {
    const payload = tokenJson.id_token.split('.')[1]
    googleEmail = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).email ?? null
  } catch {
    // No crítico: seguimos sin el email si no se pudo leer.
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: upsertError } = await admin.from('classroom_conexiones').upsert({
    user_id: userId,
    google_email: googleEmail,
    refresh_token: tokenJson.refresh_token,
    conectado_at: new Date().toISOString(),
  })

  if (upsertError) {
    console.error('No se pudo guardar la conexión con Classroom:', upsertError.message)
    return json({ error: 'No se pudo guardar la conexión.' }, 500)
  }

  return json({ ok: true, google_email: googleEmail })
})
