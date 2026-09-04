import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const DB = Deno.env.get('SUPABASE_DB_URL') || ''
const MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b'
const DIRECT_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions'
const RUNTIME_KEY = 'nvidia:listia_direct'
const API_SECRET_NAME = 'listia_nvidia_api_key'
const LOCAL_MODEL = 'deterministic-property-type-v1'
const sql = postgres(DB, { prepare: false })

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  },
})

async function sha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
  return Array.from(digest).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function authorized(req: Request) {
  const supplied = req.headers.get('x-listia-ai-dispatch-key') || ''
  if (!supplied || supplied.length > 256 || !DB) return false
  const [row] = await sql`select decrypted_secret from vault.decrypted_secrets where name='listia_property_ai_dispatch_secret' limit 1`
  const expected = String(row?.decrypted_secret || '')
  return Boolean(expected) && constantTimeEqual(await sha256(supplied), await sha256(expected))
}

async function nvidiaApiKey() {
  if (!DB) return ''
  const [row] = await sql`select decrypted_secret from vault.decrypted_secrets where name=${API_SECRET_NAME} limit 1`
  return String(row?.decrypted_secret || '')
}

const clean = (value: unknown, max = 12000) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const typeAliases: Record<string, string> = {
  house: 'house', casa: 'house', villa: 'house', townhouse: 'house',
  apartment: 'apartment', apartamento: 'apartment', departamento: 'apartment', condo: 'apartment', condominium: 'apartment',
  penthouse: 'penthouse', land: 'land', terreno: 'land', lote: 'land', lot: 'land',
  commercial: 'commercial', comercial: 'commercial', office: 'office', oficina: 'office',
  warehouse: 'warehouse', bodega: 'warehouse', nave: 'warehouse', building: 'building', edificio: 'building',
  hotel: 'hotel', local: 'local', 'local comercial': 'local',
}

function normalizePropertyType(value: unknown) {
  return typeAliases[fold(clean(value, 80))] || null
}

function evidenceIsGrounded(source: string, evidence: unknown) {
  const e = fold(clean(evidence, 240))
  return e.length >= 3 && fold(source).includes(e)
}

function sourceText(fields: any) {
  const rows: string[] = []
  const add = (label: string, value: unknown) => {
    const v = clean(value, label === 'description' ? 12000 : 1000)
    if (v) rows.push(`${label}: ${v}`)
  }
  add('title', fields?.title)
  add('operation_type', fields?.operation_type)
  add('property_type', fields?.property_type)
  add('description', fields?.description)
  if (fields?.price !== null && fields?.price !== undefined && fields?.price !== '') rows.push(`price: ${String(fields.price).slice(0, 80)}`)
  add('currency', fields?.currency)
  add('commission_text', fields?.commission_text)
  add('location_text', fields?.location_text)
  add('postal_code', fields?.postal_code)
  return rows.join('\n')
}

