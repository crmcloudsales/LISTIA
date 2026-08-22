import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_DB_URL = Deno.env.get('SUPABASE_DB_URL')!
const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
const GOOGLE_OAUTH_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')
const sql = postgres(SUPABASE_DB_URL, { prepare: false })

type RateLimitDecision = { allowed: boolean; retryAfter: number }

async function consumeSecurityRateLimit(
  principalId: string,
  organizationId: string,
  action: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<RateLimitDecision> {
  const lockKey = `${principalId}:${organizationId}:${action}`
  return await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
    const [bucket] = await tx`
      insert into private.security_rate_limits
        (principal_id, organization_id, action, window_started_at, request_count, updated_at)
      values
        (${principalId}::uuid, ${organizationId}::uuid, ${action}, now(), 1, now())
      on conflict (principal_id, organization_id, action) do update
      set window_started_at = case
            when private.security_rate_limits.window_started_at <= now() - (${windowSeconds} * interval '1 second')
              then now()
            else private.security_rate_limits.window_started_at
          end,
          request_count = case
            when private.security_rate_limits.window_started_at <= now() - (${windowSeconds} * interval '1 second')
              then 1
            else private.security_rate_limits.request_count + 1
          end,
          updated_at = now()
      returning request_count,
        greatest(
          1,
          ceil(extract(epoch from (
            window_started_at + (${windowSeconds} * interval '1 second') - now()
          )))
        )::int as retry_after
    `
    const requestCount = Number(bucket?.request_count || 1)
    return {
      allowed: requestCount <= maxRequests,
      retryAfter: Math.max(1, Number(bucket?.retry_after || windowSeconds)),
    }
  })
}


const allowedOrigins = new Set(['https://listia-pwa.pages.dev','https://app.listiaapp.com'])

function cors(req: Request) {
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
    headers: { ...cors(req), 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function classify(name: string, mimeType = '') {
  const n = name.toLowerCase()
  if (mimeType === 'application/vnd.google-apps.folder') return 'folder'
  if (mimeType.startsWith('image/')) return /logo|brand|marca|identidad/.test(n) ? 'brand_asset' : 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'spreadsheet'
  if (/brochure|ficha|property|propiedad|inmueble|departamento|condo|casa|terreno|lote|unidad|inventario|listing/.test(n)) return 'property_document'
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('presentation') || mimeType.includes('word')) return 'property_document'
  return 'other'
}

async function getUser(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return null
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data.user) return null
  return { user: data.user, admin }
}

async function refreshAccessToken(connectionId: string, tokenRow: any) {
  if (!tokenRow?.refresh_token || !GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) return null
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const data = await response.json()
  if (!response.ok || !data.access_token) return null
  const expiresAt = data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString() : null
  if (tokenRow.access_token_secret_id) {
    await sql`select vault.update_secret(${tokenRow.access_token_secret_id}::uuid, ${data.access_token})`
  }
  await sql`
    update private.integration_token_refs
    set token_expires_at = ${expiresAt}::timestamptz,
        token_metadata = token_metadata || ${JSON.stringify({ token_type: data.token_type || 'Bearer' })}::jsonb,
        updated_at = now()
    where connection_id = ${connectionId}::uuid
  `
  return data.access_token as string
}

async function loadToken(connectionId: string) {
  const [row] = await sql`
    select r.access_token_secret_id,
           r.refresh_token_secret_id,
           r.token_expires_at,
           a.decrypted_secret as access_token,
           rr.decrypted_secret as refresh_token
    from private.integration_token_refs r
    left join vault.decrypted_secrets a on a.id = r.access_token_secret_id
    left join vault.decrypted_secrets rr on rr.id = r.refresh_token_secret_id
    where r.connection_id = ${connectionId}::uuid
    limit 1
  `
  if (!row?.access_token) return null
  const expiresSoon = row.token_expires_at && new Date(row.token_expires_at).getTime() < Date.now() + 60_000
  if (expiresSoon) {
    const refreshed = await refreshAccessToken(connectionId, row)
    if (refreshed) return refreshed
  }
  return row.access_token as string
}

