from pathlib import Path

path=Path('supabase/functions/conversion-signal-dispatch/index.ts')
text=path.read_text(encoding='utf-8')

old="if(lead?.id)user.externalIds=[String(lead.id)];"
new="if(lead?.id)user.externalIds=[await sha256(String(lead.id))];"
if new not in text:
    if text.count(old)!=1: raise SystemExit(f'LinkedIn external ID anchor mismatch: {text.count(old)}')
    text=text.replace(old,new,1)

oldq="if(blockedVerification.has(lower(lead?.verification_status))||(minQ!==null&&q!==null&&q<minQ)){"
newq="if(blockedVerification.has(lower(lead?.verification_status))||(minQ!==null&&(q===null||q<minQ))){"
if newq not in text:
    if text.count(oldq)!=1: raise SystemExit(f'quality gate anchor mismatch: {text.count(oldq)}')
    text=text.replace(oldq,newq,1)

required=[
    "user.externalIds=[await sha256(String(lead.id))]",
    "minQ!==null&&(q===null||q<minQ)",
    "marketing_consent_required",
    "lead_quality_gate",
    "blockedVerification",
]
for needle in required:
    if needle not in text: raise SystemExit(f'missing privacy contract: {needle}')

path.write_text(text,encoding='utf-8')