const localAliases: Array<[string, string]> = [
  ['local comercial', 'local'], ['penthouse', 'penthouse'], ['townhouse', 'house'], ['condominium', 'apartment'],
  ['departamento', 'apartment'], ['apartamento', 'apartment'], ['apartment', 'apartment'], ['condo', 'apartment'],
  ['warehouse', 'warehouse'], ['bodega', 'warehouse'], ['oficina', 'office'], ['office', 'office'],
  ['edificio', 'building'], ['building', 'building'], ['terreno', 'land'], ['land', 'land'], ['lote', 'land'],
  ['villa', 'house'], ['casa', 'house'], ['house', 'house'], ['comercial', 'commercial'], ['commercial', 'commercial'],
  ['hotel', 'hotel'], ['local', 'local'],
]

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function localExtract(fields: any) {
  const explicit = normalizePropertyType(fields?.property_type)
  if (explicit) {
    return {
      parsed: { property_type: explicit, property_type_evidence: clean(fields.property_type, 80), confidence: 1, notes: 'explicit_source_field' },
      usage: null,
      provider: 'source',
      model: 'explicit-source-field',
      transport: 'source',
    }
  }

  const title = clean(fields?.title, 300)
  for (const [phrase, type] of localAliases) {
    const match = title.match(new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'i'))
    if (match) {
      return {
        parsed: { property_type: type, property_type_evidence: match[0], confidence: 0.92, notes: 'deterministic_title_match' },
        usage: null,
        provider: 'listia_local',
        model: LOCAL_MODEL,
        transport: 'listia_local',
      }
    }
  }

  const description = clean(fields?.description, 12000)
  for (const [phrase, type] of localAliases) {
    const escaped = escapeRegex(phrase)
    const patterns = [
      new RegExp(`(?:^|[\\n.;])\\s*(?:tipo\\s+de\\s+propiedad|property\\s+type|tipo\\s+de\\s+inmueble|inmueble)\\s*[:\\-]\\s*(${escaped})\\b`, 'i'),
      new RegExp(`^\\s*(${escaped})\\b`, 'i'),
      new RegExp(`\\b(?:se\\s+vende|en\\s+venta|se\\s+renta|en\\s+renta|for\\s+sale|for\\s+rent)\\s+(?:una?\\s+|un\\s+|an?\\s+)?(${escaped})\\b`, 'i'),
    ]
    for (const pattern of patterns) {
      const match = description.match(pattern)
      if (match) {
        return {
          parsed: { property_type: type, property_type_evidence: match[1] || phrase, confidence: 0.84, notes: 'deterministic_declared_type_match' },
          usage: null,
          provider: 'listia_local',
          model: LOCAL_MODEL,
          transport: 'listia_local',
        }
      }
    }
  }

  return {
    parsed: { property_type: null, property_type_evidence: null, confidence: 0, notes: 'insufficient_grounded_evidence' },
    usage: null,
    provider: 'listia_local',
    model: LOCAL_MODEL,
    transport: 'listia_local',
  }
}

function parseJsonContent(content: string) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try { return JSON.parse(trimmed) } catch {}
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1))
  throw new Error('provider_invalid_json')
}

async function callNvidia(source: string, apiKey: string) {
  const system = `You extract factual real-estate fields for LISTIA. Use ONLY the supplied source text. Never infer a fact that is not explicitly supported. Return one JSON object and nothing else. For property_type, allowed canonical values are house, apartment, penthouse, land, commercial, office, warehouse, building, hotel, local, or null. If you return a non-null property_type you MUST also return a short exact evidence quote copied verbatim from the source text that directly supports the type. If evidence is insufficient return null. Do not rewrite descriptions, prices, addresses, names or any already supplied facts.`
  const user = `SOURCE TEXT:\n${source}\n\nReturn JSON exactly with keys: property_type, property_type_evidence, confidence, notes. confidence must be a number from 0 to 1.`
  const response = await fetch(DIRECT_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.1,
      top_p: 0.95,
      max_tokens: 500,
      stream: false,
      response_format: { type: 'json_object' },
      chat_template_kwargs: { enable_thinking: false },
    }),
  })
  const text = await response.text()
  if (!response.ok) {
    const err: any = new Error(`nvidia_http_${response.status}`)
    err.status = response.status
    throw err
  }
  const payload = JSON.parse(text)
  const content = String(payload?.choices?.[0]?.message?.content || '')
  if (!content) throw new Error('provider_empty_response')
  return {
    parsed: parseJsonContent(content),
    usage: payload?.usage || null,
    provider: 'nvidia',
    model: String(payload?.model || MODEL),
    transport: 'nvidia_direct',
  }
}

async function markNvidiaRuntime(credentialStatus: 'configured' | 'not_configured' | 'invalid', health: 'unknown' | 'healthy' | 'degraded' | 'down', error: string | null = null) {
  await sql`
    update private.ai_provider_runtimes
    set credential_status=${credentialStatus}, health_status=${health}, last_error=${error}, last_healthcheck_at=now(), updated_at=now()
    where runtime_key=${RUNTIME_KEY}
  `
}

async function extractPropertyType(fields: any, source: string, apiKey: string) {
  if (normalizePropertyType(fields?.property_type)) return localExtract(fields)
  if (!apiKey) return localExtract(fields)
  try {
    const result = await callNvidia(source, apiKey)
    await markNvidiaRuntime('configured', 'healthy', null)
    return result
  } catch (error: any) {
    const message = String(error?.message || error).slice(0, 240)
    const invalid = message.startsWith('nvidia_http_401') || message.startsWith('nvidia_http_403')
    await markNvidiaRuntime(invalid ? 'invalid' : 'configured', invalid ? 'down' : 'degraded', message)
    const fallback = localExtract(fields)
    return { ...fallback, provider_error: message }
  }
}

