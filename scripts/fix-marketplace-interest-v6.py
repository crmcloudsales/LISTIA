#!/usr/bin/env python3
from pathlib import Path

p=Path('public/marketplace.js')
s=p.read_text(encoding='utf-8')
old="body:JSON.stringify({p_listing_id:x.id,p_contact_email:email,p_contact_phone:phone,p_source:'marketplace_me_interesa',p_consent_basis:'marketplace_interest_click'})"
new="body:JSON.stringify({p_listing_id:x.id,p_locale:locale()})"
if old not in s:
    raise SystemExit('old marketplace interest payload not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

p=Path('public/marketplace-feed-enhancements.js')
s=p.read_text(encoding='utf-8')
old="window.LISTIA_MARKETPLACE_SELECTED=r;captureInterest(r);setTimeout(()=>enhanceDetail(r),40);setTimeout(()=>enhanceDetail(r),180)"
new="window.LISTIA_MARKETPLACE_SELECTED=r;setTimeout(()=>enhanceDetail(r),40);setTimeout(()=>enhanceDetail(r),180)"
if old not in s:
    raise SystemExit('duplicate capture hook not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('single-click marketplace interest flow aligned')
