export type TextResult={content:string;usage:any;provider_response_id:string|null}
export type RuntimeSecrets=Record<string,string>

export function outputText(payload:any){
  if(typeof payload?.output_text==='string')return payload.output_text
  for(const item of payload?.output||[])for(const c of item?.content||[])if(c?.type==='output_text'&&typeof c.text==='string')return c.text
  return''
}

export async function callOpenAIText(model:string,key:string,system:string,prompt:string,format:string,maxTokens:number):Promise<TextResult>{
  const body:any={model,instructions:system,input:prompt,max_output_tokens:maxTokens,store:false,reasoning:{effort:model.includes('luna')?'low':model.includes('terra')?'medium':'high'}}
  if(format==='json')body.text={format:{type:'json_object'}}
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(body)})
  const payload=await r.json().catch(()=>({}))
  if(!r.ok)throw new Error(`openai_http_${r.status}:${String(payload?.error?.message||'').slice(0,180)}`)
  return{content:outputText(payload),usage:payload?.usage||null,provider_response_id:payload?.id||null}
}

export async function callNvidiaText(model:string,key:string,system:string,prompt:string,format:string,maxTokens:number):Promise<TextResult>{
  const body:any={model,messages:[{role:'system',content:system},{role:'user',content:prompt}],temperature:.2,max_tokens:maxTokens,stream:false,chat_template_kwargs:{enable_thinking:false}}
  if(format==='json')body.response_format={type:'json_object'}
  const r=await fetch('https://integrate.api.nvidia.com/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(body)})
  const payload=await r.json().catch(()=>({}))
  if(!r.ok)throw new Error(`nvidia_http_${r.status}:${String(payload?.detail||payload?.message||'').slice(0,180)}`)
  return{content:String(payload?.choices?.[0]?.message?.content||''),usage:payload?.usage||null,provider_response_id:payload?.id||null}
}

export async function callGroqText(model:string,key:string,system:string,prompt:string,format:string,maxTokens:number):Promise<TextResult>{
  const body:any={model,messages:[{role:'system',content:system},{role:'user',content:prompt}],temperature:.2,max_tokens:maxTokens,stream:false}
  if(format==='json')body.response_format={type:'json_object'}
  const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(body)})
  const payload=await r.json().catch(()=>({}))
  if(!r.ok)throw new Error(`groq_http_${r.status}:${String(payload?.error?.message||payload?.message||'').slice(0,180)}`)
  return{content:String(payload?.choices?.[0]?.message?.content||''),usage:payload?.usage||null,provider_response_id:payload?.id||null}
}

export async function callGeminiText(model:string,key:string,system:string,prompt:string,format:string,maxTokens:number):Promise<TextResult>{
  const body:any={systemInstruction:{parts:[{text:system||'You are a precise assistant.'}]},contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:.2,maxOutputTokens:maxTokens}}
  if(format==='json')body.generationConfig.responseMimeType='application/json'
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'x-goog-api-key':key,'content-type':'application/json'},body:JSON.stringify(body)})
  const payload=await r.json().catch(()=>({}))
  if(!r.ok)throw new Error(`google_http_${r.status}:${String(payload?.error?.message||'').slice(0,180)}`)
  const parts=payload?.candidates?.[0]?.content?.parts||[]
  const content=parts.map((p:any)=>typeof p?.text==='string'?p.text:'').join('').trim()
  return{content,usage:payload?.usageMetadata||null,provider_response_id:String(payload?.responseId||'')||null}
}

export async function callCloudflareText(model:string,token:string,accountId:string,system:string,prompt:string,format:string,maxTokens:number):Promise<TextResult>{
  if(!accountId)throw new Error('cloudflare_account_id_missing')
  const body:any={model,messages:[{role:'system',content:system},{role:'user',content:prompt}],temperature:.2,max_tokens:maxTokens,stream:false}
  if(format==='json')body.response_format={type:'json_object'}
  const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1/chat/completions`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)})
  const payload=await r.json().catch(()=>({}))
  if(!r.ok||payload?.success===false)throw new Error(`cloudflare_http_${r.status}:${String(payload?.errors?.[0]?.message||payload?.error?.message||'').slice(0,180)}`)
  const data=payload?.result||payload
  return{content:String(data?.choices?.[0]?.message?.content||''),usage:data?.usage||null,provider_response_id:data?.id||null}
}

export async function callOpenAITts(model:string,key:string,text:string,instructions:string,voice:string,speed:number){
  const r=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({model,voice,input:text,instructions,response_format:'mp3',speed})})
  if(!r.ok){const detail=await r.text();throw new Error(`openai_tts_http_${r.status}:${detail.slice(0,180)}`)}
  const audio=await r.arrayBuffer()
  if(audio.byteLength<32)throw new Error('tts_empty_audio')
  return audio
}