async function processOne(apiKey: string) {
  await sql`
    with ranked as (
      select id, row_number() over(partition by property_id,job_type order by queued_at desc,id desc) rn
      from private.property_ai_jobs
      where status='queued' and job_type='property_extract'
    )
    update private.property_ai_jobs j
    set status='cancelled',error_message='superseded_by_newer_input',completed_at=coalesce(j.completed_at,now()),updated_at=now()
    from ranked r
    where j.id=r.id and r.rn>1
  `

  const claimed = await sql.begin(async tx => {
    const [job] = await tx`
      select id,property_id,organization_id,job_type,input_fingerprint,input_manifest,attempt_count
      from private.property_ai_jobs
      where status='queued' and job_type='property_extract'
      order by queued_at asc
      for update skip locked
      limit 1
    `
    if (!job) return null
    const [updated] = await tx`
      update private.property_ai_jobs
      set status='processing',started_at=now(),completed_at=null,attempt_count=attempt_count+1,error_message=null,updated_at=now()
      where id=${job.id}::uuid and status='queued'
      returning id,property_id,organization_id,job_type,input_fingerprint,input_manifest,attempt_count
    `
    return updated || null
  })

  if (!claimed) return { status: 'empty' }

  try {
    const [property] = await sql`
      select id,organization_id,title,operation_type,property_type,description,price,currency,commission_text,location_text,postal_code,status,locale,processing_state
      from public.properties
      where id=${claimed.property_id}::uuid and organization_id=${claimed.organization_id}::uuid
      limit 1
    `
    if (!property) throw new Error('property_not_found_or_org_mismatch')

    const [draft] = await sql`
      select draft_data,missing_fields,status,version
      from public.property_drafts
      where property_id=${claimed.property_id}::uuid and organization_id=${claimed.organization_id}::uuid
      limit 1
    `
    if (draft?.status === 'approved') {
      await sql`update private.property_ai_jobs set status='cancelled',error_message='draft_already_approved',completed_at=now(),updated_at=now() where id=${claimed.id}::uuid`
      return { status: 'cancelled', reason: 'draft_already_approved', job_id: claimed.id }
    }

    const submitted = claimed.input_manifest?.submitted_fields || {}
    const currentFields = {
      title: property.title || submitted.title || null,
      operation_type: property.operation_type || submitted.operation_type || null,
      property_type: property.property_type || submitted.property_type || null,
      description: property.description || submitted.description || null,
      price: property.price ?? submitted.price ?? null,
      currency: property.currency || submitted.currency || null,
      commission_text: property.commission_text || submitted.commission_text || null,
      location_text: property.location_text || submitted.location_text || null,
      postal_code: property.postal_code || submitted.postal_code || null,
    }
    const source = sourceText(currentFields)
    if (!source) throw new Error('property_source_text_empty')

    const ai: any = await extractPropertyType(currentFields, source, apiKey)
    const candidateType = normalizePropertyType(ai.parsed?.property_type)
    const confidenceRaw = Number(ai.parsed?.confidence)
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0
    const evidence = clean(ai.parsed?.property_type_evidence, 240) || null
    const grounded = Boolean(candidateType && evidence && evidenceIsGrounded(source, evidence) && confidence >= 0.65)
    const acceptedType = property.property_type ? String(property.property_type) : (grounded ? candidateType : null)

    const required: Record<string, unknown> = {
      operation_type: property.operation_type,
      property_type: acceptedType,
      location_text: property.location_text,
      description: property.description,
      price: property.price,
      currency: property.currency,
    }
    const missing = Object.entries(required)
      .filter(([, value]) => value === null || value === undefined || (typeof value === 'string' && !value.trim()))
      .map(([key]) => key)

    const complete = missing.length === 0
    const now = new Date().toISOString()
    const nextStage = complete ? 'draft_ready' : 'needs_input'
    const nextStatus = complete ? 'ready' : 'needs_info'
    const oldDraft = draft?.draft_data && typeof draft.draft_data === 'object' && !Array.isArray(draft.draft_data) ? draft.draft_data : {}
    const mergedDraft = {
      ...oldDraft,
      ...currentFields,
      property_type: acceptedType,
      ai_extraction: {
        provider: ai.provider,
        transport: ai.transport,
        model: ai.model,
        processed_at: now,
        property_type_candidate: candidateType,
        property_type_evidence: evidence,
        property_type_grounded: grounded,
        confidence,
        source_mode: 'submitted_text_only',
        visual_assets_processed: false,
        provider_error: ai.provider_error || null,
      },
    }

    await sql.begin(async tx => {
      if (!property.property_type && acceptedType) {
        await tx`
          update public.properties
          set property_type=${acceptedType},updated_at=now()
          where id=${claimed.property_id}::uuid and organization_id=${claimed.organization_id}::uuid and property_type is null
        `
      }
      await tx`
        insert into public.property_drafts(property_id,organization_id,draft_data,missing_fields,status,version,updated_at)
        values(${claimed.property_id}::uuid,${claimed.organization_id}::uuid,${tx.json(mergedDraft)},${missing}::text[],'draft',1,now())
        on conflict(property_id) do update
        set draft_data=excluded.draft_data,
            missing_fields=excluded.missing_fields,
            status=case when public.property_drafts.status='approved' then public.property_drafts.status else 'draft' end,
            version=case when public.property_drafts.status='approved' then public.property_drafts.version else public.property_drafts.version+1 end,
            updated_at=now()
        where public.property_drafts.status<>'approved'
      `
      await tx`
        update public.property_processing_state
        set stage=${nextStage},
            detected_fields=coalesce(detected_fields,'{}'::jsonb)||${tx.json({ property_type: acceptedType, ai_provider: ai.provider, ai_transport: ai.transport, ai_model: ai.model, ai_grounded: grounded })},
            missing_fields=${missing}::text[],processing_completed_at=now(),error_message=null,updated_at=now()
        where property_id=${claimed.property_id}::uuid and organization_id=${claimed.organization_id}::uuid
      `
      await tx`
        update public.properties
        set status=${nextStatus},
            processing_state=coalesce(processing_state,'{}'::jsonb)||${tx.json({ stage: nextStage, next_action: complete ? 'review_draft' : 'request_missing_fields', ai_status: 'completed', ai_provider: ai.provider, ai_transport: ai.transport, ai_model: ai.model, ai_grounded: grounded, ai_completed_at: now })},
            updated_at=now()
        where id=${claimed.property_id}::uuid and organization_id=${claimed.organization_id}::uuid
      `
      await tx`
        update private.property_ai_jobs
        set status='completed',provider=${ai.provider},model=${ai.model},
            result=${tx.json({ property_type: acceptedType, candidate_property_type: candidateType, evidence, grounded, confidence, missing_fields: missing, usage: ai.usage, transport: ai.transport, source_mode: 'submitted_text_only', visual_assets_processed: false, provider_error: ai.provider_error || null })},
            completed_at=now(),error_message=null,updated_at=now()
        where id=${claimed.id}::uuid
      `
    })

    return {
      status: 'completed',
      job_id: claimed.id,
      property_id: claimed.property_id,
      grounded,
      property_type: acceptedType,
      provider: ai.provider,
      transport: ai.transport,
      missing_fields: missing,
    }
  } catch (error: any) {
    const message = String(error?.message || error).slice(0, 500)
    const attempts = Number(claimed.attempt_count || 1)
    const retry = attempts < 3 && !message.includes('property_not_found')
    await sql`
      update private.property_ai_jobs
      set status=${retry ? 'queued' : 'failed'},error_message=${message},
          started_at=case when ${retry} then null else started_at end,
          completed_at=case when ${retry} then null else now() end,updated_at=now()
      where id=${claimed.id}::uuid
    `
    return { status: retry ? 'retry_queued' : 'failed', job_id: claimed.id, error: message }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!(await authorized(req))) return json({ error: 'unauthorized' }, 401)
  if (!DB) return json({ error: 'database_not_configured' }, 503)

  const apiKey = await nvidiaApiKey()
  if (apiKey) {
    await markNvidiaRuntime('configured', 'unknown', null)
  } else {
    await markNvidiaRuntime('not_configured', 'unknown', 'LISTIA NVIDIA API key not configured; deterministic fallback active')
  }

  const body = await req.json().catch(() => ({})) as any
  const limit = Math.min(Math.max(Number(body?.limit) || 1, 1), 3)
  const results: any[] = []
  for (let i = 0; i < limit; i++) {
    const result = await processOne(apiKey)
    results.push(result)
    if (result.status === 'empty') break
  }
  return json({ ok: true, processed: results.filter(x => x.status !== 'empty').length, results })
})
