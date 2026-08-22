import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_DB_URL = Deno.env.get('SUPABASE_DB_URL')!
const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
const GOOGLE_OAUTH_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')
const sql = postgres(SUPABASE_DB_URL, { prepare: false })

async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
  return Array.from(digest).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function safeRedirect(base: string, status: string, detail?: string) {
  const url = new URL(base)
  url.searchParams.set('integration', 'google')
  url.searchParams.set('status', status)
  if (detail) url.searchParams.set('detail', detail)
  return Response.redirect(url.toString(), 302)
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

async function revokeGoogleToken(token: string | undefined) {
  if (!token) return
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    })
  } catch (_) {
    // Best-effort cleanup only.
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const requestUrl = new URL(req.url)
  const state = requestUrl.searchParams.get('state')
  const code = requestUrl.searchParams.get('code')
  const providerError = requestUrl.searchParams.get('error')

  if (!state) return new Response('Invalid OAuth state', { status: 400 })

  try {
    const stateHash = await sha256Hex(state)
    const [oauthState] = await sql`
      select id, organization_id, user_id, code_verifier, redirect_to, expires_at, used_at
      from public.oauth_connection_states
      where state_hash = ${stateHash}
        and provider = 'google'
      limit 1
    `

    if (!oauthState) return new Response('OAuth state not found', { status: 400 })
    if (oauthState.used_at) return safeRedirect(oauthState.redirect_to, 'error', 'state_already_used')
    if (new Date(oauthState.expires_at).getTime() < Date.now()) return safeRedirect(oauthState.redirect_to, 'error', 'state_expired')

    await sql`
      update public.oauth_connection_states
      set used_at = now()
      where id = ${oauthState.id}::uuid and used_at is null
    `

    if (providerError) return safeRedirect(oauthState.redirect_to, 'cancelled', providerError)
    if (!code) return safeRedirect(oauthState.redirect_to, 'error', 'missing_code')
    if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
      return safeRedirect(oauthState.redirect_to, 'error', 'oauth_not_configured')
    }

    const callbackUrl = `${SUPABASE_URL}/functions/v1/google-oauth-callback`
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_OAUTH_CLIENT_ID,
        client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
        code_verifier: oauthState.code_verifier,
      }),
    })

    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('google token exchange failed', tokenData)
      return safeRedirect(oauthState.redirect_to, 'error', 'token_exchange_failed')
    }

    const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${tokenData.access_token}` },
    })
    const userInfo = await userInfoResponse.json()
    if (!userInfoResponse.ok || !userInfo.sub) {
      console.error('google userinfo failed', userInfo)
      await revokeGoogleToken(tokenData.access_token)
      return safeRedirect(oauthState.redirect_to, 'error', 'userinfo_failed')
    }

    const [listiaUser] = await sql`
      select email
      from auth.users
      where id = ${oauthState.user_id}::uuid
      limit 1
    `
    const registeredEmail = normalizeEmail(listiaUser?.email)
    const googleEmail = normalizeEmail(userInfo.email)
    if (!registeredEmail || !googleEmail || userInfo.email_verified !== true || registeredEmail !== googleEmail) {
      console.warn('google oauth email mismatch', {
        user_id: oauthState.user_id,
        organization_id: oauthState.organization_id,
      })
      await revokeGoogleToken(tokenData.access_token)
      return safeRedirect(oauthState.redirect_to, 'error', 'google_email_mismatch')
    }

    const [lockedConnection] = await sql`
      select id, external_account_id, external_account_email
      from public.integration_connections
      where organization_id = ${oauthState.organization_id}::uuid
        and provider = 'google'
        and external_account_id is not null
      order by created_at asc
      limit 1
    `
    if (lockedConnection?.external_account_id && lockedConnection.external_account_id !== userInfo.sub) {
      await revokeGoogleToken(tokenData.access_token)
      return safeRedirect(oauthState.redirect_to, 'error', 'google_account_locked')
    }

    let calendarId: string | null = null
    let calendarSetupError: string | null = null
    try {
      const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${tokenData.access_token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ summary: 'LISTIA Appointments', description: 'Appointments created and managed by LISTIA.' }),
      })
      const calendarData = await calendarResponse.json()
      if (calendarResponse.ok && calendarData.id) calendarId = calendarData.id
      else calendarSetupError = calendarData?.error?.message || 'calendar_setup_failed'
    } catch (calendarError) {
      calendarSetupError = calendarError instanceof Error ? calendarError.message : 'calendar_setup_failed'
    }

    const scopeString = typeof tokenData.scope === 'string' ? tokenData.scope : ''
    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null
    const metadata = JSON.stringify({
      picture: userInfo.picture || null,
      calendar_id: calendarId,
      calendar_setup_error: calendarSetupError,
      token_type: tokenData.token_type || 'Bearer',
      connected_by_user_id: oauthState.user_id,
      registered_email: registeredEmail,
    })

    const result = await sql.begin(async (tx) => {
      const [existing] = lockedConnection?.id
        ? [lockedConnection]
        : await tx`
            select id, external_account_id
            from public.integration_connections
            where organization_id = ${oauthState.organization_id}::uuid
              and provider = 'google'
              and external_account_id = ${userInfo.sub}
            order by created_at asc
            limit 1
          `

      let connectionId: string
      if (existing?.id) {
        connectionId = existing.id
        await tx`
          update public.integration_connections
          set status = 'connected',
              external_account_id = ${userInfo.sub},
              external_account_email = ${userInfo.email || null},
              display_name = ${userInfo.name || userInfo.email || 'Google'},
              granted_scopes = string_to_array(${scopeString}, ' '),
              metadata = ${metadata}::jsonb,
              connected_at = coalesce(connected_at, now()),
              last_error = null,
              updated_at = now()
          where id = ${connectionId}::uuid
        `
      } else {
        const [created] = await tx`
          insert into public.integration_connections
            (organization_id, provider, status, external_account_id, external_account_email, display_name, granted_scopes, metadata, connected_at)
          values
            (${oauthState.organization_id}::uuid, 'google', 'connected', ${userInfo.sub}, ${userInfo.email || null}, ${userInfo.name || userInfo.email || 'Google'}, string_to_array(${scopeString}, ' '), ${metadata}::jsonb, now())
          returning id
        `
        connectionId = created.id
      }

      const [refs] = await tx`
        select access_token_secret_id, refresh_token_secret_id
        from private.integration_token_refs
        where connection_id = ${connectionId}::uuid
        limit 1
      `

      let accessSecretId = refs?.access_token_secret_id as string | undefined
      let refreshSecretId = refs?.refresh_token_secret_id as string | undefined

      if (accessSecretId) {
        await tx`select vault.update_secret(${accessSecretId}::uuid, ${tokenData.access_token})`
      } else {
        const [createdAccess] = await tx`
          select vault.create_secret(${tokenData.access_token}, ${`oauth_${connectionId}_access`}, 'LISTIA OAuth access token') as id
        `
        accessSecretId = createdAccess.id
      }

      if (tokenData.refresh_token) {
        if (refreshSecretId) {
          await tx`select vault.update_secret(${refreshSecretId}::uuid, ${tokenData.refresh_token})`
        } else {
          const [createdRefresh] = await tx`
            select vault.create_secret(${tokenData.refresh_token}, ${`oauth_${connectionId}_refresh`}, 'LISTIA OAuth refresh token') as id
          `
          refreshSecretId = createdRefresh.id
        }
      }

      await tx`
        insert into private.integration_token_refs
          (connection_id, access_token_secret_id, refresh_token_secret_id, token_expires_at, token_metadata, updated_at)
        values
          (${connectionId}::uuid, ${accessSecretId || null}::uuid, ${refreshSecretId || null}::uuid, ${tokenExpiresAt}::timestamptz, ${JSON.stringify({ scope: scopeString, token_type: tokenData.token_type || 'Bearer' })}::jsonb, now())
        on conflict (connection_id) do update
        set access_token_secret_id = excluded.access_token_secret_id,
            refresh_token_secret_id = coalesce(excluded.refresh_token_secret_id, private.integration_token_refs.refresh_token_secret_id),
            token_expires_at = excluded.token_expires_at,
            token_metadata = excluded.token_metadata,
            updated_at = now()
      `

      return { connectionId }
    })

    console.log('google oauth connected', { organization_id: oauthState.organization_id, connection_id: result.connectionId })
    return safeRedirect(oauthState.redirect_to, 'connected')
  } catch (error) {
    console.error('google-oauth-callback', error)
    return new Response('OAuth connection failed', { status: 500 })
  }
})
