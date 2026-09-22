// Edge Function: registro por invitación.
// Valida y consume el token de forma atómica y crea el usuario con la service key.
// Requiere que los signups públicos estén DESACTIVADOS en Supabase Auth.
// Desplegar con: supabase functions deploy registro --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  let body: { token?: string; email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Petición inválida.' }, 400)
  }

  const token = body.token?.trim() ?? ''
  const email = body.email?.trim().toLowerCase() ?? ''
  const password = body.password ?? ''

  if (!UUID_RE.test(token)) return json({ error: 'Invitación no válida.' }, 400)
  if (!EMAIL_RE.test(email)) return json({ error: 'Correo no válido.' }, 400)
  if (password.length < 6) {
    return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
  }

  // Clave secreta nueva (sb_secret_…), guardada como secreto de la función. Si no
  // existe, se usa la service_role antigua que inyecta Supabase (deja de servir
  // cuando se desactivan las claves JWT antiguas del proyecto).
  const claveSecreta =
    Deno.env.get('REGISTRO_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, claveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1) Reclamar el token de forma atómica: solo una petición puede ganarlo.
  const { data: reclamada, error: claimError } = await admin
    .from('invitaciones')
    .update({ usado_at: new Date().toISOString() })
    .eq('token', token)
    .is('usado_at', null)
    .is('revocado_at', null)
    .gt('expira_at', new Date().toISOString())
    .select('id')
    .maybeSingle()

  if (claimError) return json({ error: 'No se pudo procesar la invitación.' }, 500)
  if (!reclamada) return json({ error: 'Invitación no válida, usada o expirada.' }, 400)

  // 2) Crear el usuario. Si falla, se libera el token para que se pueda reintentar.
  const { data: creado, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !creado.user) {
    await admin.from('invitaciones').update({ usado_at: null }).eq('id', reclamada.id)
    const yaExiste = createError?.message?.toLowerCase().includes('already')
    return json(
      { error: yaExiste ? 'Ese correo ya está registrado.' : 'No se pudo crear la cuenta.' },
      yaExiste ? 409 : 400,
    )
  }

  // 3) Precargar el horario por defecto. Si falla, se deshace todo (usuario y
  //    token) para poder reintentar limpio. Si no hay origen configurado o el
  //    origen no tiene asignaturas, la función no hace nada (no es un error).
  const { error: horarioError } = await admin.rpc('cargar_horario_por_defecto', {
    p_user_id: creado.user.id,
  })
  if (horarioError) {
    console.error('cargar_horario_por_defecto falló:', horarioError.message)
    await admin.auth.admin.deleteUser(creado.user.id)
    await admin.from('invitaciones').update({ usado_at: null }).eq('id', reclamada.id)
    return json({ error: 'No se pudo preparar tu cuenta. Inténtalo de nuevo.' }, 500)
  }

  // 4) Registrar quién usó la invitación.
  await admin.from('invitaciones').update({ usado_por: creado.user.id }).eq('id', reclamada.id)

  return json({ ok: true })
})
