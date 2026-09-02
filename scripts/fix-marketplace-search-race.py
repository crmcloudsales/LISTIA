#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
market=ROOT/'public'/'marketplace.js'
config=ROOT/'public'/'config.js'
sw=ROOT/'public'/'sw.js'

s=market.read_text(encoding='utf-8')
old="let listings=[],total=0,previousScreen='screen-login',selected=null,busy=false,serial=0,filterTimer=0;"
new="let listings=[],total=0,previousScreen='screen-login',selected=null,busy=false,serial=0,filterTimer=0,pendingReset=false;"
if old not in s:
    raise SystemExit('marketplace state anchor missing')
s=s.replace(old,new,1)

old_load="async function load(reset=true){const grid=document.getElementById('marketplaceGrid');if(!grid||busy)return;const token=++serial,b=document.getElementById('marketplaceLoadMore');busy=true;if(reset){listings=[];total=0;publishData();grid.replaceChildren(el('div','marketplace-loading',c().loading))}syncLoadMore();try{const params={p_limit:PAGE_SIZE,p_offset:reset?0:listings.length,...filters()};const rows=await request('/rest/v1/rpc/marketplace_public_feed_v2',{method:'POST',body:JSON.stringify(params)})||[];if(token!==serial)return;const known=new Set(listings.map(x=>String(x.id)));const fresh=rows.filter(x=>!known.has(String(x.id)));listings=reset?fresh:[...listings,...fresh];total=rows.length?Number(rows[0].total_count||listings.length):(reset?0:total);publishData();render()}catch(err){if(token!==serial)return;console.error('LISTIA marketplace',err);if(reset)grid.replaceChildren(el('div','marketplace-empty',c().error));else if(b)b.hidden=false}finally{if(token===serial){busy=false;syncLoadMore()}}}"
new_load="async function load(reset=true){const grid=document.getElementById('marketplaceGrid');if(!grid)return;if(busy){if(reset)pendingReset=true;return}const token=++serial,b=document.getElementById('marketplaceLoadMore');busy=true;if(reset){listings=[];total=0;publishData();grid.replaceChildren(el('div','marketplace-loading',c().loading))}syncLoadMore();try{const params={p_limit:PAGE_SIZE,p_offset:reset?0:listings.length,...filters()};const rows=await request('/rest/v1/rpc/marketplace_public_feed_v2',{method:'POST',body:JSON.stringify(params)})||[];if(token!==serial||pendingReset)return;const known=new Set(listings.map(x=>String(x.id)));const fresh=rows.filter(x=>!known.has(String(x.id)));listings=reset?fresh:[...listings,...fresh];total=rows.length?Number(rows[0].total_count||listings.length):(reset?0:total);publishData();render()}catch(err){if(token!==serial||pendingReset)return;console.error('LISTIA marketplace',err);if(reset)grid.replaceChildren(el('div','marketplace-empty',c().error));else if(b)b.hidden=false}finally{if(token===serial){busy=false;syncLoadMore();const rerun=pendingReset;pendingReset=false;if(rerun)queueMicrotask(()=>load(true))}}}"
if old_load not in s:
    raise SystemExit('marketplace load anchor missing')
s=s.replace(old_load,new_load,1)
market.write_text(s,encoding='utf-8')

for path in (config,sw):
    text=path.read_text(encoding='utf-8')
    if '/marketplace.js?v=12' not in text:
        raise SystemExit(f'{path.name}: marketplace v12 anchor missing')
    text=text.replace('/marketplace.js?v=12','/marketplace.js?v=13')
    if path==sw:
        text=text.replace('visible-marketplace-v1"','visible-marketplace-v1-search-v13"',1)
    path.write_text(text,encoding='utf-8')

print('Marketplace latest-search-wins fix applied; runtime bumped to v13')
