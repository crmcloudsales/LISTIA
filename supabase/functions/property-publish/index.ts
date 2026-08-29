import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_DB_URL=Deno.env.get('SUPABASE_DB_URL')!
const sql=postgres(SUPABASE_DB_URL,{prepare:false})
const origins=new Set(['https://listia-pwa.pages.dev','https://app.listiaapp.com','https://listiaapp.com','https://www.listiaapp.com'])
function cors(req:Request){const o=req.headers.get('origin')||'';return{'access-control-allow-origin':origins.has(o)?o:'https://app.listiaapp.com','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, x-client-info, apikey, content-type','vary':'Origin'}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
function slugify(input:string,id:string){const base=String(input||'property').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'property';return `${base}-${id.replaceAll('-','').slice(0,8)}`}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)})
 if(req.method!=='POST')return json(req,{error:'method_not_allowed'},405)
 try{
  const origin=req.headers.get('origin')||'';if(origin&&!origins.has(origin))return json(req,{error:'origin_not_allowed'},403)
  const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)return json(req,{error:'unauthorized'},401)
  const admin=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:userData,error:userError}=await admin.auth.getUser(jwt);const user=userData?.user;if(userError||!user)return json(req,{error:'unauthorized'},401)
  const body=await req.json().catch(()=>({})) as {organization_id?:string;property_id?:string;rights_confirmed?:boolean}
  const organizationId=String(body.organization_id||''),propertyId=String(body.property_id||'')
  if(!organizationId||!propertyId)return json(req,{error:'organization_id_and_property_id_required'},400)
  const {data:member}=await admin.from('organization_members').select('role,status').eq('organization_id',organizationId).eq('user_id',user.id).eq('status','active').maybeSingle()
  if(!member||!['owner','admin'].includes(String(member.role||'')))return json(req,{error:'owner_or_admin_required'},403)
  if(body.rights_confirmed!==true)return json(req,{error:'rights_confirmation_required'},409)
  const [website]=await sql`select mode,domain,subdomain,status from public.organization_websites where organization_id=${organizationId}::uuid limit 1`
  if(!website)return json(req,{error:'website_required',options:['connect_existing','buy_website','listia_subdomain']},409)
  const [property]=await sql`select id,title,description,operation_type,property_type,price,currency,location_text,postal_code,status,locale from public.properties where id=${propertyId}::uuid and organization_id=${organizationId}::uuid limit 1`
  if(!property)return json(req,{error:'property_not_found'},404)
  if(!['ready','published'].includes(String(property.status)))return json(req,{error:'property_not_ready',status:property.status},409)
  const [draft]=await sql`select status,missing_fields from public.property_drafts where property_id=${propertyId}::uuid and organization_id=${organizationId}::uuid limit 1`
  if(!draft||draft.status!=='approved'||(Array.isArray(draft.missing_fields)&&draft.missing_fields.length))return json(req,{error:'approved_complete_draft_required'},409)
  const [imageAsset]=await sql`select id from public.property_assets where property_id=${propertyId}::uuid and organization_id=${organizationId}::uuid and asset_type='image' and coalesce(mime_type,'') like 'image/%' and nullif(btrim(coalesce(storage_path,'')),'') is not null order by created_at asc limit 1`
  if(!imageAsset)return json(req,{error:'image_required',message:'A property cannot be published without at least one image.'},409)
  const slug=slugify(property.title||'property',propertyId),now=new Date().toISOString()
  const [listing]=await sql.begin(async tx=>{
    const [row]=await tx`
      insert into public.marketplace_listings(property_id,organization_id,slug,title,description,operation_type,property_type,price,currency,location_text,postal_code,locale,visibility,status,rights_basis,rights_confirmed_at,published_at,updated_at)
      values(${propertyId}::uuid,${organizationId}::uuid,${slug},${property.title||'LISTIA'},${property.description},${property.operation_type},${property.property_type},${property.price},${property.currency||'MXN'},${property.location_text},${property.postal_code},${property.locale||'es'},'public','published','organization_owned',${now}::timestamptz,${now}::timestamptz,now())
      on conflict(property_id) do update set slug=excluded.slug,title=excluded.title,description=excluded.description,operation_type=excluded.operation_type,property_type=excluded.property_type,price=excluded.price,currency=excluded.currency,location_text=excluded.location_text,postal_code=excluded.postal_code,locale=excluded.locale,visibility='public',status='published',rights_basis='organization_owned',rights_confirmed_at=excluded.rights_confirmed_at,published_at=coalesce(public.marketplace_listings.published_at,excluded.published_at),updated_at=now()
      returning id,slug,status,visibility,published_at`
    await tx`update public.properties set status='published',published_at=coalesce(published_at,${now}::timestamptz),processing_state=coalesce(processing_state,'{}'::jsonb)||${JSON.stringify({stage:'published',next_action:'monitor_leads',published_at:now,website_mode:website.mode})}::jsonb,updated_at=now() where id=${propertyId}::uuid and organization_id=${organizationId}::uuid`
    return [row]
  })
  const host=website.mode==='listia_subdomain'&&website.subdomain?`${website.subdomain}.listiaapp.com`:website.domain||null
  return json(req,{ok:true,property_id:propertyId,listing,website:{mode:website.mode,host,status:website.status},marketplace_path:`/marketplace/${listing.slug}`})
 }catch(error){console.error('property-publish',error);return json(req,{error:'internal_error'},500)}
})
