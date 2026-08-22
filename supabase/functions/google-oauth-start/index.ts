import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_DB_URL = Deno.env.get('SUPABASE_DB_URL')!
const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
const sql = postgres(SUPABASE_DB_URL, { prepare: false })

const allowedRedirects = new Set([
  'https://listia-pwa.pages.dev/',
  'https://app.listiaapp.com/',
])

const allowedOrigins = new Set([
  'https://listia-pwa.pages.dev',
  'https://app.listiaapp.com',
])

const scopes = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.app.created',
  'https://www.googleapis.com/auth/calendar.events.freebusy',
].join(' ')

function base64url(bytes: Uint8Array) {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function sha256Base64url(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return base64url(new Uint8Array(digest))
}

async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
  return Array.from(digest).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  return {
    'access-control-allow-origin': allowedOrigins.has(origin) ? origin : 'https://listia-pwa.pages.dev',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'vary': 'Origin',
  }
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) })
  }
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)

  try {
    const origin = req.headers.get('origin') || ''
    if (origin && !allowedOrigins.has(origin)) return json(req, { error: 'origin_not_allowed' }, 403)

    const authHeader = req.headers.get('authorization') || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json(req, { error: 'unauthorized' }, 401)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: userData, error: userError } = await admin.auth.getUser(jwt)
    const user = userData?.user
    if (userError || !user) return json(req, { error: 'unauthorized' }, 401)

    const body = await req.json().catch(() => ({})) as { organization_id?: string; redirect_to?: string }
    if (!body.organization_id) return json(req, { error: 'organization_id_required' }, 400)

    const redirectTo = body.redirect_to && allowedRedirects.has(body.redirect_to)
      ? body.redirect_to
      : 'https://listia-pwa.pages.dev/'

    const { data: member, error: memberError } = await admin
      .from('organization_members')
      .select('organization_id,role,status')
      .eq('organization_id', body.organization_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (memberError || !member) return json(req, { error: 'organization_access_denied' }, 403)
    if (!GOOGLE_OAUTH_CLIENT_ID) return json(req, { error: 'google_oauth_not_configured', setup_required: true }, 503)

    const stateBytes = crypto.getRandomValues(new Uint8Array(32))
    const verifierBytes = crypto.getRandomValues(new Uint8Array(64))
    const state = base64url(stateBytes)
    const codeVerifier = base64url(verifierBytes)
    const codeChallenge = await sha256Base64url(codeVerifier)
    const stateHash = await sha256Hex(state)

    await sql`
      delete from public.oauth_connection_states
      where expires_at < now() or used_at is not null
    `

    await sql`
      insert into public.oauth_connection_states
        (state_hash, provider, organization_id, user_id, code_verifier, redirect_to, expires_at)
      values
        (${stateHash}, 'google', ${body.organization_id}::uuid, ${user.id}::uuid, ${codeVerifier}, ${redirectTo}, now() + interval '10 minutes')
    `

    const callbackUrl = `${SUPABASE_URL}/functions/v1/google-oauth-callback`
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', GOOGLE_OAUTH_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', callbackUrl)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'select_account consent')
    authUrl.searchParams.set('include_granted_scopes', 'true')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')

    return json(req, { authorization_url: authUrl.toString() })
  } catch (error) {
    console.error('google-oauth-start', error)
    return json(req, { error: 'internal_error' }, 500)
  }
})
