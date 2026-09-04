import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'

const DB=Deno.env.get('SUPABASE_DB_URL')||''
const sql=postgres(DB,{prepare:false})
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}})
const clean=(v:unknown,m=20000)=>typeof v==='string'?v.trim().slice(0,m):''
async function sha(v:string){const d=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));return[...d].map(b=>b.toString(16).padStart(2,'0')).join('')}
function ct(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
async function authorized(req:Request){const supplied=req.headers.get('x-listia-ai-engine-key')||'';if(!supplied||!DB)return false;const[row]=await sql`select decrypted_secret from vault.decrypted_secrets where name='listia_ai_engine_secret' limit 1`;const expected=String(row?.decrypted_secret||'');return Boolean(expected)&&ct(await sha(supplied),await sha(expected))}
async function secret(name:string){const[row]=await sql`select decrypted_secret from vault.decrypted_secrets where name=${name} limit 1`;return String(row?.decrypted_secret||'')}
function outputText(payload:any){if(typeof payload?.output_text==='string')return payload.output_text;for(const item of payload?.output||[]){for(const c of item?.content||[]){if(c?.type==='output_text'&&typeof c.text==='string')return c.text}}return''}
function parseMaybeJson(text:string,format:string){if(format!=='json')return{text};const t=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{return{json:JSON.parse(t),text:t}}catch{return{text:t,parse_error:'invalid_json'}}}
async function callOpenAI(model:string,key:string,system:string,prompt:string,format:string,maxTokens:number){const body:any={model,instructions:system,input:prompt,max_output_tokens:maxTokens,store:false,reasoning:{effort:model.includes('luna')?'low':model.includes('terra')?'medium':'high'}};if(format==='json')body.text={format:{type:'json_object'}};const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(body)});const payload=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`openai_http_${r.status}:${String(payload?.error?.message||'').slice(0,180)}`);return{content:outputText(payload),usage:payload?.usage||null,provider_response_id:payload?.id||null}}
async function callNvidia(model:string,key:string,system:string,prompt:string,format:string,maxTokens:number){const body:any={model,messages:[{role:'system',content:system},{role:'user',content:prompt}],temperature:0.2,max_tokens:maxTokens,stream:false,chat_template_kwargs:{enable_thinking:false}};if(format==='json')body.response_format={type:'json_object'};const r=await fetch('https://integrate.api.nvidia.com/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(body)});const payload=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`nvidia_http_${r.status}:${String(payload?.detail||payload?.message||'').slice(0,180)}`);return{content:String(payload?.choices?.[0]?.message?.content||''),usage:payload?.usage||null,provider_response_id:payload?.id||null}}
async function markRuntime(runtimeKey:string,credential:'configured'|'not_configured'|'invalid',health:'unknown'|'healthy'|'degraded'|'down',err:string|null){await sql`update private.ai_provider_runtimes set credential_status=${credential},health_status=${health},last_error=${err},last_healthcheck_at=now(),updated_at=now() where runtime_key=${runtimeKey}`}

Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405)
 if(!(await authorized(req)))return json({error:'unauthorized'},401)
 if(!DB)return json({error:'database_not_configured'},503)
 const body=await req.json().catch(()=>null) as any;if(!body)return json({error:'invalid_json'},400)
 const task=clean(body.task_type,80),tier=clean(body.quality_tier,8)||'q2',system=clean(body.system,12000),prompt=clean(body.prompt,50000),format=body.response_format==='text'?'text':'json',maxTokens=Math.min(Math.max(Number(body.max_output_tokens)||700,64),4000)
 if(!task||!prompt)return json({error:'task_and_prompt_required'},400)
 const[policy]=await sql`select primary_models,fallback_models,max_attempts from private.ai_route_policies where task_type=${task} and quality_tier=${tier} and active=true limit 1`;if(!policy)return json({error:'route_policy_not_found'},404)
 const candidates=[...(policy.primary_models||[]),...(policy.fallback_models||[])].map(String)
 let attempt=0,lastError='provider_unavailable'
 for(const modelKey of candidates){
   if(attempt>=Number(policy.max_attempts||3))break
   const[model]=await sql`select m.model_key,m.provider_key,m.provider_model_id,r.runtime_key,r.enabled,r.credential_status,r.credential_secret_names,r.health_status from private.ai_models m left join private.ai_provider_runtimes r on r.provider_key=m.provider_key and r.execution_surface=m.provider_key where m.model_key=${modelKey} limit 1`
   if(!model?.provider_model_id||!model?.runtime_key||model.enabled!==true||String(model.health_status||'unknown')==='down')continue
   const secretName=Array.isArray(model.credential_secret_names)?String(model.credential_secret_names[0]||''):'';const key=secretName?await secret(secretName):''
   if(!key){await markRuntime(model.runtime_key,'not_configured','unknown','credential_missing');continue}
   attempt++;const started=Date.now();let runId:string|null=null
   try{const [run]=await sql`insert into private.ai_runs(organization_id,property_id,task_type,quality_tier,provider_key,model_key,attempt_no,input_fingerprint,status,started_at) values(${body.organization_id||null}::uuid,${body.property_id||null}::uuid,${task},${tier},${model.provider_key},${model.model_key},${attempt},${await sha(system+'\n'+prompt)},'running',now()) returning id`;runId=run?.id||null
     const result=model.provider_key==='openai'?await callOpenAI(model.provider_model_id,key,system,prompt,format,maxTokens):model.provider_key==='nvidia'?await callNvidia(model.provider_model_id,key,system,prompt,format,maxTokens):null
     if(!result)throw new Error('adapter_not_implemented')
     const parsed=parseMaybeJson(result.content,format);if(format==='json'&&parsed.parse_error)throw new Error('provider_invalid_json')
     const latency=Date.now()-started;await markRuntime(model.runtime_key,'configured','healthy',null);if(runId)await sql`update private.ai_runs set status='completed',latency_ms=${latency},usage=${JSON.stringify(result.usage||{})}::jsonb,accepted=true,validation=${JSON.stringify({format})}::jsonb,output_ref=${result.provider_response_id||null},completed_at=now(),updated_at=now() where id=${runId}::uuid`
     return json({ok:true,engine:'LISTIA_AI_ENGINE_V1',task_type:task,quality_tier:tier,provider:model.provider_key,model_key:model.model_key,model:model.provider_model_id,attempt,latency_ms:latency,...parsed})
   }catch(e){const msg=String((e as Error)?.message||e).slice(0,500);lastError=msg;const invalid=msg.includes('_http_401')||msg.includes('_http_403');await markRuntime(model.runtime_key,invalid?'invalid':'configured',invalid?'down':'degraded',msg);if(runId)await sql`update private.ai_runs set status='failed',latency_ms=${Date.now()-started},accepted=false,error_message=${msg},completed_at=now(),updated_at=now() where id=${runId}::uuid`}
 }
 return json({error:'no_ai_runtime_available',detail:lastError,engine:'LISTIA_AI_ENGINE_V1'},503)
})