async function listDriveFiles(accessToken: string) {
  const files: any[] = []
  let pageToken = ''
  for (let page = 0; page < 3; page++) {
    const url = new URL('https://www.googleapis.com/drive/v3/files')
    url.searchParams.set('q', 'trashed = false')
    url.searchParams.set('spaces', 'drive')
    url.searchParams.set('pageSize', '100')
    url.searchParams.set('orderBy', 'modifiedTime desc')
    url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,size,webViewLink,thumbnailLink,parents,md5Checksum,description,starred)')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
    const data = await res.json()
    if (!res.ok) return { files, error: data?.error?.message || 'drive_list_failed', status: res.status }
    files.push(...(data.files || []))
    pageToken = data.nextPageToken || ''
    if (!pageToken) break
  }
  return { files, error: null, status: 200 }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)

  try {
    const origin = req.headers.get('origin') || ''
    if (origin && !allowedOrigins.has(origin)) return json(req, { error: 'origin_not_allowed' }, 403)

    const session = await getUser(req)
    if (!session) return json(req, { error: 'unauthorized' }, 401)
    const { user, admin } = session
    const body = await req.json().catch(() => ({})) as { organization_id?: string; action?: 'scan'|'complete' }
    if (!body.organization_id) return json(req, { error: 'organization_id_required' }, 400)
    const action = body.action || 'scan'

    const { data: member } = await admin.from('organization_members')
      .select('organization_id,role,status')
      .eq('organization_id', body.organization_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!member) return json(req, { error: 'organization_access_denied' }, 403)

    const rateLimitAction = action === 'scan' ? 'google_discovery_scan' : 'google_discovery_complete'
    const rateLimitMaximum = action === 'scan' ? 3 : 5
    const rateLimit = await consumeSecurityRateLimit(user.id, body.organization_id, rateLimitAction, rateLimitMaximum, 60)
    if (!rateLimit.allowed) {
      return json(req, { error: 'rate_limited', retry_after: rateLimit.retryAfter }, 429)
    }

    if (action === 'complete') {
      if (!['owner','admin'].includes(member.role)) return json(req, { error: 'admin_required' }, 403)
      const [counts] = await sql`
        select count(*)::int as total,
               count(*) filter (where selected)::int as selected
        from public.discovery_items
        where organization_id = ${body.organization_id}::uuid
      `
      const summary = { completed_at: new Date().toISOString(), total_items: counts?.total || 0, selected_items: counts?.selected || 0 }
      await sql`
        update public.organization_onboarding
        set current_step = greatest(current_step, 5),
            completed_steps = (select array_agg(distinct x order by x) from unnest(completed_steps || array[4::smallint]) x),
            discovery_inputs = coalesce(discovery_inputs, '{}'::jsonb) || ${JSON.stringify(summary)}::jsonb,
            updated_at = now()
        where organization_id = ${body.organization_id}::uuid
      `
      return json(req, { ok: true, current_step: 5, summary })
    }

    const { data: connection } = await admin.from('integration_connections')
      .select('id,provider,status,granted_scopes,metadata,external_account_email')
      .eq('organization_id', body.organization_id)
      .eq('provider', 'google')
      .eq('status', 'connected')
      .maybeSingle()
    if (!connection) return json(req, { error: 'google_not_connected' }, 409)

    const scopes: string[] = connection.granted_scopes || []
    const expandedDrive = scopes.some((s) => s.includes('drive.readonly') || s.includes('drive.metadata.readonly'))
    const scopeMode = expandedDrive ? 'expanded' : 'minimal'

    const [driveRun] = await sql`
      insert into public.discovery_runs (organization_id,connection_id,source_type,status,scope_mode,started_by)
      values (${body.organization_id}::uuid,${connection.id}::uuid,'google_drive','running',${scopeMode},${user.id}::uuid)
      returning id
    `

    let accessToken = await loadToken(connection.id)
    if (!accessToken) {
      await sql`update public.discovery_runs set status='error', error_code='google_token_unavailable', completed_at=now() where id=${driveRun.id}::uuid`
      return json(req, { error: 'google_token_unavailable', reauth_required: true }, 401)
    }

    let drive = await listDriveFiles(accessToken)
    if (drive.status === 401) {
      const [row] = await sql`
        select r.access_token_secret_id, r.refresh_token_secret_id, r.token_expires_at,
               rr.decrypted_secret as refresh_token
        from private.integration_token_refs r
        left join vault.decrypted_secrets rr on rr.id = r.refresh_token_secret_id
        where r.connection_id=${connection.id}::uuid limit 1
      `
      const refreshed = await refreshAccessToken(connection.id, row)
      if (refreshed) drive = await listDriveFiles(refreshed)
    }

    for (const file of drive.files) {
      const candidateType = classify(file.name || 'Untitled', file.mimeType || '')
      const metadata = {
        parents: file.parents || [],
        description: file.description || null,
        starred: Boolean(file.starred),
        access_model: expandedDrive ? 'expanded_read' : 'drive_file_only',
      }
      await sql`
        insert into public.discovery_items
          (organization_id,run_id,connection_id,source_type,source_key,external_id,name,mime_type,candidate_type,size_bytes,web_url,thumbnail_url,checksum,source_created_at,source_modified_at,metadata)
        values
          (${body.organization_id}::uuid,${driveRun.id}::uuid,${connection.id}::uuid,'google_drive',${file.id},${file.id},${file.name || 'Untitled'},${file.mimeType || null},${candidateType},${file.size || null}::bigint,${file.webViewLink || null},${file.thumbnailLink || null},${file.md5Checksum || null},${file.createdTime || null}::timestamptz,${file.modifiedTime || null}::timestamptz,${JSON.stringify(metadata)}::jsonb)
        on conflict (organization_id,source_type,source_key) do update
        set run_id=excluded.run_id,
            connection_id=excluded.connection_id,
            name=excluded.name,
            mime_type=excluded.mime_type,
            candidate_type=excluded.candidate_type,
            size_bytes=excluded.size_bytes,
            web_url=excluded.web_url,
            thumbnail_url=excluded.thumbnail_url,
            checksum=excluded.checksum,
            source_created_at=excluded.source_created_at,
            source_modified_at=excluded.source_modified_at,
            metadata=excluded.metadata,
            updated_at=now()
      `
    }

    const [driveCounts] = await sql`
      select count(*)::int as total, count(*) filter (where selected)::int as selected
      from public.discovery_items where run_id=${driveRun.id}::uuid
    `
    const driveStatus = drive.error ? (drive.files.length ? 'partial' : 'error') : 'completed'
    const driveSummary = {
      accessible_files: driveCounts?.total || 0,
      selected_files: driveCounts?.selected || 0,
      scope_mode: scopeMode,
      drive_file_scope_limited: !expandedDrive,
      note: !expandedDrive ? 'drive.file only exposes files LISTIA created or the user explicitly selected/opened with LISTIA.' : null,
    }
    await sql`
      update public.discovery_runs
      set status=${driveStatus}, item_count=${driveCounts?.total || 0}, selected_count=${driveCounts?.selected || 0}, summary=${JSON.stringify(driveSummary)}::jsonb, error_code=${drive.error || null}, completed_at=now()
      where id=${driveRun.id}::uuid
    `

    let calendarReady = false
    const calendarId = connection.metadata?.calendar_id || null
    if (calendarId) {
      calendarReady = true
      const [calendarRun] = await sql`
        insert into public.discovery_runs (organization_id,connection_id,source_type,status,scope_mode,started_by,item_count,selected_count,summary,completed_at)
        values (${body.organization_id}::uuid,${connection.id}::uuid,'google_calendar','completed','minimal',${user.id}::uuid,1,1,${JSON.stringify({ calendar_ready: true })}::jsonb,now())
        returning id
      `
      await sql`
        insert into public.discovery_items
          (organization_id,run_id,connection_id,source_type,source_key,external_id,name,mime_type,candidate_type,selected,metadata)
        values
          (${body.organization_id}::uuid,${calendarRun.id}::uuid,${connection.id}::uuid,'google_calendar',${calendarId},${calendarId},'LISTIA Appointments','application/vnd.google-apps.calendar','calendar',true,${JSON.stringify({ managed_by_listia: true })}::jsonb)
        on conflict (organization_id,source_type,source_key) do update
        set run_id=excluded.run_id, connection_id=excluded.connection_id, name=excluded.name, selected=true, metadata=excluded.metadata, updated_at=now()
      `
    }

    const onboardingSummary = {
      google: {
        scanned_at: new Date().toISOString(),
        drive_accessible_files: driveCounts?.total || 0,
        drive_scope_mode: scopeMode,
        calendar_ready: calendarReady,
      }
    }
    await sql`
      update public.organization_onboarding
      set discovery_inputs = coalesce(discovery_inputs, '{}'::jsonb) || ${JSON.stringify(onboardingSummary)}::jsonb,
          updated_at = now()
      where organization_id=${body.organization_id}::uuid
    `

    await admin.from('integration_connections').update({ last_synced_at: new Date().toISOString(), last_error: drive.error || null }).eq('id', connection.id)

    return json(req, {
      ok: true,
      drive: { ...driveSummary, status: driveStatus, error: drive.error },
      calendar: { ready: calendarReady, name: calendarReady ? 'LISTIA Appointments' : null },
      next_action: !expandedDrive && (driveCounts?.total || 0) === 0 ? 'choose_drive_files_or_upload' : 'review_discovered_items',
    })
  } catch (error) {
    console.error('google-discovery', error)
    return json(req, { error: 'internal_error' }, 500)
  }
})
