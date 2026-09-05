import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import postgres from 'https://deno.land/x/postgresjs@v3.4.7/mod.js'
import {callOpenAIText,callNvidiaText,callGroqText,callGeminiText,callCloudflareText,callOpenAITts} from './adapters.ts'

const DB=Deno.env.get('SUPABASE_DB_URL')||''
const sql=postgres(DB,{prepare:false})
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}})
const clean=(v:unknown,m=20000)=>typeof v==='string'?v.trim().slice(0,m):''
async function sha(v:string){const d=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));return[...d].map(b=>b.toString(16).padStart(2,'0')).join('')}
function ct(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
async function authorized(req:Request){const supplied=req.headers.get('x-listia-ai-engine-key')||'';if(!supplied||!DB)return false;const[row]=await sql`select decrypted_secret from vault.decrypted_secrets where name='listia_ai_engine_secret' limit 1`;const expected=String(row?.decrypted_secret||'');return Boolean(expected)&&ct(await sha(supplied),await sha(expected))}
async function secret(name:string){const[row]=await sql`select decrypted_secret from vault.decrypted_secrets where name=${name} limit 1`;return String(row?.decrypted_secret||'')}
async function secrets(names:unknown){const out:Record<string,string>={};for(const n of Array.isArray(names)?names:[]){const name=String(n||'');if(name)out[name]=await secret(name)}return out}
function parseMaybeJson(text:string,format:string){if(format!=='json')return{text};const t=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{return{json:JSON.parse(t),text:t}}catch{return{text:t,parse_error:'invalid_json'}}}
async function markRuntime(runtimeKey:string,credential:'configured'|'not_configured'|'invalid',health:'unknown'|'healthy'|'degraded'|'down',err:string|null){await sql`update private.ai_provider_runtimes set credential_status=${credential},health_status=${health},last_error=${err},last_healthcheck_at=now(),updated_at=now() where runtime_key=${runtimeKey}`}
async function route(task:string,tier:string){const[p]=await sql`select primary_models,fallback_models,max_attempts from private.ai_route_policies where task_type=${task} and quality_tier=${tier} and active=true limit 1`;return p||null}
async function runtime(modelKey:string){const[m]=await sql`select m.model_key,m.provider_key,m.provider_model_id,r.runtime_key,r.enabled,r.credential_secret_names,r.health_status,r.configuration from private.ai_models m left join private.ai_provider_runtimes r on r.provider_key=m.provider_key and r.execution_surface=m.provider_key where m.model_key=${modelKey} limit 1`;return m||null}
async function beginRun(body:any,task:string,tier:string,m:any,attempt:number,fingerprint:string){const[r]=await sql`insert into private.ai_runs(organization_id,property_id,task_type,quality_tier,provider_key,model_key,attempt_no,input_fingerprint,status,started_at) values(${body.organization_id||null}::uuid,${body.property_id||null}::uuid,${task},${tier},${m.provider_key},${m.model_key},${attempt},${fingerprint},'running',now()) returning id`;return r?.id||null}
async function endRun(id:string|null,status:'completed'|'failed',latency:number,usage:any,error:string|null,outputRef:string|null,validation:any){if(!id)return;await sql`update private.ai_runs set status=${status},latency_ms=${latency},usage=${JSON.stringify(usage||{})}::jsonb,accepted=${status==='completed'},validation=${JSON.stringify(validation||{})}::jsonb,error_message=${error},output_ref=${outputRef},completed_at=now(),updated_at=now() where id=${id}::uuid`}
function invalidCredential(msg:string){return /_http_(401|403)|credential|api.?key/i.test(msg)}
function requiredSecretsPresent(names:unknown,values:Record<string,string>){const list=(Array.isArray(names)?names:[]).map(String).filter(Boolean);return list.length===0||list.every(n=>Boolean(values[n]))}
async function callText(m:any,values:Record<string,string>,system:string,prompt:string,format:string,maxTokens:number){const names=(Array.isArray(m.credential_secret_names)?m.credential_secret_names:[]).map(String);const first=names[0]?values[names[0]]||'':'';switch(String(m.provider_key||'')){
  case'openai':return await callOpenAIText(m.provider_model_id,first,system,prompt,format,maxTokens)
  case'nvidia':return await callNvidiaText(m.provider_model_id,first,system,prompt,format,maxTokens)
  case'groq':return await callGroqText(m.provider_model_id,first,system,prompt,format,maxTokens)
  case'google':return await callGeminiText(m.provider_model_id,first,system,prompt,format,maxTokens)
  case'cloudflare':{const token=values[names[0]]||'';const accountId=values[names[1]]||String(m.configuration?.account_id||'');return await callCloudflareText(m.provider_model_id,token,accountId,system,prompt,format,maxTokens)}
  default:return null
 }}

Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405)
 if(!(await authorized(req)))return json({error:'unauthorized'},401)
 if(!DB)return json({error:'database_not_configured'},503)
 const body=await req.json().catch(()=>null) as any;if(!body)return json({error:'invalid_json'},400)
 const task=clean(body.task_type,80),tier=clean(body.quality_tier,8)||'q2';if(!task)return json({error:'task_required'},400)
 const policy=await route(task,tier);if(!policy)return json({error:'route_policy_not_found'},404)
 const candidates=[...(policy.primary_models||[]),...(policy.fallback_models||[])].map(String)
 let attempt=0,lastError='provider_unavailable'

 if(task==='tts'){
  const text=clean(body.text,7000),instructions=clean(body.instructions,3000),voice=clean(body.voice,40)||'coral',speed=Math.min(Math.max(Number(body.speed)||1,0.5),2);if(!text)return json({error:'text_required'},400)
  for(const keyName of candidates){if(attempt>=Number(policy.max_attempts||1))break;const m=await runtime(keyName);if(!m?.provider_model_id||!m?.runtime_key||m.enabled!==true||String(m.health_status||'unknown')==='down')continue;const values=await secrets(m.credential_secret_names);if(!requiredSecretsPresent(m.credential_secret_names,values)){await markRuntime(m.runtime_key,'not_configured','unknown','credential_missing');continue}attempt++;const started=Date.now();let runId:string|null=null;try{runId=await beginRun(body,task,tier,m,attempt,await sha(text+'\n'+instructions));const names=(Array.isArray(m.credential_secret_names)?m.credential_secret_names:[]).map(String);if(m.provider_key!=='openai')throw new Error('tts_adapter_not_implemented');const audio=await callOpenAITts(m.provider_model_id,values[names[0]]||'',text,instructions,voice,speed),latency=Date.now()-started;await markRuntime(m.runtime_key,'configured','healthy',null);await endRun(runId,'completed',latency,{audio_bytes:audio.byteLength},null,null,{audio_nonempty:true});return new Response(audio,{status:200,headers:{'content-type':'audio/mpeg','cache-control':'private,no-store','x-content-type-options':'nosniff','x-listia-ai-engine':'v1','x-listia-ai-provider':m.provider_key,'x-listia-ai-model':m.provider_model_id}})}catch(e){const msg=String((e as Error)?.message||e).slice(0,500);lastError=msg;const invalid=invalidCredential(msg);await markRuntime(m.runtime_key,invalid?'invalid':'configured',invalid?'down':'degraded',msg);await endRun(runId,'failed',Date.now()-started,null,msg,null,{audio_nonempty:false})}}
  return json({error:'no_tts_runtime_available',detail:lastError,engine:'LISTIA_AI_ENGINE_V1'},503)
 }

 const system=clean(body.system,12000),prompt=clean(body.prompt,50000),format=body.response_format==='text'?'text':'json',maxTokens=Math.min(Math.max(Number(body.max_output_tokens)||700,64),4000);if(!prompt)return json({error:'prompt_required'},400)
 for(const keyName of candidates){if(attempt>=Number(policy.max_attempts||3))break;const m=await runtime(keyName);if(!m?.provider_model_id||!m?.runtime_key||m.enabled!==true||String(m.health_status||'unknown')==='down')continue;const values=await secrets(m.credential_secret_names);if(!requiredSecretsPresent(m.credential_secret_names,values)){await markRuntime(m.runtime_key,'not_configured','unknown','credential_missing');continue}attempt++;const started=Date.now();let runId:string|null=null;try{runId=await beginRun(body,task,tier,m,attempt,await sha(system+'\n'+prompt));const result=await callText(m,values,system,prompt,format,maxTokens);if(!result)throw new Error('adapter_not_implemented');const parsed=parseMaybeJson(result.content,format);if(format==='json'&&parsed.parse_error)throw new Error('provider_invalid_json');const latency=Date.now()-started;await markRuntime(m.runtime_key,'configured','healthy',null);await endRun(runId,'completed',latency,result.usage,null,result.provider_response_id,{format});return json({ok:true,engine:'LISTIA_AI_ENGINE_V1',task_type:task,quality_tier:tier,provider:m.provider_key,model_key:m.model_key,model:m.provider_model_id,attempt,latency_ms:latency,...parsed})}catch(e){const msg=String((e as Error)?.message||e).slice(0,500);lastError=msg;const invalid=invalidCredential(msg);await markRuntime(m.runtime_key,invalid?'invalid':'configured',invalid?'down':'degraded',msg);await endRun(runId,'failed',Date.now()-started,null,msg,null,{format})}}
 return json({error:'no_ai_runtime_available',detail:lastError,engine:'LISTIA_AI_ENGINE_V1'},503)
})
